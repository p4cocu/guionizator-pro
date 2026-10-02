/**
 * Job diario: borra en firme los guiones que llevan más de RETENTION_DAYS en la
 * papelera (`scripts.trashed_at`, migración `0011`), para TODOS los owners.
 *
 * Lo corren el cron de Vercel (`app/api/cron/cleanup-scripts-trash`) y, mientras
 * Netlify siga como respaldo, `netlify/functions/cleanup-scripts-trash-scheduled.ts`.
 * Recibe un cliente con SERVICE ROLE (no hay sesión de usuario en un cron).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const RETENTION_DAYS = 30;

export async function cleanupScriptsTrash(supabase: SupabaseClient) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const { error, count } = await supabase
    .from("scripts")
    .delete({ count: "exact" })
    .not("trashed_at", "is", null)
    .lt("trashed_at", cutoff.toISOString());

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, deleted: count ?? 0, cutoff: cutoff.toISOString() };
}
