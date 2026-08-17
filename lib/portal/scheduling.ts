/**
 * Agenda automática al aprobar un guion desde el portal (Fase D, etapa 7).
 *
 * SERVER-ONLY, service role: un miembro no tiene `insert` sobre
 * `content_calendar` (solo la policy de select del dueño lo cubre a él). Un
 * `viewer` no podría aprobar igual (`scripts_member_update` exige
 * `collaborator`), pero de todos modos esta escritura no puede depender de la
 * sesión de quien aprueba.
 *
 * No hace falta migración: `content_calendar.status` no tiene `CHECK`
 * constraint en la base (a diferencia de `scripts.status`), así que "idea" es
 * solo una convención de texto, la misma que ya usa `saveScriptWithNewIdea`
 * en el estudio.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const DAYS_OUT = 14;

/**
 * Si el guion aprobado todavía no tiene una fila en `content_calendar`, crea
 * una a +14 días. Si ya la tiene (la mayoría: nace de `saveScriptWithNewIdea`
 * en el estudio, o el cliente ya la vinculó a mano), no hace nada — no hay que
 * duplicar ni pisar la fecha que ya eligió Paco.
 */
export async function ensureCalendarEntry(
  admin: SupabaseClient,
  input: {
    scriptId: string;
    clientId: string;
    ownerId: string;
    type: string | null;
    title: string | null;
    brief: string | null;
  },
): Promise<void> {
  const { data: existing, error: existingErr } = await admin
    .from("content_calendar")
    .select("id")
    .eq("script_id", input.scriptId)
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);
  if (existing) return;

  const target = new Date();
  target.setDate(target.getDate() + DAYS_OUT);
  const month = target.getMonth() + 1;
  const year = target.getFullYear();
  // El editorial agrupa por "Semana 1-4" del mes (no es la semana ISO del
  // calendario): día 1-7 → semana 1 … día 22-31 → semana 4. Mismo criterio que
  // el selector manual de `/calendario`.
  const weekNumber = Math.min(4, Math.ceil(target.getDate() / 7));

  const { data: existingInWeek } = await admin
    .from("content_calendar")
    .select("position")
    .eq("owner_id", input.ownerId)
    .eq("month", month)
    .eq("year", year)
    .eq("week_number", weekNumber)
    .order("position", { ascending: false })
    .limit(1);

  const maxPos = (existingInWeek?.[0]?.position as number | undefined) ?? -1;

  const { error } = await admin.from("content_calendar").insert({
    owner_id: input.ownerId,
    client_id: input.clientId,
    script_id: input.scriptId,
    title: input.title?.trim() || "Guion aprobado por el cliente",
    format: input.type === "carousel" ? "carrusel" : "reel",
    platforms: ["instagram"],
    status: "idea",
    month,
    year,
    week_number: weekNumber,
    position: maxPos + 1,
    publish_date: target.toISOString().slice(0, 10),
    brief: input.brief ?? null,
  });

  if (error) throw new Error(error.message);
}
