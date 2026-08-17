/**
 * Netlify Scheduled Function: borra en firme los guiones que llevan más de
 * RETENTION_DAYS en la papelera (`scripts.trashed_at`, migración `0011`),
 * para TODOS los owners. Corre a diario según el cron configurado en
 * `netlify.toml` ([functions."cleanup-scripts-trash-scheduled"]).
 *
 * Mismo patrón que `cleanup-competencia-scheduled.ts`: Netlify solo permite
 * invocar funciones con `schedule` configurado desde su propio scheduler
 * interno, así que no necesita secreto propio.
 *
 * Usa la SERVICE ROLE de Supabase (no hay sesión de usuario en un cron).
 *
 * Variables de entorno requeridas en Netlify:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const RETENTION_DAYS = 30;

export const handler = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: "Missing server configuration" };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const { error, count } = await supabase
    .from("scripts")
    .delete({ count: "exact" })
    .not("trashed_at", "is", null)
    .lt("trashed_at", cutoff.toISOString());

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, deleted: count ?? 0, cutoff: cutoff.toISOString() }),
  };
};
