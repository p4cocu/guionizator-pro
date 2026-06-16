"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runScrapeJob } from "@/lib/competencia/scrape";

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

// ─── Clientes (para el selector) ──────────────────────────────────────────────

export async function listClients() {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("clients")
    .select("id, nombre, marca")
    .eq("owner_id", user.id)
    .order("nombre", { ascending: true });
  return (data ?? []).map((c) => ({
    id: c.id as string,
    nombre: c.nombre as string,
    marca: (c.marca as string | null) ?? null,
  }));
}

// ─── Cuentas de competencia ───────────────────────────────────────────────────

export type Competitor = {
  id: string;
  username: string;
  display_name: string | null;
  followers: number | null;
};

export async function listCompetitors(clientId: string): Promise<Competitor[]> {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("competitors")
    .select("id, username, display_name, followers")
    .eq("owner_id", user.id)
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Competitor[];
}

export type AddResult =
  | { ok: true; competitor: Competitor }
  | { ok: false; error: string };

export async function addCompetitor(
  clientId: string,
  rawUsername: string,
  displayName?: string,
): Promise<AddResult> {
  const username = rawUsername.trim().replace(/^@/, "").replace(/\/$/, "").toLowerCase();
  if (!username) return { ok: false, error: "Escribe un usuario válido." };

  const { supabase, user } = await getAuthUser();
  const { data, error } = await supabase
    .from("competitors")
    .insert({
      owner_id: user.id,
      client_id: clientId,
      username,
      display_name: displayName?.trim() || null,
    })
    .select("id, username, display_name, followers")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Esa cuenta ya está agregada." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/competencia");
  return { ok: true, competitor: data as Competitor };
}

export async function removeCompetitor(id: string) {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase
    .from("competitors")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/competencia");
}

// ─── Ejecutar búsqueda (scrape) ───────────────────────────────────────────────

export type StartScrapeResult =
  | { ok: true; scrapeId: string; mode: "sync" | "background" }
  | { ok: false; error: string };

/**
 * Crea el registro del scrape y lo dispara.
 * - Con SCRAPE_FN_SECRET (producción): invoca la background function de Netlify
 *   y vuelve enseguida; el front consulta el estado por polling.
 * - Sin ese secreto (dev local): corre el scrape de forma síncrona aquí mismo.
 */
export async function startScrape(
  clientId: string,
  nPosts: number,
  sinceDate: string | null,
): Promise<StartScrapeResult> {
  const { supabase, user } = await getAuthUser();

  const token = process.env.APIFY_API_TOKEN;
  if (!token) return { ok: false, error: "Falta APIFY_API_TOKEN en el servidor." };

  // Validar que haya cuentas cargadas
  const { count } = await supabase
    .from("competitors")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("client_id", clientId);
  if (!count) return { ok: false, error: "Agrega al menos una cuenta de competencia." };

  const { data: scrape, error } = await supabase
    .from("competitor_scrapes")
    .insert({
      owner_id: user.id,
      client_id: clientId,
      n_posts: nPosts,
      since_date: sinceDate,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !scrape) {
    return { ok: false, error: error?.message ?? "No se pudo crear el scrape." };
  }
  const scrapeId = scrape.id as string;

  const secret = process.env.SCRAPE_FN_SECRET;
  if (secret) {
    // Producción: disparar la background function (no esperamos a que termine)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    try {
      await fetch(`${siteUrl}/.netlify/functions/scrape-competencia-background`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-scrape-secret": secret },
        body: JSON.stringify({ scrapeId }),
      });
    } catch (e) {
      await supabase
        .from("competitor_scrapes")
        .update({ status: "error", error: "No se pudo disparar el worker." })
        .eq("id", scrapeId);
      return { ok: false, error: e instanceof Error ? e.message : "Worker no disponible." };
    }
    return { ok: true, scrapeId, mode: "background" };
  }

  // Dev: correr síncrono con la sesión del usuario
  const result = await runScrapeJob(supabase, scrapeId, token);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, scrapeId, mode: "sync" };
}

export type ScrapeStatus = {
  status: "pending" | "running" | "done" | "error";
  error: string | null;
};

export async function getScrapeStatus(scrapeId: string): Promise<ScrapeStatus | null> {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("competitor_scrapes")
    .select("status, error")
    .eq("id", scrapeId)
    .eq("owner_id", user.id)
    .maybeSingle();
  return data ? (data as ScrapeStatus) : null;
}

// ─── Resultados ───────────────────────────────────────────────────────────────

export type CompetitorPost = {
  id: string;
  username: string;
  permalink: string | null;
  type: string | null;
  caption: string | null;
  likes: number;
  comments: number;
  video_views: number | null;
  followers: number | null;
  posted_at: string | null;
  transcription: string | null;
};

export type LatestResults = {
  scrapeId: string | null;
  scrapedAt: string | null;
  posts: CompetitorPost[];
};

/**
 * Devuelve TODOS los posts acumulados del cliente (deduplicados por post vía el
 * índice único). Así la investigación persiste entre búsquedas: al re-scrapear se
 * actualizan las métricas de los posts repetidos y se agregan los nuevos, sin
 * perder lo anterior. `scrapedAt` es la fecha de la última búsqueda `done`.
 */
export async function getLatestResults(clientId: string): Promise<LatestResults> {
  const { supabase, user } = await getAuthUser();

  const { data: scrape } = await supabase
    .from("competitor_scrapes")
    .select("id, updated_at")
    .eq("owner_id", user.id)
    .eq("client_id", clientId)
    .eq("status", "done")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: posts } = await supabase
    .from("competitor_posts")
    .select(
      "id, username, permalink, type, caption, likes, comments, video_views, followers, posted_at, transcription",
    )
    .eq("owner_id", user.id)
    .eq("client_id", clientId);

  return {
    scrapeId: (scrape?.id as string) ?? null,
    scrapedAt: (scrape?.updated_at as string) ?? null,
    posts: (posts ?? []) as CompetitorPost[],
  };
}
