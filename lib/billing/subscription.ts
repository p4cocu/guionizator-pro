/**
 * La suscripción de una marca (Fase E) — único acceso a `client_subscriptions`.
 *
 * ⚠️ SERVER-ONLY: usa **service role** en todo. `client_subscriptions` tiene RLS
 * activa y **ninguna policy** (migración `0013`), igual que `client_secrets` y
 * `portal_profiles`: nadie llega con la anon key. Y como el service role saltea
 * la RLS, **toda** consulta de acá filtra la pertenencia a mano.
 *
 * Por qué no hay policy de lectura para el contacto de facturación, que en
 * teoría podría ver su propia fila: con su JWT y la anon key puede llamar a
 * PostgREST directo, y una policy de select se convierte en policy de update en
 * cuanto alguien se equivoca. `credit_balance` es dinero: se lee por server
 * action y listo. Es la misma regla que ya rige `ai_usage_log`.
 *
 * `getSubscription` va envuelto en `cache()` de React porque se consulta en
 * CADA request del portal (el gate de `requirePortalClient`), y sin eso serían
 * varias consultas por navegación.
 */

import { cache } from "react";
import { createServiceClient } from "../supabase/service";
import { GRACE_DAYS } from "./plan";
import {
  sanitizeSubscriptionStatus,
  type SubscriptionStatus,
} from "./status";

export class BillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingError";
  }
}

export type ClientSubscription = {
  clientId: string;
  ownerId: string;
  /** Quién pagó. Único que compra créditos y ve la facturación. */
  billingContactUserId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  /** Marca interna o de cortesía: no paga, no se corta y no tiene topes. */
  exempt: boolean;
  /** Inicio del ciclo (ISO). Es la referencia del cupo, ya no el mes calendario. */
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  /** Hasta cuándo entra a pesar de que falló el cobro. `null` = no hay deuda. */
  graceUntil: string | null;
  cancelAtPeriodEnd: boolean;
  /** Saldo de recargas compradas. No vence. */
  creditBalance: number;
};

type Row = {
  client_id: string;
  owner_id: string;
  billing_contact_user_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
  exempt: boolean | null;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_until: string | null;
  cancel_at_period_end: boolean | null;
  credit_balance: number | null;
};

const COLUMNS =
  "client_id, owner_id, billing_contact_user_id, stripe_customer_id, stripe_subscription_id, status, exempt, current_period_start, current_period_end, grace_until, cancel_at_period_end, credit_balance";

