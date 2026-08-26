/**
 * `POST /api/billing/credits` — comprar una recarga de créditos.
 *
 * Pago único (`mode: "payment"`), no recurrente. Los créditos **no vencen**: se
 * usan cuando ya se agotó el cupo del ciclo.
 *
 * Autenticada **por sesión** ⇒ **no** va en `PUBLIC_PATHS`. Y además solo el
 * **contacto de facturación** (o el dueño) puede comprarla: la plata la maneja
 * quien pagó, no cualquiera con acceso al portal.
 *
 * ## Lo único que viaja del browser es el `key` del paquete
 *
 * Ni el precio ni la cantidad de créditos. El servidor traduce ese `key` a un
 * `price_...` y, al acreditar, el webhook saca los créditos del price que
 * Stripe **efectivamente cobró** (`creditsForPriceId`). Si el número viniera del
 * body, cualquiera compraría el paquete de 20 y reclamaría 5000.
 */

import { NextResponse } from "next/server";
import { creditPriceId, getStripe } from "@/lib/billing/stripe";
import { getBillingState } from "@/lib/billing/access";
import { getCreditPack, isCreditPackKey } from "@/lib/billing/plan";
import {
  assertBillingContact,
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
    const packKey = requireString(body, "pack", "el paquete");

    if (!isCreditPackKey(packKey)) {
      throw new BillingRouteError("Ese paquete no existe.");
    }
    const pack = getCreditPack(packKey);
    if (!pack) throw new BillingRouteError("Ese paquete no existe.");

    const ctx = await requireBillingContext(clientId);
    assertBillingContact(ctx);

    // Una marca interna no compra créditos: no tiene tope que agotar.
    const state = await getBillingState(clientId);
    if (state.reason === "exempt") {
      throw new BillingRouteError("Esta marca no tiene tope de generaciones.", 409);
    }

    // Recargar con la suscripción caída sería vender créditos que no va a poder
    // usar: primero hay que reactivar. Durante la gracia sí se permite — puede
    // ser justo lo que necesita para terminar la semana.
    if (state.reason !== "active" && state.reason !== "grace") {
      throw new BillingRouteError(
        "Necesitas una suscripción activa para comprar créditos.",
        409,
      );
    }

    const customerId = await ensureStripeCustomer(ctx);
    const origin = await requestOrigin();

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: creditPriceId(packKey), quantity: 1 }],
      payment_method_types: ["card"],

      // El webhook lee estos dos; los créditos los saca del price, no de acá.
      metadata: { client_id: clientId, user_id: ctx.user.id, pack: packKey },

      success_url: `${origin}/portal/${clientId}/facturacion?recarga=ok`,
      cancel_url: `${origin}/portal/${clientId}/facturacion?recarga=cancelada`,
    });

    if (!session.url) {
      throw new BillingRouteError("Stripe no devolvió una URL de pago.", 502);
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return errorResponse(e);
  }
}
