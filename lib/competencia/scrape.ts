/**
 * Lógica central de un run de scrape de competencia.
 *
 * Es agnóstica de quién la llama: recibe un cliente de Supabase ya autenticado
 * (sesión del usuario en dev, o service-role en la background function de prod)
 * y el id del scrape a procesar. Reúne las cuentas del cliente, resuelve qué
 * token de Apify le toca a ese cliente, corre Apify y guarda los posts. Marca
 * el estado del scrape en cada paso.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { scrapeCompetitorPosts } from "../apify/client";
import { resolveApifyToken } from "./apifyToken";
import { purgeExpiredPosts } from "./retention";
// El mismo parseo que usa el guardado de links del portal: una sola definición.
import { extractShortcode } from "./savedLink";

export async function runScrapeJob(
  supabase: SupabaseClient,
  scrapeId: string,
): Promise<{ ok: true; inserted: number } | { ok: false; error: string }> {
  // 1. Cargar el scrape
  const { data: scrape, error: scrapeErr } = await supabase
    .from("competitor_scrapes")
    .select("id, owner_id, client_id, n_posts, since_date, status")
    .eq("id", scrapeId)
    .single();

  if (scrapeErr || !scrape) {
    return { ok: false, error: scrapeErr?.message ?? "Scrape no encontrado." };
  }

  async function fail(message: string) {
    await supabase
      .from("competitor_scrapes")
      .update({ status: "error", error: message, updated_at: new Date().toISOString() })
      .eq("id", scrapeId);
    return { ok: false as const, error: message };
  }

  // 2. Marcar como corriendo
  await supabase
    .from("competitor_scrapes")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", scrapeId);

  // 3. Cuentas del cliente
  const { data: competitors, error: compErr } = await supabase
    .from("competitors")
    .select("id, username")
    .eq("owner_id", scrape.owner_id)
    .eq("client_id", scrape.client_id);

  if (compErr) return fail(compErr.message);
  if (!competitors || competitors.length === 0) {
    return fail("Este cliente no tiene cuentas de competencia cargadas.");
  }

  const idByUsername = new Map<string, string>();
  for (const c of competitors) {
    idByUsername.set((c.username as string).toLowerCase(), c.id as string);
  }

  // 4. Resolver el token de Apify de este cliente (propio o global)
  let apifyToken: string;
  try {
    ({ token: apifyToken } = await resolveApifyToken(scrape.client_id as string));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "No se pudo resolver el token de Apify.");
  }

  // 5. Correr Apify
  let posts;
  try {
    posts = await scrapeCompetitorPosts({
      token: apifyToken,
      usernames: competitors.map((c) => c.username as string),
      resultsLimit: scrape.n_posts as number,
      onlyPostsNewerThan: (scrape.since_date as string | null) ?? null,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Falló el scraping en Apify.");
  }

  // 6. Guardar posts (upsert por (owner_id, client_id, shortcode)): si el post ya
  //    existe se ACTUALIZAN sus métricas (likes, comentarios, vistas, followers) con
  //    los datos más recientes en vez de duplicarlo; si es nuevo se inserta.
  const now = new Date().toISOString();
  const rows = posts.map((p) => ({
    owner_id: scrape.owner_id,
    client_id: scrape.client_id,
    competitor_id: idByUsername.get(p.username) ?? null,
    scrape_id: scrapeId,
    username: p.username,
    shortcode: p.shortcode ?? extractShortcode(p.permalink),
    permalink: p.permalink ?? null,
    type: p.type,
    caption: p.caption ?? null,
    likes: p.likes,
    comments: p.comments,
    video_views: p.videoViews ?? null,
    // Se pisa en cada re-scrape del mismo shortcode: es un link firmado de
    // Instagram con vida corta, así que lo que vale es el más reciente.
    video_url: p.videoUrl ?? null,
    followers: p.followers ?? null,
    posted_at: p.postedAt ?? null,
    scraped_at: now,
  }));

  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from("competitor_posts")
      .upsert(rows, { onConflict: "owner_id,client_id,shortcode" });
    if (insErr) return fail(insErr.message);
  }

  // 6b. Limpiar posts vencidos de esta marca ("purgar ya" al que se acaba de
  // scrapear). Las reglas viven en `lib/competencia/retention.ts` y las aplica
  // igual el cron diario `cleanup-competencia-scheduled`, que cubre a las
  // marcas que nadie vuelve a buscar. Best-effort: un fallo acá no tumba un
  // scrape que ya salió bien.
  await purgeExpiredPosts(supabase, {
    ownerId: scrape.owner_id as string,
    clientId: scrape.client_id as string,
  }).catch((e) => {
    console.error("[scrape] no se pudieron purgar los posts vencidos:", e);
  });

  // 7. Actualizar followers de cada cuenta (best-effort, último valor conocido)
  const followersByUser = new Map<string, number>();
  for (const p of posts) {
    if (typeof p.followers === "number") followersByUser.set(p.username, p.followers);
  }
  for (const [username, followers] of followersByUser) {
    const id = idByUsername.get(username);
    if (id) {
      await supabase
        .from("competitors")
        .update({ followers, updated_at: now })
        .eq("id", id);
    }
  }

  // 8. Marcar done
  await supabase
    .from("competitor_scrapes")
    .update({ status: "done", error: null, updated_at: now })
    .eq("id", scrapeId);

  return { ok: true, inserted: rows.length };
}
