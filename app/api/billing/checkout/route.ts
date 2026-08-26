/**
 * `POST /api/billing/checkout` — el alta de una marca.
 *
 * Devuelve la URL del Checkout hospedado de Stripe; el browser redirige ahí. No
 * hay Stripe.js ni publishable key: ningún dato de tarjeta pasa por esta app.
 *
 * Autenticada **por sesión** ⇒ **no** va en `PUBLIC_PATHS`.
 *
 * ## Por qué cualquier miembro puede llamarla
 *
 * Es lo que resuelve "solo el primero paga" sin contar personas: no hay lógica
 * de "¿es el primero?", hay lógica de "¿la marca ya está pagada?". Si lo está,
 * el segundo miembro nunca ve la pantalla de pago y entra gratis; si no lo
 * está, el que llegue puede pagar y **queda como contacto de facturación** (lo
 * fija el webhook con el `user_id` del metadata).
 *
 * Si dos miembros pagan a la vez, Stripe crea dos suscripciones para el mismo
 * customer. Es el único caso de doble cobro posible y se resuelve cancelando
 * una desde el dashboard — se prefiere eso a bloquear el alta con un lock que
 * dejaría a una marca sin poder pagar si se traba.
 */

import { NextResponse } from "next/server";
import { getStripe, subscriptionPriceId } from "@/lib/billing/stripe";
import { getBillingState } from "@/lib/billing/access";
import {
  BillingRouteError,
  ensureStripeCustomer,
  errorResponse,
  readJsonBody,
  requestOrigin,
  requireBillingContext,
  requireString,
} from "../_shared";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const clientId = requireString(body, "clientId", "la marca");

    const ctx = await requireBillingContext(clientId);

    // Ya está paga (o es interna): no tiene sentido mandarla al Checkout otra
    // vez. Para cambiar la tarjeta está el Customer Portal.
    const state = await getBillingState(clientId);
    if (state.reason === "exempt") {
      throw new BillingRouteError("Esta marca no requiere pago.", 409);
    }
    // ⚠️ Cualquier estado con una suscripción VIVA en Stripe (`active`, `grace`
    // o `unpaid`) tiene que ir al Customer Portal, no a un Checkout nuevo: un
    // segundo Checkout crea una SEGUNDA suscripción para el mismo customer y el
    // cliente termina pagando dos veces. Solo `canceled` y `none` pueden dar de
    // alta.
    if (
      state.reason === "active" ||
      state.reason === "grace" ||
      (state.reason === "unpaid" && ctx.subscription.stripeSubscriptionId)
    ) {
      throw new BillingRouteError(
        "Esta marca ya tiene una suscripción. Para actualizar la tarjeta usa 'Gestionar suscripción'.",
        409,
      );
    }

    const customerId = await ensureStripeCustomer(ctx);
    const origin = await requestOrigin();

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: subscriptionPriceId(), quantity: 1 }],

      // Solo tarjeta: es el único método que soporta cobro recurrente
      // automático. Sumar OXXO o SPEI exigiría manejar el pago asíncrono
      // (`checkout.session.async_payment_succeeded`) en el webhook.
      payment_method_types: ["card"],

      // Cupones desde el dashboard, sin tocar código: es la forma acordada de
      // hacer excepciones de precio en vez de un price por marca.
      allow_promotion_codes: true,

      // El webhook lee estos dos. Los escribe el servidor, nunca el browser.
      metadata: { client_id: clientId, user_id: ctx.user.id },

      // ⚠️ También en la suscripción: los eventos `customer.subscription.*`
      // pueden llegar ANTES que `checkout.session.completed`, y en ese momento
      // la fila todavía no tiene el `stripe_subscription_id` para buscarla.
      subscription_data: {
        metadata: { client_id: clientId, user_id: ctx.user.id },
      },

      success_url: `${origin}/portal/${clientId}?pago=ok`,
      cancel_url: `${origin}/portal/suscripcion/${clientId}?cancelado=1`,
    });

    if (!session.url) {
      throw new BillingRouteError("Stripe no devolvió una URL de pago.", 502);
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return errorResponse(e);
  }
}
