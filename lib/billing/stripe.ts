/**
 * Cliente de Stripe y todo lo que depende de variables de entorno (Fase E).
 *
 * ⚠️ SERVER-ONLY. `STRIPE_SECRET_KEY` **nunca** lleva prefijo `NEXT_PUBLIC`, y
 * este módulo no se importa desde ningún `"use client"`. El catálogo que la UI
 * necesita dibujar (paquetes, precios, etiquetas) vive en `lib/billing/plan.ts`,
 * que es puro.
 *
 * No hace falta publishable key ni Stripe.js: se usa **Checkout hospedado**, o
 * sea que el servidor crea la sesión y redirige a `checkout.stripe.com`. Menos
 * superficie en el browser y ningún dato de tarjeta pasa jamás por esta app.
 *
 * ## Los `price_...` son distintos en test y en producción
 *
 * Un precio de Stripe es un objeto, no un número: el `price_...` de la cuenta
 * de test no existe en la de live. En `.env.local` van los de test; en Netlify,
 * los de live. Cargar uno de test en producción **no da error**: cobra $0 y
 * confunde durante semanas.
 *
 * ## Dos trampas del SDK v22 (API 2026-07-29.dahlia)
 *
 * Las dos están encapsuladas acá abajo (`readSubscriptionPeriod` y
 * `subscriptionIdFromInvoice`) para que ningún handler tenga que acordarse:
 *
 *  1. `subscription.current_period_start/end` **ya no existe**. El ciclo vive
 *     ahora en cada item: `subscription.items.data[i].current_period_*`.
 *  2. `invoice.subscription` **ya no existe**. La referencia está en
 *     `invoice.parent.subscription_details.subscription`.
 *  3. `subscription.cancel_at_period_end` **puede quedar en `false` aunque el
 *     cliente haya cancelado**. Ver `readCancelAtPeriodEnd`.
 *
 * ## ⚠️ Y por qué las dos funciones leen TAMBIÉN el formato viejo
 *
 * Las llamadas que hace el SDK (`subscriptions.retrieve`, etc.) vuelven en la
 * versión que el SDK tiene pinneada. Pero **el JSON de los webhooks se arma con
 * la versión por defecto de la CUENTA**, que puede ser mucho más vieja — la de
 * Paco estaba en `2022-08-01`. O sea que el mismo objeto llega con una forma u
 * otra según por dónde entró.
 *
 * Si estas funciones solo entendieran el formato nuevo, `invoice.paid` e
 * `invoice.payment_failed` devolverían `null` y **no harían nada, en silencio**:
 * el corte por impago simplemente no ocurriría. Por eso las dos prueban el
 * formato nuevo primero y caen al viejo si no está.
 *
 * Se puede además forzar la versión nueva (`stripe listen --latest` en local, y
 * eligiendo la versión al registrar el endpoint en producción), pero eso es una
 * configuración que alguien puede cambiar sin darse cuenta. El código tolerante
 * es lo que sostiene la garantía.
 */

import Stripe from "stripe";
import { getCreditPack, type CreditPackKey } from "./plan";

export class StripeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeConfigError";
  }
}

function requireEnv(name: string, hint: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new StripeConfigError(`Falta ${name} en el servidor. ${hint}`);
  return value;
}

// ─── Cliente ─────────────────────────────────────────────────────────────────

let cached: Stripe | null = null;

/**
 * ¿Está Stripe configurado? Sirve para que el panel de `/clientes/[id]` muestre
 * un aviso claro en local en vez de tumbarse, igual que
 * `isServiceRoleConfigured()`.
 */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe(): Stripe {
  if (cached) return cached;

  const key = requireEnv(
    "STRIPE_SECRET_KEY",
    "Copiala de dashboard.stripe.com → Developers → API keys (sk_test_… en local, sk_live_… en Netlify).",
  );

  // Sin `apiVersion`: se usa la que el SDK trae pinneada (2026-07-29.dahlia en
  // la 22.x). Fijarla a mano acá y no actualizarla al subir de versión es la
  // forma más común de romper esto en silencio.
  cached = new Stripe(key, {
    // Aparece en el dashboard de Stripe junto a cada request. Vale oro cuando
    // hay que entender de dónde salió un cobro raro.
    appInfo: { name: "Guionizator Pro", url: "https://guionizator.pacocuevasia.com" },
  });

  return cached;
}

