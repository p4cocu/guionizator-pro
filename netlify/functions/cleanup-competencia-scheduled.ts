/**
 * Netlify Scheduled Function: borra posts de competencia vencidos para TODOS
 * los owners/clientes — independiente de si alguien dispara una búsqueda. Corre
 * a diario según el cron de netlify.toml
 * ([functions."cleanup-competencia-scheduled"]).
 *
 * Las reglas de cuánto vive cada post viven en `lib/competencia/retention.ts`
 * (40 días lo scrapeado sin estrella, 120 los guardados a mano, para siempre lo
 * scrapeado con estrella). Acá NO se repiten: `runScrapeJob` purga con la misma
 * función y antes cada uno traía su propia consulta.
 *
 * Netlify solo permite invocar funciones con `schedule` configurado desde su
 * propio scheduler interno; cualquier request externo directo a su endpoint
 * recibe 404 (no necesita SCRAPE_FN_SECRET como scrape-competencia-background,
 * que sí es invocable por HTTP normal).
 *
 * Usa la SERVICE ROLE de Supabase (no hay sesión de usuario en un cron).
 *
 * Variables de entorno requeridas en Netlify:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import {
  purgeExpiredPosts,
  RETENTION_DAYS,
  MANUAL_RETENTION_DAYS,
} from "../../lib/competencia/retention";

export const handler = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: "Missing server configuration" };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { scraped, manual } = await purgeExpiredPosts(supabase);
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        deleted: scraped + manual,
        scraped,
        manual,
        retentionDays: RETENTION_DAYS,
        manualRetentionDays: MANUAL_RETENTION_DAYS,
      }),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falló la limpieza.";
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: message }) };
  }
};
