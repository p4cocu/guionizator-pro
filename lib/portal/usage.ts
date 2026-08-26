/**
 * Consumo del add-on de IA (Fase D, etapa 6 — reescrito por ciclo en Fase E).
 *
 * Una fila de `ai_usage_log` = una generación disparada desde el portal. El
 * tope sale del plan (`PLAN_AI_CREDITS`, 40) salvo que la marca tenga override
 * en `clients.ai_generation_limit`, y se mide contra el **ciclo de facturación**
 * de esa marca.
 *
 * ## Antes cortaba por mes calendario; ahora por ciclo
 *
 * Hasta Fase D el corte era el día 1 a las 00:00 UTC. Con Stripe eso deja de
 * tener sentido: si un cliente paga el día 20, su cupo tiene que reiniciarse el
 * 20 de cada mes, no el 1 — si no, alguien que se suscribe el 28 tiene tres
 * días de cupo por su primer mes completo.
 *
 * El inicio del ciclo llega como parámetro desde
 * `client_subscriptions.current_period_start` (ver `lib/billing/access.ts`).
 * Cuando no hay suscripción — una marca exenta, o antes de que exista Stripe —
 * cae al mes calendario UTC de siempre, que es exactamente el comportamiento
 * anterior. Por eso nada se rompe entre la migración `0013` y el día que se
 * enciende el cobro.
 *
 * ⚠️ El corte del fallback sigue siendo **UTC**, no la hora local de Paco: es la
 * misma referencia con la que Postgres guarda `created_at`, y evita que el
 * contador "se resetee" dos veces según desde dónde se mire.
 *
 * Los inserts los hace el servidor con service role: el cliente no puede
 * falsear ni borrar su consumo. Desde `/clientes/[id]` se lee con el cliente de
 * sesión (la policy `ai_usage_log_owner_select` limita a las marcas del dueño);
 * desde el portal hay que leerlo con service role, porque el miembro NO tiene
 * policy de select sobre esta tabla.
 *
 * ## Qué cuenta como "una generación"
 *
 * Un guion terminado = una fila. Los pasos intermedios del modo completo (Big
 * Idea, estructuras) no suman: son parte del mismo pedido y cobrarlos haría que
 * el número del panel dejara de significar "guiones generados". Sus tokens
 * tampoco quedan registrados — son un orden de magnitud menores que los del
 * guion (300 y 1500 contra 4096) y no cambian la cuenta. Los de la fila son los
 * de la llamada que produjo el guion. Regenerar SÍ cuenta: es otro guion y
 * gasta API igual. La lista completa de acciones que descuentan está en
 * `lib/billing/plan.ts` → `AI_CREDIT_ACTIONS`.
 *
 * ## Plan y recargas
 *
 * Mientras el consumo del ciclo esté por debajo del tope, la generación sale
 * del plan (`paid_with = 'plan'`). Pasado el tope, sale del saldo de recargas
 * compradas (`paid_with = 'credit'`, ver `lib/billing/credits.ts`), que no
 * vence. Si tampoco hay saldo, se bloquea.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiPaymentSource } from "../billing/plan";

export type AiUsageSummary = {
  /** Generaciones registradas en el ciclo en curso para esta marca. */
  used: number;
  /**
   * Inicio del ciclo (ISO). Es el `current_period_start` de la suscripción, o
   * el día 1 del mes en UTC si la marca no tiene una. Sirve para el texto de la
   * UI y para saber qué se está contando.
   */
  cycleStart: string;
  /** Fin del ciclo (ISO), si se conoce. `null` con el fallback mensual. */
  cycleEnd: string | null;
};

export type AiUsageState = AiUsageSummary & {
  /** Tope del ciclo: el del plan, o el override de `clients`. `null` = sin tope. */
  limit: number | null;
  /** Generaciones del PLAN que le quedan este ciclo. `null` = ilimitadas. */
  remaining: number | null;
  /** Saldo de recargas compradas. No vence. */
  creditBalance: number;
  /**
   * ¿Se agotaron el cupo del ciclo **y** el saldo de recargas? Si es `true`, no
   * se llama a la IA.
   */
  blocked: boolean;
  /**
   * De dónde saldría la próxima generación. La UI lo usa para avisar "esta ya
   * descuenta de tus créditos comprados" antes de que el cliente apriete.
   */
  nextSource: AiPaymentSource;
};