/** ¿Estamos apuntando a la cuenta de test? Se muestra en el panel de Paco. */
export function isTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY?.trim() ?? "").startsWith("sk_test_");
}

// ─── Precios ─────────────────────────────────────────────────────────────────

/** El `price_...` de la suscripción mensual de $300 MXN. */
export function subscriptionPriceId(): string {
  return requireEnv(
    "STRIPE_PRICE_SUBSCRIPTION",
    "Es el price_… del producto recurrente de $300 MXN/mes.",
  );
}

const PACK_ENV: Record<CreditPackKey, string> = {
  "20": "STRIPE_PRICE_CREDITS_20",
  "50": "STRIPE_PRICE_CREDITS_50",
};

/** El `price_...` de un paquete de recarga, a partir de su `key`. */
export function creditPriceId(key: CreditPackKey): string {
  return requireEnv(
    PACK_ENV[key],
    `Es el price_… del pago único del paquete de ${getCreditPack(key)?.credits} créditos.`,
  );
}

/**
 * Cuántos créditos vale un `price_...`.
 *
 * ⚠️ **Esta es la única fuente de la verdad al acreditar una recarga.** El
 * webhook llama acá con el price que vino en el evento de Stripe; jamás con un
 * número que haya mandado el browser. Si el número viniera del body, cualquiera
 * compraría el paquete de 20 y reclamaría 5000.
 *
 * Devuelve `null` si el price no es ninguno de los nuestros — un pago hecho con
 * un price viejo o de otra integración **no** acredita nada, y queda en el log.
 */
export function creditsForPriceId(priceId: string | null | undefined): number | null {
  if (!priceId) return null;

  for (const key of Object.keys(PACK_ENV) as CreditPackKey[]) {
    // Se leen sin `requireEnv`: si un paquete no está configurado, no matchea y
    // ya — no tiene sentido tumbar el webhook por eso.
    if (process.env[PACK_ENV[key]]?.trim() === priceId) {
      return getCreditPack(key)?.credits ?? null;
    }
  }

  return null;
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

/**
 * Valida la firma y devuelve el evento.
 *
 * ⚠️ `rawBody` tiene que ser el **cuerpo crudo** (`await req.text()`). Con
 * `req.json()` la firma nunca valida: el JSON re-serializado no es byte por
 * byte el que Stripe firmó, y el error que da (`No signatures found matching…`)
 * no dice nada de eso.
 *
 * ⚠️ El `whsec_...` es **distinto** en local (el que imprime `stripe listen`) y
 * en producción (el del endpoint registrado en el dashboard).
 */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  const secret = requireEnv(
    "STRIPE_WEBHOOK_SECRET",
    "En local lo imprime `stripe listen --forward-to localhost:3000/api/stripe/webhook`; en producción sale del endpoint registrado en el dashboard.",
  );

  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}

// ─── Lectura de objetos de Stripe (las dos trampas del SDK v22) ──────────────

export type SubscriptionPeriod = {
  /** ISO, o `null` si la suscripción todavía no tiene items facturables. */
  start: string | null;
  end: string | null;
};

/**
 * El ciclo de facturación de una suscripción.
 *
 * ⚠️ En la API `2026-07-29.dahlia` **`subscription.current_period_start/end` ya
 * no existe**: el periodo pasó a vivir en cada item
 * (`subscription.items.data[i].current_period_*`). Como acá siempre hay un solo
 * item (una marca = un plan), se toma el primero; si algún día hubiera varios,
 * se toma el que arranca más tarde, que es el que manda para el cupo.
 *
 * Si esto devuelve `{null, null}`, el cupo cae al mes calendario UTC de siempre
 * (ver `lib/portal/usage.ts`) en vez de quedarse sin referencia.
 */
