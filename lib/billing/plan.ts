/**
 * Qué incluye el plan y cuánto cuesta cada cosa (Fase E).
 *
 * Módulo **puro**: sin Supabase, sin Stripe, sin `process.env`. Lo importan
 * tanto el servidor como componentes `"use client"` (la pantalla de recargas
 * necesita dibujar los paquetes), así que no puede arrastrar nada de servidor.
 *
 * Los `price_...` de Stripe NO viven acá a propósito — son distintos en modo
 * test y en producción, así que salen de variables de entorno y se resuelven en
 * `lib/billing/stripe.ts`, que es server-only. Acá solo está el catálogo que se
 * le muestra al cliente.
 */

// ─── El plan ─────────────────────────────────────────────────────────────────

/** Lo que cuesta la suscripción mensual por MARCA. Solo para mostrar en la UI. */
export const PLAN_PRICE_MXN = 300;

/**
 * Generaciones de IA incluidas por ciclo de facturación.
 *
 * Es el valor por defecto: `clients.ai_generation_limit` sigue existiendo como
 * **override por marca** (`null` = este número). Ojo con el cambio de
 * significado que introdujo la migración `0013`: antes `null` quería decir "sin
 * tope"; ahora quiere decir "el tope del plan". Para una marca `exempt` sí
 * sigue queriendo decir sin tope.
 *
 * Cuánto es una generación: ver `AI_CREDIT_ACTIONS` abajo.
 */
export const PLAN_AI_CREDITS = 40;

/**
 * Transcripciones incluidas por ciclo. Medidor **aparte** del de IA
 * (`transcription_usage_log`), con su propio override en
 * `clients.transcription_limit`. Se cuentan aparte porque una transcripción
 * cuesta un orden de magnitud menos que un guion: cobrarlas con el mismo
 * crédito le saldría carísimo al cliente.
 */
export const PLAN_TRANSCRIPTIONS = 40;

/**
 * Días de gracia después de que falla un cobro, antes de cortar el acceso.
 *
 * Decidido con Paco: corte automático **con** periodo de gracia, no el mismo
 * día. Durante la gracia el portal funciona completo pero muestra un aviso
 * visible. Lo pone el webhook al primer `invoice.payment_failed`
 * (`client_subscriptions.grace_until`) y lo limpia `invoice.paid`.
 *
 * El corte se calcula **en lectura** (`now >= grace_until`), no hay cron: nada
 * que se pueda atascar y dejar entrando gratis a una marca que no pagó.
 */
export const GRACE_DAYS = 5;

// ─── Qué gasta un crédito ────────────────────────────────────────────────────

/**
 * Las cuatro acciones del portal que escriben una fila en `ai_usage_log`.
 *
 * Los valores son exactamente los `endpoint` que ya se registran hoy — esta
 * lista es documentación viva, no una fuente de verdad que el código consulte
 * para decidir. Si aparece una quinta acción de pago, va acá **y** en la tabla
 * de `CLAUDE.md`.
 *
 * NO gastan crédito: guardar el guion, editarlo, copiarlo, descargarlo,
 * comentar, aprobar, tirarlo a la papelera, marcar la estrella, ni ver ninguna
 * sección. Los pasos intermedios del modo "completo" (Big Idea, estructuras)
 * tampoco descuentan, pero sí exigen cupo disponible: con 0 créditos el flujo
 * ni arranca.
 */
export const AI_CREDIT_ACTIONS: { endpoint: string; label: string }[] = [
  { endpoint: "portal:guion", label: "Generar un guion" },
  { endpoint: "portal:adapt-competitor", label: "Adaptar un post a mi marca" },
  { endpoint: "portal:cover", label: "Generar portadas" },
  { endpoint: "portal:copy", label: "Copy Expert" },
];

/**
 * De dónde salió una generación. Espeja el `CHECK` de `ai_usage_log.paid_with`
 * (migración `0013`).
 *
 * ⚠️ REGLA DURA (CLAUDE.md): agregar un valor acá exige el
 * `ALTER TABLE … ai_usage_log_paid_with_check` en la misma entrega.
 */
export type AiPaymentSource = "plan" | "credit";

export function isAiPaymentSource(value: string): value is AiPaymentSource {
  return value === "plan" || value === "credit";
}

// ─── Recargas ────────────────────────────────────────────────────────────────

/**
 * Los paquetes de crédito que puede comprar el contacto de facturación.
 *
 * El `key` es lo único que viaja del browser al servidor. El servidor lo
 * traduce a un `price_...` (en `lib/billing/stripe.ts`) y, al acreditar, saca
 * los créditos del `price_id` que vino en el evento de Stripe.
 *
 * ⚠️ **Los créditos NUNCA se leen del body del cliente.** Si el número viniera
 * de ahí, cualquiera compraría el paquete de 20 y reclamaría 5000.
 */
export type CreditPackKey = "20" | "50";

export type CreditPack = {
  key: CreditPackKey;
  credits: number;
  priceMxn: number;
  /** Cómo se lee en el botón de compra. */
  label: string;
  /** Una línea de ayuda debajo del botón. */
  hint: string;
};

export const CREDIT_PACKS: CreditPack[] = [
  {
    key: "20",
    credits: 20,
    priceMxn: 100,
    label: "20 créditos",
    hint: "$5 por generación. Para terminar el mes sin quedarte a medias.",
  },
  {
    key: "50",
    credits: 50,
    priceMxn: 200,
    label: "50 créditos",
    hint: "$4 por generación. Conviene si te pasas del cupo seguido.",
  },
];

/** Chequeo de compilación: el array cubre EXACTAMENTE la unión de keys. */
const _packCoverage: Record<CreditPackKey, true> = { "20": true, "50": true };
void _packCoverage;

const PACKS_BY_KEY = new Map<string, CreditPack>(CREDIT_PACKS.map((p) => [p.key, p]));

export function isCreditPackKey(value: string): value is CreditPackKey {
  return PACKS_BY_KEY.has(value);
}

export function getCreditPack(key: string): CreditPack | null {
  return PACKS_BY_KEY.get(key) ?? null;
}

// ─── Helpers de presentación ─────────────────────────────────────────────────

/** "$300 MXN" — un solo lugar que decide cómo se escribe la plata. */
export function formatMxn(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * El tope efectivo de una marca.
 *
 * `exempt` gana sobre todo: una marca tuya o de cortesía no tiene tope. Si no,
 * manda el override de `clients` y, si está vacío, el número del plan.
 */
export function effectiveLimit(
  override: number | null,
  exempt: boolean,
  planDefault: number,
): number | null {
  if (exempt) return null;
  return override ?? planDefault;
}
