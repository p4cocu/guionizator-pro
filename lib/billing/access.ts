/**
 * ¿Esta marca puede usar el portal? (Fase E)
 *
 * Único lugar que responde esa pregunta. Todo `/portal/**` pasa por acá, igual
 * que todo pasa por `lib/portal/access.ts` para saber a qué marcas tiene acceso
 * el usuario. Los dos candados son distintos y se suman:
 *
 *   lib/portal/access.ts  → ¿es tuya esta marca? ¿está prendida esta sección?
 *   lib/billing/access.ts → ¿está pagada?
 *
 * ⚠️ SERVER-ONLY (lee `client_subscriptions` con service role).
 *
 * ## El corte se calcula en lectura, no hay cron
 *
 * `grace_until` es una fecha en la fila; el corte es `now() >= grace_until`. No
 * hay job que pueda atascarse y dejar entrando gratis a una marca que no pagó,
 * ni uno que corte de más si se ejecuta dos veces. El único que escribe esa
 * fecha es el webhook, al primer `invoice.payment_failed`.
 *
 * ## La bandera `BILLING_ENFORCED`
 *
 * Con la bandera apagada el corte no aplica: se devuelve siempre `ok`, pero el
 * ciclo y los topes se calculan igual. Es lo que permite deployar toda la
 * maquinaria de cobro a producción y encenderla después, en vez de que el
 * primer deploy sea también el primer corte.
 */

import {
  getSubscription,
  type ClientSubscription,
} from "./subscription";

/**
 * ¿Está encendido el corte por impago?
 *
 * Se lee en cada llamada y no se cachea a propósito: apagarla tiene que surtir
 * efecto con un redeploy, no con un reinicio de proceso.
 */
export function billingEnforced(): boolean {
  return process.env.BILLING_ENFORCED?.trim() === "true";
}

export type BillingReason =
  /** Marca interna o de cortesía. Nunca se corta y no tiene topes. */
  | "exempt"
  /** Pagada y al día. */
  | "active"
  /** Falló el cobro pero todavía está dentro del periodo de gracia. */
  | "grace"
  /** Falló el cobro y la gracia ya venció. */
  | "unpaid"
  /** Se dio de baja, o Stripe agotó los reintentos. */
  | "canceled"
  /** Nunca completó el pago, o la marca no tiene fila de suscripción. */
  | "none";

export type BillingState = {
  /** ¿Puede usar el portal? Con `BILLING_ENFORCED` apagado, siempre `true`. */
  ok: boolean;
  reason: BillingReason;
  /**
   * `true` cuando hay algo que avisarle al cliente aunque siga entrando: hoy,
   * solo el periodo de gracia. El portal dibuja una barra arriba.
   */
  warning: boolean;
  /** Hasta cuándo entra a pesar de la deuda. ISO, o `null`. */
  graceUntil: string | null;
  /**
   * Inicio del ciclo de facturación (ISO), o `null` si la marca no tiene
   * suscripción de Stripe. Con `null`, los contadores caen al mes calendario
   * UTC de siempre — ver `lib/portal/usage.ts`.
   */
  cycleStart: string | null;
  cycleEnd: string | null;
  /** `null` si la marca no tiene fila (marca creada antes de `ensureSubscription`). */
  subscription: ClientSubscription | null;
};

/** Días que faltan para que se corte. `null` si no hay deuda. */
export function graceDaysLeft(graceUntil: string | null): number | null {
  if (!graceUntil) return null;
  const ms = new Date(graceUntil).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * Resuelve el estado de cobro de una marca.
 *
 * Nunca lanza por falta de configuración: si `client_subscriptions` no se puede
 * leer, cae a `none`. Con la bandera apagada eso no corta a nadie; con la
 * bandera encendida **falla cerrado**, que es lo correcto cuando lo que está en
 * juego es el acceso a un producto de pago.
 */
export async function getBillingState(clientId: string): Promise<BillingState> {
  let subscription: ClientSubscription | null = null;

  try {
    subscription = await getSubscription(clientId);
  } catch (e) {
    console.error("[billing/access] no se pudo leer la suscripción:", e);
  }

  const enforced = billingEnforced();
  const cycleStart = subscription?.currentPeriodStart ?? null;
  const cycleEnd = subscription?.currentPeriodEnd ?? null;

  const base = { cycleStart, cycleEnd, subscription };

  // Una marca exenta no mira ni el estado ni la gracia: es tuya o es cortesía.
  if (subscription?.exempt) {
    return { ...base, ok: true, reason: "exempt", warning: false, graceUntil: null };
  }

  const reason: BillingReason = !subscription
    ? "none"
    : subscription.status === "active"
      ? "active"
      : subscription.status === "canceled"
        ? "canceled"
        : subscription.status === "past_due"
          ? withinGrace(subscription.graceUntil)
            ? "grace"
            : "unpaid"
          : "none";

  const allowed = reason === "active" || reason === "grace";

  return {
    ...base,
    // Con la bandera apagada nadie se corta, pero `reason` sigue siendo real:
    // el panel de Paco muestra el estado verdadero desde el primer día.
    ok: enforced ? allowed : true,
    reason,
    warning: reason === "grace",
    graceUntil: subscription?.graceUntil ?? null,
  };
}

function withinGrace(graceUntil: string | null): boolean {
  // Sin fecha de gracia no hay periodo que respetar: si Stripe dice `past_due`
  // y nadie anotó la gracia, se trata como impago. Falla cerrado.
  if (!graceUntil) return false;
  return new Date(graceUntil).getTime() > Date.now();
}

/**
 * El mensaje que ve el cliente cuando no puede entrar (o cuando está por
 * quedarse afuera). Se escribe una sola vez acá para que la pantalla de pago,
 * la barra de aviso y el panel de Paco no se desincronicen.
 */
export function billingMessage(state: BillingState): string {
  switch (state.reason) {
    case "grace": {
      const days = graceDaysLeft(state.graceUntil);
      if (days === 0) return "No pudimos cobrar tu suscripción. El acceso se suspende hoy.";
      return `No pudimos cobrar tu suscripción. Tienes ${days} ${
        days === 1 ? "día" : "días"
      } para actualizar tu tarjeta antes de que se suspenda el acceso.`;
    }
    case "unpaid":
      return "Tu suscripción tiene un pago pendiente y el acceso quedó suspendido. Actualiza tu tarjeta para volver a entrar.";
    case "canceled":
      return "Tu suscripción está cancelada. Puedes reactivarla cuando quieras.";
    case "none":
      return "Esta marca todavía no tiene una suscripción activa.";
    case "exempt":
    case "active":
      return "";
  }
}