function toSubscription(row: Row): ClientSubscription {
  return {
    clientId: row.client_id,
    ownerId: row.owner_id,
    billingContactUserId: row.billing_contact_user_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    status: sanitizeSubscriptionStatus(row.status),
    exempt: row.exempt === true,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    graceUntil: row.grace_until,
    cancelAtPeriodEnd: row.cancel_at_period_end === true,
    creditBalance: row.credit_balance ?? 0,
  };
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

/**
 * La suscripción de una marca, o `null` si no tiene fila.
 *
 * `null` es un estado normal, no un error: pasa con una marca creada antes de
 * que `ensureSubscription` existiera, o si alguien borró la fila a mano. Quien
 * llama lo trata como "sin suscripción" ⇒ hay que pagar (ver `access.ts`), que
 * es fallar cerrado.
 */
export const getSubscription = cache(
  (clientId: string): Promise<ClientSubscription | null> => readSubscription(clientId),
);

/**
 * Igual, **sin** el `cache()` de React.
 *
 * Hace falta en los caminos que leen y después escriben (el webhook, el
 * consumo de un crédito): `patch()` no invalida el cache de React, así que una
 * segunda lectura cacheada dentro del mismo request devolvería el estado
 * anterior. En las pantallas siempre se usa la versión cacheada.
 */
export async function readSubscription(clientId: string): Promise<ClientSubscription | null> {
  const { data, error } = await createServiceClient()
    .from("client_subscriptions")
    .select(COLUMNS)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throw new BillingError(error.message);
  return data ? toSubscription(data as Row) : null;
}

/** Igual, pero validando que la marca sea de ese dueño. Para el panel de Paco. */
export async function getSubscriptionForOwner(
  clientId: string,
  ownerId: string,
): Promise<ClientSubscription | null> {
  const sub = await getSubscription(clientId);
  if (!sub || sub.ownerId !== ownerId) return null;
  return sub;
}

/**
 * Busca por el id de Stripe. Lo usa el webhook, que no sabe de `client_id`:
 * llega con un `sub_...` o un `cus_...` y tiene que encontrar la marca.
 */
async function findBy(
  column: "stripe_subscription_id" | "stripe_customer_id",
  value: string,
): Promise<ClientSubscription | null> {
  const { data, error } = await createServiceClient()
    .from("client_subscriptions")
    .select(COLUMNS)
    .eq(column, value)
    .maybeSingle();

  if (error) throw new BillingError(error.message);
  return data ? toSubscription(data as Row) : null;
}

export function findByStripeSubscriptionId(id: string) {
  return findBy("stripe_subscription_id", id);
}

export function findByStripeCustomerId(id: string) {
  return findBy("stripe_customer_id", id);
}

// ─── Alta de la fila ─────────────────────────────────────────────────────────

/**
 * Garantiza que la marca tenga fila de suscripción.
 *
 * La migración `0013` hizo el backfill de todas las marcas que existían, pero
 * una marca creada después necesita la suya. Se llama desde `createCliente`.
 *
 * **Nace sin exención**: una marca nueva es de un cliente que va a pagar. Las
 * marcas propias de Paco se marcan exentas a mano desde el panel — es un clic y
 * es mejor que el default silencioso al revés (una marca que debía pagar y
 * nunca pagó porque nadie se acordó de sacarle la exención).
 */
export async function ensureSubscription(clientId: string, ownerId: string): Promise<void> {
  const { error } = await createServiceClient()
    .from("client_subscriptions")
    .upsert(
      { client_id: clientId, owner_id: ownerId },
      { onConflict: "client_id", ignoreDuplicates: true },
    );

  if (error) throw new BillingError(error.message);
}

// ─── Escritura ───────────────────────────────────────────────────────────────

/** Todo update pasa por acá para no olvidarse nunca de `updated_at`. */
async function patch(clientId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await createServiceClient()
    .from("client_subscriptions")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("client_id", clientId);

  if (error) throw new BillingError(error.message);
}

/**
 * Marca interna o de cortesía. Es la única decisión de negocio de esta tabla:
 * ningún evento de Stripe la toca (por eso `exempt` es columna aparte y no un
 * valor de `status` — ver la migración `0013`).
 *
 * Se valida el dueño a mano: el service role no tiene RLS debajo.
 */
export async function setExempt(
  clientId: string,
  ownerId: string,
  exempt: boolean,
): Promise<void> {
  const sub = await getSubscriptionForOwner(clientId, ownerId);
  if (!sub) throw new BillingError("Esa marca no es tuya o no tiene suscripción.");
  await patch(clientId, { exempt });
}

/** Quién paga y ve la facturación. Lo fija el Checkout y lo puede corregir Paco. */
export async function setBillingContact(
  clientId: string,
  userId: string | null,
): Promise<void> {
  await patch(clientId, { billing_contact_user_id: userId });
}

/**
 * Deja anotado el `cus_...` antes de mandar a alguien al Checkout.
 *
 * Sin esto, un cliente que abandona el Checkout y vuelve a intentar generaría
 * un customer nuevo cada vez, y el dashboard de Stripe termina con cinco
 * clientes duplicados para la misma marca.
 */
export async function setStripeCustomerId(clientId: string, customerId: string): Promise<void> {
  await patch(clientId, { stripe_customer_id: customerId });
}

export type StripeSubscriptionSnapshot = {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

/**
 * Espeja en la base lo que dice Stripe. Lo llama SOLO el webhook.
 *
 * ⚠️ **Los webhooks no llegan en orden.** `invoice.paid` puede llegar antes que
 * `checkout.session.completed`, y un `customer.subscription.updated` viejo puede
 * llegar después de uno nuevo. Por eso esto es un update plano e idempotente
 * que no lee el estado anterior ni asume que otro handler ya corrió.
 *
 * `grace_until` se limpia sola cuando el estado vuelve a `active`: si Stripe
 * dice que está al día, la deuda ya no existe.
 */
export async function applyStripeSubscription(
  clientId: string,
  snapshot: StripeSubscriptionSnapshot,
): Promise<void> {
  await patch(clientId, {
    stripe_subscription_id: snapshot.stripeSubscriptionId,
    stripe_customer_id: snapshot.stripeCustomerId,
    status: snapshot.status,
    current_period_start: snapshot.currentPeriodStart,
    current_period_end: snapshot.currentPeriodEnd,
    cancel_at_period_end: snapshot.cancelAtPeriodEnd,
    ...(snapshot.status === "active" ? { grace_until: null } : {}),
  });
}

/**
 * Falló un cobro: `past_due` y arranca la gracia.
 *
 * ⚠️ La gracia se pone **solo si no había una corriendo**. Stripe reintenta el
 * cobro varias veces durante días y manda un `invoice.payment_failed` por cada
 * intento: si cada uno reiniciara el reloj, la marca nunca se cortaría.
 */
export async function markPaymentFailed(clientId: string): Promise<void> {
  // Lectura fresca a propósito: si en este mismo request ya se escribió la fila
  // (dos eventos en el mismo webhook), la versión cacheada estaría vieja.
  const sub = await readSubscription(clientId);
  const graceUntil =
    sub?.graceUntil ?? new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await patch(clientId, { status: "past_due", grace_until: graceUntil });
}

/** Se pagó: al día y sin deuda. */
export async function markPaid(clientId: string): Promise<void> {
  await patch(clientId, { status: "active", grace_until: null });
}

/** Se dio de baja o Stripe agotó los reintentos. */
export async function markCanceled(clientId: string): Promise<void> {
  await patch(clientId, { status: "canceled", cancel_at_period_end: false });
}