export function readSubscriptionPeriod(subscription: Stripe.Subscription): SubscriptionPeriod {
  let start = 0;
  let end = 0;

  // Formato nuevo: el periodo vive en cada item. Con un solo item (una marca =
  // un plan) da igual, pero si hubiera varios manda el que arranca más tarde,
  // que es el que corresponde al cupo en curso.
  for (const item of subscription.items?.data ?? []) {
    const s = item.current_period_start ?? 0;
    const e = item.current_period_end ?? 0;
    if (s > start) start = s;
    if (e > end) end = e;
  }

  // Formato viejo (cuentas con una API version anterior a 2025-03): el periodo
  // estaba en la suscripción. El tipo del SDK ya no lo declara, de ahí el cast.
  if (!start || !end) {
    const legacy = subscription as unknown as {
      current_period_start?: number;
      current_period_end?: number;
    };
    if (!start) start = legacy.current_period_start ?? 0;
    if (!end) end = legacy.current_period_end ?? 0;
  }

  return {
    start: start ? new Date(start * 1000).toISOString() : null,
    end: end ? new Date(end * 1000).toISOString() : null,
  };
}

/**
 * El id de la suscripción que generó una factura.
 *
 * ⚠️ En la API `2026-07-29.dahlia` **`invoice.subscription` ya no existe**: la
 * referencia está en `invoice.parent.subscription_details.subscription`, y ese
 * campo puede venir como string o como objeto expandido.
 *
 * Devuelve `null` para facturas que no vienen de una suscripción (un pago
 * único, por ejemplo) — el handler de `invoice.*` las ignora sin hacer ruido.
 */
export function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // Formato nuevo.
  const sub = invoice.parent?.subscription_details?.subscription;
  if (sub) return typeof sub === "string" ? sub : sub.id;

  // Formato viejo: `invoice.subscription`, plano. El tipo del SDK ya no lo
  // declara, de ahí el cast. Sin esta rama, una cuenta con API version vieja
  // haría que invoice.paid / invoice.payment_failed no hicieran NADA.
  const legacy = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  if (legacy) return typeof legacy === "string" ? legacy : legacy.id;

  return null;
}

/**
 * ¿Esta suscripción se termina al cerrar el ciclo?
 *
 * ⚠️ **`subscription.cancel_at_period_end` NO alcanza.** Cuando el cliente
 * cancela desde el Customer Portal, Stripe puede expresarlo poniendo
 * `cancel_at` en la fecha de fin de ciclo y dejando `cancel_at_period_end` en
 * `false`. Visto en vivo el 2026-08-26 cancelando de verdad desde el portal:
 *
 *   status: "active", cancel_at_period_end: false,
 *   cancel_at: 1790436314  (= exactamente current_period_end),
 *   canceled_at: <ahora>,
 *   cancellation_details: { reason: "cancellation_requested" }
 *
 * Leyendo solo el booleano, la app no se entera de nada: sigue mostrando
 * "Activa" durante todo el mes que le queda, el cliente que acaba de cancelar
 * no ve ninguna confirmación (y vuelve a cancelar, o escribe preguntando), y en
 * el panel de Paco la marca parece sana hasta que un día desaparece. El corte
 * en sí NO se pierde — al llegar la fecha Stripe manda
 * `customer.subscription.deleted` y el webhook escribe `canceled` — pero
 * durante un ciclo entero la pantalla miente.
 *
 * Se toma el OR de las dos formas. `cancel_at` en el pasado también cuenta:
 * significa que ya está por terminar.
 */
export function readCancelAtPeriodEnd(subscription: Stripe.Subscription): boolean {
  if (subscription.cancel_at_period_end) return true;
  return Boolean(subscription.cancel_at);
}

/** Timestamp de Stripe (segundos) → ISO, o `null`. */
export function toIso(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}
