/**
 * Consumo del tope de transcripción por cliente — espejo de `lib/portal/usage.ts`
 * pero para `transcription_usage_log` (migración `0010`).
 *
 * Mismo corte en UTC, mismo criterio de "una fila = una unidad exitosa": acá
 * una fila es una transcripción que SÍ terminó con texto, no un intento.
 *
 * Se usa solo desde el portal — el estudio transcribe sin tope y por lo tanto
 * nunca llama a `assertCanTranscribe` ni a `logTranscription`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { currentMonthStart } from "../portal/usage";

export type TranscriptionUsageSummary = { used: number; monthStart: string };

export type TranscriptionUsageState = TranscriptionUsageSummary & {
  limit: number | null;
  remaining: number | null;
  blocked: boolean;
};

/**
 * Solo el conteo, para el panel de `/clientes/[id]` (misma sesión del dueño —
 * la policy `transcription_usage_log_owner_select` alcanza). El chequeo con
 * tope y bloqueo vive en `getTranscriptionUsageState`, que además la usa el
 * portal con service role.
 */
export async function getMonthlyTranscriptionUsage(
  supabase: SupabaseClient,
  clientId: string,
  ownerId: string,
): Promise<TranscriptionUsageSummary> {
  const monthStart = currentMonthStart();
  const { count, error } = await supabase
    .from("transcription_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("owner_id", ownerId)
    .gte("created_at", monthStart.toISOString());

  if (error) throw new Error(error.message);
  return { used: count ?? 0, monthStart: monthStart.toISOString() };
}

/** Fallback si la lectura falla: el panel muestra 0 en vez de tumbarse. */
export function emptyTranscriptionUsage(): TranscriptionUsageSummary {
  return { used: 0, monthStart: currentMonthStart().toISOString() };
}

export async function getTranscriptionUsageState(
  supabase: SupabaseClient,
  clientId: string,
  ownerId: string,
  limit: number | null,
): Promise<TranscriptionUsageState> {
  const { used, monthStart } = await getMonthlyTranscriptionUsage(supabase, clientId, ownerId);
  const remaining = limit === null ? null : Math.max(0, limit - used);
  return { used, monthStart, limit, remaining, blocked: limit !== null && used >= limit };
}

/** Registra una transcripción exitosa. `supabase` debe ser service role. */
export async function logTranscription(
  supabase: SupabaseClient,
  input: { ownerId: string; clientId: string; userId: string; postId: string },
): Promise<void> {
  const { error } = await supabase.from("transcription_usage_log").insert({
    owner_id: input.ownerId,
    client_id: input.clientId,
    user_id: input.userId,
    post_id: input.postId,
  });
  if (error) throw new Error(error.message);
}
