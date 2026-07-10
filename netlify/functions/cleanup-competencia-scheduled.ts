/**
 * Netlify Scheduled Function: borra posts de competencia con más de
 * RETENTION_DAYS desde su publicación, para TODOS los owners/clientes —
 * independiente de si alguien dispara una búsqueda. Corre a diario según el
 * cron configurado en netlify.toml ([functions."cleanup-competencia-scheduled"]).
 *
 * Netlify solo permite invocar funciones con `schedule` configurado desde su
 * propio scheduler interno; cualquier request externo directo a su endpoint
 * recibe 404 (no necesita SCRAPE_FN_SECRET como scrape-competencia-background,
 * que sí es invocable por HTTP normal).
 *
 * Usa la SERVICE ROLE de Supabase (no hay sesión de usuario en un cron).
 * Excluye posts marcados como favoritos: son referencia que Paco quiere
 * conservar aunque estén viejos.
 *
 * Variables de entorno requeridas en Netlify:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const RETENTION_DAYS = 40;

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
    .from("competitor_posts")
    .delete({ count: "exact" })
    .eq("is_favorite", false)
    .lt("posted_at", cutoff.toISOString())
    .not("posted_at", "is", null);

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, deleted: count ?? 0, cutoff: cutoff.toISOString() }),
  };
};
