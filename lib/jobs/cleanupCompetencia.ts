/**
 * Job diario: borra posts de competencia vencidos para TODOS los
 * owners/clientes — independiente de si alguien dispara una búsqueda.
 *
 * Las reglas de cuánto vive cada post viven en `lib/competencia/retention.ts`
 * (40 días lo scrapeado sin estrella, 120 los guardados a mano, para siempre lo
 * scrapeado con estrella). Acá NO se repiten: `runScrapeJob` purga con la misma
 * función.
 *
 * Lo corren el cron de Vercel (`app/api/cron/cleanup-competencia`) y, mientras
 * Netlify siga como respaldo, `netlify/functions/cleanup-competencia-scheduled.ts`.
 * Recibe un cliente con SERVICE ROLE (no hay sesión de usuario en un cron).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  purgeExpiredPosts,
  RETENTION_DAYS,
  MANUAL_RETENTION_DAYS,
} from "../competencia/retention";

export async function cleanupCompetencia(supabase: SupabaseClient) {
  try {
    const { scraped, manual } = await purgeExpiredPosts(supabase);
    return {
      ok: true as const,
      deleted: scraped + manual,
      scraped,
      manual,
      retentionDays: RETENTION_DAYS,
      manualRetentionDays: MANUAL_RETENTION_DAYS,
    };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Falló la limpieza." };
  }
}
