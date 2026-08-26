/**
 * `POST /api/stripe/webhook` — lo único que escribe el estado de cobro.
 *
 * ⚠️⚠️ **ESTA RUTA VA EN `PUBLIC_PATHS`** (`lib/supabase/middleware.ts`).
 * Stripe la llama server-to-server, sin cookies de sesión. Si no estuviera ahí,
 * el middleware la redirige (307) a `/login` **antes** de que corra una línea de
 * este archivo: Stripe lo cuenta como entrega fallida, reintenta unas horas y
 * después se rinde. El síntoma es una suscripción que se cobra en Stripe y
 * nunca se activa en la app, sin un solo error en los logs.
 *
 * Ya pasó dos veces en este repo con otras rutas (Portadas y el scraper de
 * Competencia). Es la tercera.
 *
 * Se autentica por **firma**, no por sesión: `constructWebhookEvent` valida el
 * HMAC contra `STRIPE_WEBHOOK_SECRET`. Sin firma válida, 400 y nada se toca.
 *
 * ## Tres reglas que hacen que esto sea correcto
 *
 * 1. **Cuerpo crudo.** `await req.text()`, nunca `req.json()`: el JSON
 *    re-serializado no es byte por byte el que Stripe firmó, y la firma no
 *    valida nunca.
 * 2. **Idempotencia.** Stripe reintenta todo lo que no responda 2xx, y puede
 *    mandar el mismo evento más de una vez aunque le hayas respondido bien. El
 *    guard es `stripe_events` (ver `lib/billing/events.ts`), y la acreditación
 *    de recargas tiene además su propio unique sobre la checkout session.
 * 3. **Sin orden garantizado.** `invoice.paid` puede llegar antes que
 *    `checkout.session.completed`; un `customer.subscription.updated` viejo,
 *    después de uno nuevo. Ningún handler de acá lee el estado anterior para
 *    decidir el siguiente: todos son escrituras planas.
 *
 * Responder rápido importa: Stripe corta a los ~10 segundos y lo cuenta como
 * fallo. Nada pesado adentro.
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  constructWebhookEvent,
  creditsForPriceId,
  getStripe,
  readCancelAtPeriodEnd,
  readSubscriptionPeriod,
  subscriptionIdFromInvoice,
} from "@/lib/billing/stripe";
import { markEventProcessed } from "@/lib/billing/events";
import { applyCreditPurchase } from "@/lib/billing/credits";
import {
  applyStripeSubscription,
  findByStripeCustomerId,
  findByStripeSubscriptionId,
  markCanceled,
  markPaid,
  markPaymentFailed,
  readSubscription,
  setBillingContact,
} from "@/lib/billing/subscription";
import { fromStripeStatus } from "@/lib/billing/status";

// Node y no edge: `constructEvent` necesita el crypto de Node para el HMAC.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Falta la firma." }, { status: 400 });
  }

  // ⚠️ Cuerpo CRUDO. Ver el comentario de arriba.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (e) {
    // Firma inválida o secreto equivocado (el `whsec_` de local no es el de
    // producción). 400 a propósito: Stripe no reintenta los 4xx, y reintentar
    // algo que no podemos validar no arregla nada.
    console.error("[stripe/webhook] firma inválida:", e);
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  const fresh = await markEventProcessed(event.id, event.type, event.data.object);
  if (!fresh) {
    // Reintento de un evento ya procesado. 200 para que Stripe deje de mandarlo.
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event);
  } catch (e) {
    // 500 a propósito: Stripe reintenta con backoff. Todo lo de adentro es
    // idempotente, así que reprocesar no duplica nada.
    console.error(`[stripe/webhook] fallo procesando ${event.type} (${event.id}):`, e);
    return NextResponse.json({ error: "Error procesando el evento." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      return onCheckoutCompleted(event.data.object);

    case "customer.subscription.created":
    case "customer.subscription.updated":
      return onSubscriptionChanged(event.data.object);

    case "customer.subscription.deleted":
      return onSubscriptionDeleted(event.data.object);

    case "invoice.paid":
      return onInvoice(event.data.object, "paid");

    case "invoice.payment_failed":
      return onInvoice(event.data.object, "failed");

    default:
      // Cualquier otro evento del endpoint: se registró en `stripe_events` y
      // no se hace nada. No es un error.
      return;
  }
}

// ─── Checkout terminado ──────────────────────────────────────────────────────

/**
 * Dos cosas distintas llegan por acá según el `mode` de la sesión:
 *
 *  - `subscription` → el alta de una marca. Queda activa y quien pagó pasa a ser
 *    el contacto de facturación.
 *  - `payment`      → una recarga de créditos.
 *
 * `client_id` y `user_id` viajan en el `metadata` de la sesión, que lo fija el
 * servidor al crearla — el browser nunca los manda.
 */