/**
 * Primer instante del mes en curso, en UTC.
 *
 * Es el **fallback** cuando la marca no tiene ciclo de facturación (exenta, o
 * todavía sin Stripe). Era el corte único hasta Fase D.
 */
export function currentMonthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * El inicio del periodo que hay que contar: el ciclo de facturación si existe,
 * el mes calendario si no. Un solo lugar decide esto, para que el medidor de IA
 * y el de transcripciones nunca cuenten periodos distintos.
 */
export function resolveCycleStart(cycleStart: string | null | undefined): string {
  return cycleStart ?? currentMonthStart().toISOString();
}

export async function getCycleAiUsage(
  supabase: SupabaseClient,
  clientId: string,
  ownerId: string,
  cycleStart: string | null,
  cycleEnd: string | null = null,
): Promise<AiUsageSummary> {
  const start = resolveCycleStart(cycleStart);

  const { count, error } = await supabase
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("owner_id", ownerId)
    .gte("created_at", start);

  if (error) throw new Error(error.message);

  return { used: count ?? 0, cycleStart: start, cycleEnd };
}

/**
 * Fallback para cuando la lectura falla: el panel muestra 0 en vez de tumbar el
 * perfil del cliente. Es función y no constante a propósito — una constante de
 * módulo congelaría `cycleStart` en el arranque del servidor.
 */
export function emptyAiUsage(): AiUsageSummary {
  return { used: 0, cycleStart: currentMonthStart().toISOString(), cycleEnd: null };
}

/**
 * Consumo + tope + saldo, que es lo que necesita el portal para decidir si
 * genera y con qué lo paga.
 *
 * `supabase` tiene que ser el **service role** cuando lo llama el portal: el
 * miembro no tiene policy de select sobre `ai_usage_log`, así que con su sesión
 * el conteo vuelve 0 y el tope no cortaría nunca.
 */
export async function getAiUsageState(
  supabase: SupabaseClient,
  clientId: string,
  ownerId: string,
  limit: number | null,
  options: {
    cycleStart: string | null;
    cycleEnd?: string | null;
    /** Saldo de recargas. 0 si la marca no tiene suscripción. */
    creditBalance?: number;
  },
): Promise<AiUsageState> {
  const { used, cycleStart, cycleEnd } = await getCycleAiUsage(
    supabase,
    clientId,
    ownerId,
    options.cycleStart,
    options.cycleEnd ?? null,
  );

  const creditBalance = options.creditBalance ?? 0;
  const remaining = limit === null ? null : Math.max(0, limit - used);
  const planAgotado = limit !== null && used >= limit;

  return {
    used,
    cycleStart,
    cycleEnd,
    limit,
    remaining,
    creditBalance,
    // Se bloquea solo si además NO hay recargas: el cliente que compró créditos
    // sigue generando aunque el cupo del ciclo esté agotado.
    blocked: planAgotado && creditBalance <= 0,
    nextSource: planAgotado ? "credit" : "plan",
  };
}

/**
 * Registra una generación. Se llama **después** de que la IA respondió: una
 * llamada que falló no le cuesta al cliente su cupo.
 *
 * Consecuencia asumida (viene de Fase D): dos pedidos en paralelo (dos
 * pestañas) pueden pasar el chequeo antes de que ninguno haya escrito su fila,
 * y el ciclo cierra con una generación de más. Se prefiere eso a reservar el
 * cupo por adelantado y cobrarle los errores de la API. La UI serializa el
 * botón, así que hace falta bastante mala fe para provocarlo, y el daño máximo
 * es una generación — el saldo de recargas nunca queda negativo porque el
 * descuento lleva `where credit_balance > 0`.
 *
 * `paidWith` deja el rastro de por qué bajó el saldo: sin esa columna no habría
 * forma de auditar un reclamo del estilo "compré 20 y me quedan 12".
 *
 * `supabase` tiene que ser el service role: no hay policy de insert para nadie.
 */
export async function logAiGeneration(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    clientId: string;
    userId: string;
    endpoint: string;
    inputTokens?: number;
    outputTokens?: number;
    paidWith?: AiPaymentSource;
  },
): Promise<void> {
  const { error } = await supabase.from("ai_usage_log").insert({
    owner_id: input.ownerId,
    client_id: input.clientId,
    user_id: input.userId,
    endpoint: input.endpoint,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    paid_with: input.paidWith ?? "plan",
  });

  if (error) throw new Error(error.message);
}
