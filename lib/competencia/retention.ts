/**
 * Cuánto vive un post de competencia antes de que se borre solo.
 *
 * Hay UNA sola definición de las reglas y dos lugares que la ejecutan:
 *   - `netlify/functions/cleanup-competencia-scheduled.ts` (cron `@daily`,
 *     todos los owners y clientes, corra o no una búsqueda);
 *   - `runScrapeJob` (`lib/competencia/scrape.ts`), que purga "al vuelo" solo
 *     la marca recién scrapeada.
 * Antes cada uno traía su propia consulta con su propio `RETENTION_DAYS`; la
 * segunda regla (la de los manuales) habría entrado en uno y no en el otro.
 *
 * ## Las reglas
 *
 * | Fila                                   | Vive        |
 * |----------------------------------------|-------------|
 * | Scrapeada, sin estrella                | 40 días     |
 * | Guardada a mano (`is_manual`)          | 120 días    |
 * | Scrapeada y con estrella               | para siempre|
 *
 * Los 120 días son 3 × 40, decisión de Paco (2026-09-10). El caso que los pide:
 * desde el portal el cliente pega links y **nacen con la estrella puesta**, así
 * que bajo la regla vieja ("los favoritos no se borran nunca") no se borrarían
 * jamás y la tabla crecería sin techo con contenido que el cliente miró una vez.
 *
 * ⚠️ El post **scrapeado** al que alguien le pone la estrella sigue siendo
 * inmortal, igual que antes de este cambio. Es curaduría explícita sobre algo
 * que ya estaba en el tablero, y bajarle la vida cambiaría el significado que
 * la estrella tiene desde la Fase D. Si esa vía empieza a inflar la tabla
 * (un cliente que marca todo), el arreglo es darle también 120 días acá, en un
 * solo lugar.
 *
 * El corte se mide contra `posted_at`, no contra `scraped_at`: es la fecha del
 * contenido y no la de nuestra base. Para un guardado a mano `posted_at` es el
 * momento en que se guardó… salvo que un scrape posterior de esa misma cuenta
 * lo pise con la fecha real de publicación (el upsert va por `shortcode`, y el
 * link guardado trae shortcode). En ese caso el post pasa a envejecer por su
 * fecha verdadera, que es lo correcto.
 *
 * Las filas sin `posted_at` no se borran nunca: sin fecha no hay antigüedad que
 * medir, y borrar por las dudas es peor que dejarlas.
 *
 * Los comentarios de cada post (`competitor_post_comments`) se van con él por
 * el `on delete cascade` de la migración `0015` — acá no hay que borrarlos.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Post scrapeado sin estrella. */
export const RETENTION_DAYS = 40;

/** Post guardado a mano (portal o estudio). 3 × RETENTION_DAYS. */
export const MANUAL_RETENTION_DAYS = RETENTION_DAYS * 3;

export type PurgeScope = {
  /** Acotar a un owner (el cron no lo pasa: barre todo). */
  ownerId?: string;
  /** Acotar a una marca (lo pasa `runScrapeJob`). */
  clientId?: string;
};

export type PurgeResult = {
  /** Scrapeados sin estrella, más viejos que RETENTION_DAYS. */
  scraped: number;
  /** Guardados a mano, más viejos que MANUAL_RETENTION_DAYS. */
  manual: number;
};

function cutoffISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * Aplica las dos reglas. Devuelve cuántas filas cayó cada una.
 *
 * Va en dos `delete` y no en uno con `or(...)` a propósito: PostgREST arma los
 * `or` anidados con una sintaxis de string que se lee muy mal y se rompe con
 * cambiarle una coma. Dos consultas chicas, cada una legible por separado.
 *
 * Necesita un cliente con **service role**: corre sin sesión de usuario (cron)
 * o tiene que alcanzar filas de otros (no es el caso hoy, pero el llamador ya
 * viene con service role en los dos usos).
 */
export async function purgeExpiredPosts(
  supabase: SupabaseClient,
  scope: PurgeScope = {},
): Promise<PurgeResult> {
  let scrapedQuery = supabase
    .from("competitor_posts")
    .delete({ count: "exact" })
    .eq("is_favorite", false)
    // ⚠️ Sin este filtro, un guardado a mano al que le sacaron la estrella
    // caería a los 40 días por esta primera regla y nunca llegaría a los 120.
    .eq("is_manual", false)
    .lt("posted_at", cutoffISO(RETENTION_DAYS))
    .not("posted_at", "is", null);
  if (scope.ownerId) scrapedQuery = scrapedQuery.eq("owner_id", scope.ownerId);
  if (scope.clientId) scrapedQuery = scrapedQuery.eq("client_id", scope.clientId);

  const { count: scraped, error: scrapedErr } = await scrapedQuery;
  if (scrapedErr) throw new Error(scrapedErr.message);

  let manualQuery = supabase
    .from("competitor_posts")
    .delete({ count: "exact" })
    .eq("is_manual", true)
    .lt("posted_at", cutoffISO(MANUAL_RETENTION_DAYS))
    .not("posted_at", "is", null);
  if (scope.ownerId) manualQuery = manualQuery.eq("owner_id", scope.ownerId);
  if (scope.clientId) manualQuery = manualQuery.eq("client_id", scope.clientId);

  const { count: manual, error: manualErr } = await manualQuery;
  if (manualErr) throw new Error(manualErr.message);

  return { scraped: scraped ?? 0, manual: manual ?? 0 };
}
