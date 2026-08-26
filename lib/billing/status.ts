/**
 * Estado de la suscripción de una marca (Fase E).
 *
 * Módulo **puro**: sin Stripe, sin Supabase. Vive aparte de
 * `lib/billing/subscription.ts` por el mismo motivo que `lib/portal/roles.ts`
 * vive aparte de `members.ts` — ese módulo importa el service role, y un
 * componente `"use client"` que quisiera una etiqueta se lo llevaría al bundle
 * del browser.
 *
 * Espeja el `CHECK` de `client_subscriptions.status` (migración `0013`):
 *   check (status in ('incomplete','active','past_due','canceled'))
 *
 * ⚠️ REGLA DURA (CLAUDE.md): agregar, renombrar o borrar un valor de acá OBLIGA
 * a entregar en el MISMO cambio el `ALTER TABLE … DROP/ADD CONSTRAINT
 * client_subscriptions_status_check` y la fila de la tabla de `CLAUDE.md`. Si
 * no, el primer UPDATE del webhook revienta con error de servidor en runtime, y
 * como Stripe reintenta un rato y después se rinde, la suscripción queda a
 * medias sin que nadie se entere.
 */

/**
 * Unión cerrada a propósito: si alguien renombra un valor sin tocar el CHECK,
 * el error aparece en `tsc` y no en producción.
 */
export type SubscriptionStatus = "incomplete" | "active" | "past_due" | "canceled";

export const SUBSCRIPTION_STATUSES: {
  value: SubscriptionStatus;
  label: string;
  description: string;
}[] = [
  {
    value: "incomplete",
    label: "Sin activar",
    description: "Nunca completó el pago. No entra al portal.",
  },
  {
    value: "active",
    label: "Al día",
    description: "Pagó y el ciclo está corriendo.",
  },
  {
    value: "past_due",
    label: "Pago vencido",
    description:
      "Falló el cobro. Sigue entrando durante el periodo de gracia, con aviso; después se corta.",
  },
  {
    value: "canceled",
    label: "Cancelada",
    description: "Se dio de baja o Stripe agotó los reintentos. No entra al portal.",
  },
];

/** Chequeo de compilación: la lista cubre EXACTAMENTE la unión. */
const _coverage: Record<SubscriptionStatus, true> = {
  incomplete: true,
  active: true,
  past_due: true,
  canceled: true,
};
void _coverage;

const BY_VALUE = new Map<string, (typeof SUBSCRIPTION_STATUSES)[number]>(
  SUBSCRIPTION_STATUSES.map((s) => [s.value, s]),
);

export function isSubscriptionStatus(value: string): value is SubscriptionStatus {
  return BY_VALUE.has(value);
}

export function subscriptionStatusLabel(value: string): string {
  return BY_VALUE.get(value)?.label ?? value;
}

/**
 * Sanea cualquier cosa que venga de la base. Nunca lanza: una fila con un valor
 * raro (escrito a mano en el SQL Editor, por ejemplo) cae a `incomplete`, que es
 * el estado que NO da acceso — falla cerrado, como el token global de Apify.
 */
export function sanitizeSubscriptionStatus(value: string | null | undefined): SubscriptionStatus {
  return value && isSubscriptionStatus(value) ? value : "incomplete";
}

/**
 * Traduce los 8 estados de Stripe a los 4 nuestros.
 *
 * Stripe maneja `incomplete`, `incomplete_expired`, `trialing`, `active`,
 * `past_due`, `canceled`, `unpaid` y `paused`. Guardar los 8 obligaría a que
 * cada lectura entienda las diferencias entre `unpaid` y `past_due`, o entre
 * `paused` y `canceled`, y la mayoría son estados que este producto no puede
 * alcanzar (no hay prueba gratis, así que `trialing` no debería aparecer nunca).
 *
 * Los casos que no son obvios y por qué caen donde caen:
 *
 *  - `trialing`  → `active`. Defensivo: si algún día se prende una prueba desde
 *                  el dashboard de Stripe sin tocar código, el cliente entra en
 *                  vez de quedarse afuera.
 *  - `unpaid`    → `past_due`. Stripe llega acá cuando agotó los reintentos
 *                  pero la suscripción sigue viva. Se trata como vencida: la
 *                  gracia ya corrió desde el primer fallo, así que el corte cae
 *                  igual por `grace_until`.
 *  - `paused`    → `past_due`. Solo ocurre si una prueba termina sin método de
 *                  pago. Mismo criterio: no da acceso indefinido.
 *  - `incomplete_expired` → `canceled`. Es terminal en Stripe: nunca pagó la
 *                  primera factura y ya no va a poder.
 *  - Cualquier valor desconocido → `incomplete`. Falla cerrado: si Stripe
 *                  agrega un estado nuevo, nadie entra gratis por accidente.
 */
export function fromStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
    case "paused":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
      return "incomplete";
    default:
      return "incomplete";
  }
}
