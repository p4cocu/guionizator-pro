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
 * Los inserts los hace el servidor con service role (etapa 6): el cliente no
 * puede falsear ni borrar su consumo. Acá solo se lee, con el cliente de sesión
 * — la policy `ai_usage_log_owner_select` limita a las marcas del dueño.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AiUsageSummary = {
  /** Generaciones registradas este mes para esta marca. */
  used: number;
  /** Inicio del mes en curso (UTC), ISO. Sirve para el texto de la UI. */
  monthStart: string;
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