async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const clientId = session.metadata?.client_id ?? null;
  const userId = session.metadata?.user_id ?? null;

  if (!clientId) {
    console.error("[stripe/webhook] checkout sin client_id en metadata:", session.id);
    return;
  }

  // Una sesión completada pero no pagada (métodos asíncronos) no activa nada.
  // Hoy solo se acepta tarjeta, así que esto no debería ocurrir; si algún día
  // se suma OXXO o SPEI, el evento que activa pasa a ser `checkout.session.
  // async_payment_succeeded` y hay que sumarlo al switch de arriba.
  if (session.payment_status !== "paid" && session.mode === "payment") {
    console.warn("[stripe/webhook] checkout de recarga sin pagar:", session.id);
    return;
  }

  if (session.mode === "subscription") {
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (!subscriptionId) return;

    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    await syncSubscription(clientId, subscription);

    // Quien pagó queda como contacto de facturación. Es lo que resuelve
    // "solo el primero paga": el segundo miembro llega a una marca ya activa y
    // entra sin pasar por Checkout.
    if (userId) await setBillingContact(clientId, userId);
    return;
  }

  if (session.mode === "payment") {
    await creditRecharge(clientId, userId, session);
  }
}

/**
 * Acredita una recarga.
 *
 * ⚠️ Los créditos salen del **price** que Stripe reporta en la línea de la
 * compra, nunca de nada que haya mandado el browser. Por eso se piden los line
 * items en vez de confiar en el metadata: el metadata lo escribe esta app, pero
 * el price lo cobró Stripe, y es lo único que prueba cuánto pagó el cliente.
 */
async function creditRecharge(
  clientId: string,
  userId: string | null,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const subscription = await readSubscription(clientId);
  if (!subscription) {
    console.error("[stripe/webhook] recarga para una marca sin suscripción:", clientId);
    return;
  }

  const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 5 });
  const priceId = lineItems.data[0]?.price?.id ?? null;
  const credits = creditsForPriceId(priceId);

  if (!credits) {
    console.error(
      `[stripe/webhook] price desconocido en la recarga ${session.id} (${priceId}). No se acredita nada.`,
    );
    return;
  }

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const credited = await applyCreditPurchase({
    clientId,
    ownerId: subscription.ownerId,
    purchasedBy: userId,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntent,
    credits,
    amountCents: session.amount_total ?? null,
    currency: session.currency ?? null,
  });

  if (!credited) {
    // Ya estaba acreditada: reintento de Stripe. Normal.
    console.info("[stripe/webhook] recarga ya acreditada:", session.id);
  }
}

// ─── Suscripción ─────────────────────────────────────────────────────────────

/**
 * Encuentra la marca de una suscripción de Stripe.
 *
 * Se prueban tres caminos porque los eventos no llegan en orden: un
 * `customer.subscription.created` puede llegar **antes** que el
 * `checkout.session.completed` que iba a escribir el `stripe_subscription_id`,
 * y en ese momento la fila todavía no lo tiene.
 */
async function resolveClientId(subscription: Stripe.Subscription): Promise<string | null> {
  const metadataClientId = subscription.metadata?.client_id;
  if (metadataClientId) return metadataClientId;

  const bySub = await findByStripeSubscriptionId(subscription.id);
  if (bySub) return bySub.clientId;

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return null;

  const byCustomer = await findByStripeCustomerId(customerId);
  return byCustomer?.clientId ?? null;
}

async function syncSubscription(
  clientId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return;

  // ⚠️ El ciclo NO está en la suscripción sino en sus items desde la API
  // 2026-07-29.dahlia. `readSubscriptionPeriod` lo resuelve.
  const period = readSubscriptionPeriod(subscription);

  await applyStripeSubscription(clientId, {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    status: fromStripeStatus(subscription.status),
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    // ⚠️ NO `subscription.cancel_at_period_end` pelado: Stripe lo deja en
    // `false` y pone `cancel_at` cuando se cancela desde el Customer Portal.
    cancelAtPeriodEnd: readCancelAtPeriodEnd(subscription),
  });
}

async function onSubscriptionChanged(subscription: Stripe.Subscription): Promise<void> {
  const clientId = await resolveClientId(subscription);
  if (!clientId) {
    console.error("[stripe/webhook] suscripción sin marca:", subscription.id);
    return;
  }
  await syncSubscription(clientId, subscription);
}

async function onSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const clientId = await resolveClientId(subscription);
  if (!clientId) return;
  await markCanceled(clientId);
}

// ─── Facturas ────────────────────────────────────────────────────────────────

/**
 * `invoice.paid` limpia la deuda; `invoice.payment_failed` la abre y arranca el
 * periodo de gracia (solo la primera vez — Stripe reintenta el cobro varios
 * días y manda un evento por intento; si cada uno reiniciara el reloj, la marca
 * no se cortaría nunca).
 *
 * Una factura que no viene de una suscripción (una recarga suelta, por ejemplo)
 * se ignora sin ruido.
 */
async function onInvoice(invoice: Stripe.Invoice, outcome: "paid" | "failed"): Promise<void> {
  // ⚠️ `invoice.subscription` ya no existe en la API 2026-07-29.dahlia.
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const row = await findByStripeSubscriptionId(subscriptionId);
  if (!row) {
    console.warn("[stripe/webhook] factura de una suscripción desconocida:", subscriptionId);
    return;
  }

  if (outcome === "paid") {
    await markPaid(row.clientId);
  } else {
    await markPaymentFailed(row.clientId);
  }
}
