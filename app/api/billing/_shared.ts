/**
 * Piezas compartidas de `/api/billing/*` (Fase E).
 *
 * Las tres rutas se autentican **por sesión** ⇒ **no** van en `PUBLIC_PATHS`.
 * La única del cobro que sí va ahí es el webhook, que se autentica por firma.
 *
 * ⚠️ Una route handler es un endpoint público: que la UI no dibuje el botón no
 * impide que alguien la invoque con curl. Por eso el acceso se revalida acá y
 * nunca se confía en la pantalla — misma disciplina que
 * `requireGenerationAccess`.
 */

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getPortalClient, requirePortalSession, type PortalClient } from "@/lib/portal/access";
import { getSubscription, ensureSubscription } from "@/lib/billing/subscription";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import type { ClientSubscription } from "@/lib/billing/subscription";

export class BillingRouteError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "BillingRouteError";
    this.status = status;
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof BillingRouteError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error("[api/billing] error inesperado:", e);
  return NextResponse.json({ error: "No se pudo procesar el pago." }, { status: 500 });
}

/**
 * Origen para armar las URLs de vuelta del Checkout. Se prefiere el host real
 * del request (funciona igual en localhost y en producción) y se cae a
 * `NEXT_PUBLIC_SITE_URL`. Mismo patrón que el link de invitación.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}`;

  const fallback = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!fallback) throw new BillingRouteError("No se pudo determinar la URL del sitio.", 500);
  return fallback;
}

export type BillingContext = {
  user: User;
  client: PortalClient;
  subscription: ClientSubscription;
};

/**
 * Sesión + acceso a la marca + fila de suscripción.
 *
 * **Cualquier miembro puede llegar hasta acá**, no solo el contacto de
 * facturación: es lo que hace que el primero que entra pueda pagar. Quién puede
 * comprar recargas o abrir el portal de Stripe se filtra aparte, con
 * `assertBillingContact`.
 */
export async function requireBillingContext(clientId: string): Promise<BillingContext> {
  if (!isStripeConfigured()) {
    throw new BillingRouteError("Los pagos no están configurados en este entorno.", 503);
  }

  const { user } = await requirePortalSession();
  const client = await getPortalClient(user.id, clientId);

  // 404 y no 403: no le confirmamos a nadie que esa marca existe.
  if (!client) throw new BillingRouteError("Esa marca no existe.", 404);

  // Una marca creada antes de que existiera `ensureSubscription` puede no tener
  // fila. Se crea al vuelo en vez de fallar: el `owner_id` sale de la propia
  // marca, así que no hay nada que adivinar.
  let subscription = await getSubscription(clientId);
  if (!subscription) {
    const ownerId = await resolveOwnerId(clientId);
    await ensureSubscription(clientId, ownerId);
    subscription = await getSubscription(clientId);
  }

  if (!subscription) {
    throw new BillingRouteError("No se pudo preparar la suscripción de esta marca.", 500);
  }

  return { user, client, subscription };
}

/**
 * Solo el contacto de facturación (o el dueño, que ve todo) puede comprar
 * créditos y abrir el portal de Stripe. Decisión de producto: la plata la
 * maneja quien pagó, no cualquiera con acceso al portal.
 */
export function assertBillingContact(ctx: BillingContext): void {
  const esDueño = ctx.client.role === "owner";
  const esContacto = ctx.subscription.billingContactUserId === ctx.user.id;

  if (!esDueño && !esContacto) {
    throw new BillingRouteError(
      "Solo quien contrató la suscripción puede hacer esto. Pídeselo a esa persona.",
      403,
    );
  }
}

/**
 * `owner_id` de una marca, con service role. El miembro no puede leer `clients`
 * (esa tabla trae notas internas), así que no hay forma de sacarlo con su
 * sesión.
 */
async function resolveOwnerId(clientId: string): Promise<string> {
  const { createServiceClient } = await import("@/lib/supabase/service");
  const { data, error } = await createServiceClient()
    .from("clients")
    .select("owner_id")
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw new BillingRouteError(error.message, 500);
  if (!data) throw new BillingRouteError("Esa marca no existe.", 404);
  return data.owner_id as string;
}

/**
 * El `cus_...` de la marca, creándolo si hace falta.
 *
 * Se guarda en `client_subscriptions` **antes** de mandar a nadie al Checkout:
 * sin eso, un cliente que abandona el pago y vuelve a intentar genera un
 * customer nuevo cada vez, y el dashboard de Stripe termina con cinco clientes
 * duplicados para la misma marca (y las recargas repartidas entre ellos).
 */
export async function ensureStripeCustomer(ctx: BillingContext): Promise<string> {
  if (ctx.subscription.stripeCustomerId) return ctx.subscription.stripeCustomerId;

  const customer = await getStripe().customers.create({
    email: ctx.user.email ?? undefined,
    // El nombre de la marca, no el de la persona: la suscripción es por marca.
    name: ctx.client.marca?.trim() || ctx.client.nombre,
    metadata: { client_id: ctx.client.id, user_id: ctx.user.id },
  });

  const { setStripeCustomerId } = await import("@/lib/billing/subscription");
  await setStripeCustomerId(ctx.client.id, customer.id);

  return customer.id;
}

/**
 * Body JSON de la request. Una sola lectura: el cuerpo de una `Request` es un
 * stream y se consume, así que llamar dos veces devolvería vacío.
 */
export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return (body ?? {}) as Record<string, unknown>;
  } catch {
    throw new BillingRouteError("Cuerpo inválido.");
  }
}

export function requireString(
  body: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new BillingRouteError(`Falta ${label}.`);
  }
  return value.trim();
}
