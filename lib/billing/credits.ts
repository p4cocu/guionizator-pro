/**
 * Saldo de recargas (Fase E).
 *
 * ⚠️ SERVER-ONLY: service role. `credit_purchases` y `client_subscriptions`
 * tienen RLS activa y ninguna policy (migración `0013`).
 *
 * ## Cómo se reparte el consumo entre el plan y las recargas
 *
 * El cupo del plan se reinicia cada ciclo de facturación y **se pierde**; las
 * recargas **no vencen** y viven en `client_subscriptions.credit_balance`. Al
 * generar:
 *
 *   usadoEnCiclo < tope del plan  → gasta plan   (ai_usage_log.paid_with = 'plan')
 *   usadoEnCiclo >= tope del plan → gasta recarga (paid_with = 'credit')
 *
 * Por eso el saldo es un contador y no un cálculo: derivar "cuántos comprados
 * quedan" exigiría recorrer todos los ciclos cerrados sumando excedentes.
 *
 * ## Por qué se descuenta DESPUÉS de que la IA respondió
 *
 * Se mantiene la asimetría que ya tenía el add-on: **chequear antes** de llamar
 * a la API (pasarse no gasta tokens) y **registrar después** de que respondió
 * (un error de la API no le cuesta el cupo al cliente). Con dinero de por medio
 * eso importa más, no menos.
 *
 * La contra conocida sigue igual: dos pestañas en paralelo pueden pasar el
 * chequeo antes de que ninguna haya descontado. Pero el peor caso cambió para
 * mejor: el `where credit_balance > 0` del UPDATE hace que el segundo descuento
 * simplemente no matchee, así que el saldo **nunca queda negativo** — como
 * máximo se regala una generación, que ya se pagó a Anthropic igual.
 */

import { createServiceClient } from "../supabase/service";
import { BillingError, readSubscription } from "./subscription";

/** Saldo actual de recargas. `0` si la marca no tiene fila de suscripción. */
export async function getCreditBalance(clientId: string): Promise<number> {
  const sub = await readSubscription(clientId);
  return sub?.creditBalance ?? 0;
}

/**
 * Descuenta un crédito comprado, atómicamente.
 *
 * El `where credit_balance > 0` es lo que hace la operación segura sin
 * transacción ni función: Postgres resuelve el UPDATE fila por fila, así que
 * dos requests simultáneos no pueden llevarse el mismo último crédito.
 *
 * Devuelve `true` si descontó, `false` si no había saldo. **Nunca lanza por
 * falta de saldo** — quien llama decide qué hacer con eso.
 */
export async function consumeCredit(clientId: string): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .rpc("consume_client_credit", { p_client_id: clientId });

  if (error) throw new BillingError(error.message);
  return data === true;
}

export type CreditPurchaseInput = {
  clientId: string;
  ownerId: string;
  /** Quién apretó comprar. `null` si Stripe no mandó el metadata. */
  purchasedBy: string | null;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  /** ⚠️ Sale del `price_id` del evento, NUNCA del body del browser. */
  credits: number;
  amountCents: number | null;
  currency: string | null;
};

/**
 * Acredita una recarga pagada.
 *
 * Las dos escrituras (la fila de la compra y el saldo) van dentro de la función
 * `apply_credit_purchase` de la migración `0013`, o sea **en una sola
 * transacción**. Hechas por separado desde acá había un hueco real: si la
 * primera entraba y la segunda fallaba, el reintento de Stripe chocaba con el
 * unique, se leía como "ya acreditado", y el cliente pagaba por créditos que
 * nunca recibía.
 *
 * Devuelve `true` si acreditó y `false` si ese `checkout_session_id` ya estaba
 * — que es lo normal cuando Stripe reenvía un evento. El webhook responde 200
 * en los dos casos.
 */
export async function applyCreditPurchase(input: CreditPurchaseInput): Promise<boolean> {
  const { data, error } = await createServiceClient().rpc("apply_credit_purchase", {
    p_client_id: input.clientId,
    p_owner_id: input.ownerId,
    p_purchased_by: input.purchasedBy,
    p_session_id: input.stripeCheckoutSessionId,
    p_payment_intent_id: input.stripePaymentIntentId,
    p_credits: input.credits,
    p_amount_cents: input.amountCents,
    p_currency: input.currency ?? "mxn",
  });

  if (error) throw new BillingError(error.message);
  return data === true;
}

export type CreditPurchase = {
  id: string;
  credits: number;
  amountCents: number | null;
  currency: string;
  createdAt: string;
};

/**
 * Historial de recargas de una marca, de la más nueva a la más vieja.
 *
 * `ownerId` se filtra a mano además del `clientId`: el service role no tiene
 * RLS debajo y esta lista se muestra tanto en el panel de Paco como en la
 * pantalla de facturación del cliente.
 */
export async function listCreditPurchases(
  clientId: string,
  ownerId: string,
  limit = 12,
): Promise<CreditPurchase[]> {
  const { data, error } = await createServiceClient()
    .from("credit_purchases")
    .select("id, credits, amount_cents, currency, created_at")
    .eq("client_id", clientId)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new BillingError(error.message);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    credits: r.credits as number,
    amountCents: (r.amount_cents as number | null) ?? null,
    currency: (r.currency as string) ?? "mxn",
    createdAt: r.created_at as string,
  }));
}
