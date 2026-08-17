/**
 * Consumo del add-on de IA (Fase D).
 *
 * Una fila de `ai_usage_log` = una generación disparada desde el portal. El
 * tope mensual vive en `clients.ai_generation_limit` (`null` = sin tope) y se
 * mide contra el conteo de este mes.
 *
 * ⚠️ El mes se corta en **UTC**, no en la hora local de Paco: es la misma
 * referencia que usa Postgres al guardar `created_at`, y evita que el contador
 * "se resetee" dos veces según desde dónde se mire. La diferencia solo se nota
 * en las primeras horas del día 1.
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
 * gasta API igual.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AiUsageSummary = {
  /** Generaciones registradas este mes para esta marca. */
  used: number;
  /** Inicio del mes en curso (UTC), ISO. Sirve para el texto de la UI. */
  monthStart: string;
};

export type AiUsageState = AiUsageSummary & {
  /** Tope mensual de `clients.ai_generation_limit`. `null` = sin tope. */
  limit: number | null;
  /** Generaciones que le quedan este mes. `null` = ilimitadas. */
  remaining: number | null;
  /** ¿Ya se pasó? Si es `true`, no se llama a la IA. */
  blocked: boolean;
};

/** Primer instante del mes en curso, en UTC. */
export function currentMonthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getMonthlyAiUsage(
  supabase: SupabaseClient,
  clientId: string,
  ownerId: string,
): Promise<AiUsageSummary> {
  const monthStart = currentMonthStart();

  const { count, error } = await supabase
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("owner_id", ownerId)
    .gte("created_at", monthStart.toISOString());

  if (error) throw new Error(error.message);

  return { used: count ?? 0, monthStart: monthStart.toISOString() };
}

/**
 * Fallback para cuando la lectura falla: el panel muestra 0 en vez de tumbar el
 * perfil del cliente. Es función y no constante a propósito — una constante de
 * módulo congelaría `monthStart` en el arranque del servidor.
 */
export function emptyAiUsage(): AiUsageSummary {
  return { used: 0, monthStart: currentMonthStart().toISOString() };
}

/**
 * Consumo + tope, que es lo que necesita el portal para decidir si genera.
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
): Promise<AiUsageState> {
  const { used, monthStart } = await getMonthlyAiUsage(supabase, clientId, ownerId);
  const remaining = limit === null ? null : Math.max(0, limit - used);

  return {
    used,
    monthStart,
    limit,
    remaining,
    blocked: limit !== null && used >= limit,
  };
}

/**
 * Registra una generación. Se llama **después** de que la IA respondió: una
 * llamada que falló no le cuesta al cliente su cupo.
 *
 * Consecuencia asumida: dos pedidos en paralelo (dos pestañas) pueden pasar el
 * chequeo antes de que ninguno haya escrito su fila, y el mes cierra con una
 * generación de más. Se prefiere eso a reservar el cupo por adelantado y
 * cobrarle los errores de la API. La UI serializa el botón, así que hace falta
 * bastante mala fe para provocarlo, y el daño máximo es una generación.
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
  },
): Promise<void> {
  const { error } = await supabase.from("ai_usage_log").insert({
    owner_id: input.ownerId,
    client_id: input.clientId,
    user_id: input.userId,
    endpoint: input.endpoint,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
  });

  if (error) throw new Error(error.message);
}
