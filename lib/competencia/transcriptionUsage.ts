/**
 * Consumo del tope de transcripción por cliente — espejo de `lib/portal/usage.ts`
 * pero para `transcription_usage_log` (migración `0010`).
 *
 * Mismo corte por **ciclo de facturación** desde Fase E, y mismo criterio de
 * "una fila = una unidad exitosa": acá una fila es una transcripción que SÍ
 * terminó con texto, no un intento.
 *
 * Es un medidor **aparte** del de IA a propósito: una transcripción cuesta un
 * orden de magnitud menos que un guion (Whisper contra Sonnet), así que
 * cobrarlas con el mismo crédito le saldría carísima al cliente. El plan trae
 * 40 de cada una, con sus dos overrides independientes en `clients`.
 *
 * A diferencia de las generaciones, **las transcripciones no se pueden pagar
 * con una recarga**: los paquetes de crédito son solo de IA. Cuando se agota el
 * tope del ciclo, se acabó hasta el próximo — es un extra del plan, no un
 * consumible.
 *
 * Se usa solo desde el portal — el estudio transcribe sin tope y por lo tanto
 * nunca llama a `assertCanTranscribe` ni a `logTranscription`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { currentMonthStart, resolveCycleStart } from "../portal/usage";

export type TranscriptionUsageSummary = {
  used: number;
  /** Inicio del ciclo (ISO), o el día 1 del mes en UTC si no hay suscripción. */
  cycleStart: string;
  cycleEnd: string | null;
};

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
export async function getCycleTranscriptionUsage(
  supabase: SupabaseClient,
  clientId: string,
  ownerId: string,
  cycleStart: string | null,
  cycleEnd: string | null = null,
): Promise<TranscriptionUsageSummary> {
  const start = resolveCycleStart(cycleStart);

  const { count, error } = await supabase
    .from("transcription_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("owner_id", ownerId)
    .gte("created_at", start);

  if (error) throw new Error(error.message);
  return { used: count ?? 0, cycleStart: start, cycleEnd };
}

/** Fallback si la lectura falla: el panel muestra 0 en vez de tumbarse. */
export function emptyTranscriptionUsage(): TranscriptionUsageSummary {
  return { used: 0, cycleStart: currentMonthStart().toISOString(), cycleEnd: null };
}

export async function getTranscriptionUsageState(
  supabase: SupabaseClient,
  clientId: string,
  ownerId: string,
  limit: number | null,
  options: { cycleStart: string | null; cycleEnd?: string | null },
): Promise<TranscriptionUsageState> {
  const { used, cycleStart, cycleEnd } = await getCycleTranscriptionUsage(
    supabase,
    clientId,
    ownerId,
    options.cycleStart,
    options.cycleEnd ?? null,
  );

  const remaining = limit === null ? null : Math.max(0, limit - used);
  return { used, cycleStart, cycleEnd, limit, remaining, blocked: limit !== null && used >= limit };
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
