/**
 * Netlify Scheduled Function (cron `@daily` en netlify.toml). Borra posts de Competencia vencidos.
 *
 * ⚠️ Respaldo desde la mudanza a Vercel (2026-10-02): en producción lo corre
 * el cron de Vercel (`app/api/cron/*`). La lógica vive en `lib/jobs/cleanupCompetencia.ts`
 * y es idempotente, así que correr los dos el mismo día no hace daño.
 *
 * Netlify solo permite invocar funciones con `schedule` desde su propio
 * scheduler; cualquier request externo directo recibe 404 (no necesita secreto).
 *
 * Variables de entorno: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { cleanupCompetencia } from "../../lib/jobs/cleanupCompetencia";

export const handler = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: "Missing server configuration" };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await cleanupCompetencia(supabase);
  return { statusCode: result.ok ? 200 : 500, body: JSON.stringify(result) };
};
