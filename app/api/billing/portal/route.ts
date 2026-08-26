/**
 * `POST /api/billing/portal` — abre el Stripe Customer Portal.
 *
 * Es la página hospedada de Stripe donde el cliente cambia su tarjeta, ve sus
 * recibos y cancela solo. Se decidió el portal **completo** (con cancelación):
 * esconder el botón de cancelar retiene un poco más, pero se lee como mala fe y
 * el soporte de "se me venció la tarjeta" cuesta más que la retención.
 *
 * ⚠️ Hay que habilitarlo una vez en el dashboard de Stripe
 * (Settings → Billing → Customer portal) o esta llamada falla con
 * "No configuration provided". Se configura por separado en test y en live.
 *
 * Autenticada **por sesión** ⇒ **no** va en `PUBLIC_PATHS`. Solo el contacto de
 * facturación (o el dueño): desde acá se puede cancelar la suscripción de toda
 * la marca.
 */

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import {
  assertBillingContact,
  BillingRouteError,
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
    assertBillingContact(ctx);

    // Sin `cus_...` no hay nada que gestionar: nunca pasó por el Checkout.
    if (!ctx.subscription.stripeCustomerId) {
      throw new BillingRouteError("Esta marca todavía no tiene una suscripción.", 409);
    }

    const origin = await requestOrigin();

    const session = await getStripe().billingPortal.sessions.create({
      customer: ctx.subscription.stripeCustomerId,
      return_url: `${origin}/portal/${clientId}/facturacion`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return errorResponse(e);
  }
}
