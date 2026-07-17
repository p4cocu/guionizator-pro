"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runScrapeJob } from "@/lib/competencia/scrape";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL_FAST } from "@/lib/ai/anthropic";
import {
  buildTaxonomyPrompt,
  HOOK_TYPE_SLUGS,
  SCRIPT_STRUCTURE_SLUGS,
  VALUE_PILLAR_SLUGS,
} from "@/lib/competencia/taxonomy";

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
      const res = await fetch(`${siteUrl}/.netlify/functions/scrape-competencia-background`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-scrape-secret": secret },
        body: JSON.stringify({ scrapeId }),
      });
      // fetch() no lanza en respuestas no-2xx (ej. 307 de un redirect a /login,
      // 401, 500) — sin este chequeo el trigger queda "exitoso" en falso y el
      // scrape se queda colgado en "pending" para siempre, sin avisar.
      if (!res.ok) {
        throw new Error(`El worker respondió ${res.status} (${res.redirected ? "redirigido" : "sin redirect"}).`);
      }
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
  is_favorite: boolean;
  is_disliked: boolean;
  is_manual: boolean;
  hook_type: string | null;
  script_structure: string | null;
  value_pillar: string | null;
  classification_notes: string | null;
  classified_at: string | null;
  is_outlier: boolean;
  outlier_multiple: number | null;
  account_median_comments: number | null;
};

/** Columnas base de un post (sin los derivados de outlier). */
const POST_COLUMNS =
  "id, username, permalink, type, caption, likes, comments, video_views, followers, posted_at, transcription, is_favorite, is_disliked, is_manual, hook_type, script_structure, value_pillar, classification_notes, classified_at";

export type LatestResults = {
  scrapeId: string | null;
  scrapedAt: string | null;
  posts: CompetitorPost[];
};

// ─── Detección de outliers ─────────────────────────────────────────────────
// Un post es "outlier" cuando sus comentarios superan por mucho (≥3×) la
// mediana de comentarios de esa misma cuenta. Se usa mediana en vez de
// promedio porque el propio outlier, si se incluyera en un promedio, infla la
// referencia y esconde el efecto (un post viral entre pocos posts ya sesga la
// media). Se requieren al menos 5 posts no-manuales de la cuenta para tener
// una mediana confiable; cuentas con menos muestra no se marcan.
const OUTLIER_MIN_SAMPLE = 5;
const OUTLIER_MULTIPLE = 3;
// Con medianas muy bajas (cuentas chicas: mediana de 1-5 comentarios), el
// múltiplo 3x se dispara con ruido normal (ej. mediana 5 → 16 comentarios ya
// "califica" sin ser un post realmente destacado). Exigimos además una
// diferencia absoluta mínima sobre la mediana para que cuente como outlier.
const OUTLIER_MIN_EXTRA_COMMENTS = 15;

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function withOutliers(
  posts: Omit<CompetitorPost, "is_outlier" | "outlier_multiple" | "account_median_comments">[],
): CompetitorPost[] {
  const commentsByUser = new Map<string, number[]>();
  for (const p of posts) {
    if (p.is_manual) continue;
    const arr = commentsByUser.get(p.username) ?? [];
    arr.push(p.comments ?? 0);
    commentsByUser.set(p.username, arr);
  }

  const medianByUser = new Map<string, number>();
  for (const [username, arr] of commentsByUser) {
    if (arr.length >= OUTLIER_MIN_SAMPLE) medianByUser.set(username, median(arr));
  }

  return posts.map((p) => {
    const med = medianByUser.get(p.username) ?? null;
    const outlierMultiple = med != null && med > 0 ? (p.comments ?? 0) / med : null;
    const isOutlier =
      !p.is_manual &&
      outlierMultiple != null &&
      outlierMultiple >= OUTLIER_MULTIPLE &&
      (p.comments ?? 0) - (med ?? 0) >= OUTLIER_MIN_EXTRA_COMMENTS;
    return {
      ...p,
      account_median_comments: med,
      outlier_multiple: outlierMultiple,
      is_outlier: isOutlier,
    };
  });
}

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
    .select(POST_COLUMNS)
    .eq("owner_id", user.id)
    .eq("client_id", clientId);

  return {
    scrapeId: (scrape?.id as string) ?? null,
    scrapedAt: (scrape?.updated_at as string) ?? null,
    posts: withOutliers(
      (posts ?? []) as Omit<
        CompetitorPost,
        "is_outlier" | "outlier_multiple" | "account_median_comments"
      >[],
    ),
  };
}

export async function deleteCompetitorPost(postId: string): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase
    .from("competitor_posts")
    .delete()
    .eq("id", postId)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
}

export async function toggleFavoritePost(postId: string, value: boolean): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase
    .from("competitor_posts")
    .update({ is_favorite: value })
    .eq("id", postId)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
}

export async function toggleDislikePost(postId: string, value: boolean): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase
    .from("competitor_posts")
    .update({ is_disliked: value })
    .eq("id", postId)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
}

export type AddManualPostInput = {
  clientId: string;
  permalink: string;
  username: string;
  type: "video" | "carousel" | "image";
  caption: string;
};

export type AddManualPostResult =
  | { ok: true; post: CompetitorPost }
  | { ok: false; error: string };

export async function addManualPost(input: AddManualPostInput): Promise<AddManualPostResult> {
  const { supabase, user } = await getAuthUser();

  const permalink = input.permalink.trim() || null;
  const username = input.username.trim().replace(/^@/, "").toLowerCase();
  if (!username) return { ok: false, error: "El usuario es requerido." };

  const { data, error } = await supabase
    .from("competitor_posts")
    .insert({
      owner_id: user.id,
      client_id: input.clientId,
      username,
      permalink,
      type: input.type,
      caption: input.caption.trim() || null,
      likes: 0,
      comments: 0,
      video_views: null,
      followers: null,
      posted_at: new Date().toISOString(),
      is_manual: true,
      is_favorite: false,
      is_disliked: false,
    })
    .select(POST_COLUMNS)
    .single();

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    post: {
      ...(data as Omit<CompetitorPost, "is_outlier" | "outlier_multiple" | "account_median_comments">),
      is_outlier: false,
      outlier_multiple: null,
      account_median_comments: null,
    },
  };
}

// ─── Clasificación por IA (gancho / estructura / pilar) ───────────────────────

export type Classification = {
  hook_type: string | null;
  script_structure: string | null;
  value_pillar: string | null;
  classification_notes: string | null;
  classified_at: string | null;
};

export type ClassifyResult =
  | { ok: true; classification: Classification }
  | { ok: false; error: string };

/** Valida que el valor devuelto por la IA esté en el enum; si no, null (evita romper el CHECK). */
function validSlug(value: unknown, allowed: string[]): string | null {
  return typeof value === "string" && allowed.includes(value) ? value : null;
}

/**
 * Clasifica un post con transcripción en las 3 taxonomías de Andrea Estratega.
 * 1 llamada a Claude por post (patrón de `extractHook`), con reintento para
 * blindar el parseo del JSON. Valida cada valor contra el enum antes de guardar.
 */
export async function classifyPost(postId: string): Promise<ClassifyResult> {
  const { supabase, user } = await getAuthUser();

  const { data: post } = await supabase
    .from("competitor_posts")
    .select("id, transcription, caption")
    .eq("id", postId)
    .eq("owner_id", user.id)
    .single();

  if (!post) return { ok: false, error: "Post no encontrado." };

  const transcription = (post.transcription as string | null)?.trim() ?? "";
  const caption = (post.caption as string | null)?.trim() ?? "";
  if (!transcription && !caption) {
    return { ok: false, error: "El post no tiene transcripción ni descripción para analizar." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "Falta ANTHROPIC_API_KEY." };
  const ai = new Anthropic({ apiKey });

  const prompt = `Eres analista experto en contenido de Instagram (Reels y carruseles) en español latinoamericano, formado en la metodología de Andrea Estratega (Fórmula 100K).

Clasifica el siguiente contenido en TRES dimensiones. Elige SIEMPRE exactamente una opción por dimensión (la que mejor domine la pieza), usando el slug exacto.

${buildTaxonomyPrompt()}

Devuelve ÚNICAMENTE este JSON (sin markdown, sin explicaciones fuera del JSON):
{
  "hook_type": "<slug de tipo de gancho>",
  "script_structure": "<slug de estructura>",
  "value_pillar": "<slug de pilar>",
  "notes": "1 frase breve explicando por qué elegiste esas categorías"
}

${caption ? `DESCRIPCIÓN / CAPTION:\n${caption.slice(0, 800)}\n\n` : ""}TRANSCRIPCIÓN:
${transcription.slice(0, 4000) || "(sin transcripción; clasifica con base en la descripción)"}`;

  async function askOnce(): Promise<Record<string, unknown> | null> {
    const response = await ai.messages.create({
      model: MODEL_FAST,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    try {
      const match = text.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : text) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  // Reintento: hasta 2 intentos si el parseo falla (atiende el pendiente de retry de IA).
  let parsed = await askOnce();
  if (!parsed) parsed = await askOnce();
  if (!parsed) {
    return { ok: false, error: "La IA no devolvió un formato válido. Intenta de nuevo." };
  }

  const classification: Classification = {
    hook_type: validSlug(parsed.hook_type, HOOK_TYPE_SLUGS),
    script_structure: validSlug(parsed.script_structure, SCRIPT_STRUCTURE_SLUGS),
    value_pillar: validSlug(parsed.value_pillar, VALUE_PILLAR_SLUGS),
    classification_notes:
      typeof parsed.notes === "string" ? parsed.notes.trim().slice(0, 500) : null,
    classified_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("competitor_posts")
    .update({
      hook_type: classification.hook_type,
      script_structure: classification.script_structure,
      value_pillar: classification.value_pillar,
      classification_notes: classification.classification_notes,
      classified_at: classification.classified_at,
    })
    .eq("id", postId)
    .eq("owner_id", user.id);

  if (updateError) return { ok: false, error: updateError.message };

  return { ok: true, classification };
}

// ─── Estadísticas de clasificación (subvista de Análisis) ─────────────────────

export type CategoryStat = {
  slug: string;
  count: number;
  /** Vistas promedio de los posts en esta categoría (Reels con video_views). */
  avgViews: number | null;
  /** Engagement promedio (likes + comentarios). */
  avgEngagement: number;
};

export type ClassificationStats = {
  totalClassified: number;
  totalWithTranscription: number;
  pending: number;
  hook_type: CategoryStat[];
  script_structure: CategoryStat[];
  value_pillar: CategoryStat[];
};

export async function getClassificationStats(clientId: string): Promise<ClassificationStats> {
  const { supabase, user } = await getAuthUser();

  const { data } = await supabase
    .from("competitor_posts")
    .select(
      "hook_type, script_structure, value_pillar, transcription, classified_at, likes, comments, video_views",
    )
    .eq("owner_id", user.id)
    .eq("client_id", clientId);

  const rows = (data ?? []) as {
    hook_type: string | null;
    script_structure: string | null;
    value_pillar: string | null;
    transcription: string | null;
    classified_at: string | null;
    likes: number | null;
    comments: number | null;
    video_views: number | null;
  }[];

  const totalClassified = rows.filter((r) => r.classified_at != null).length;
  const totalWithTranscription = rows.filter((r) => (r.transcription ?? "").trim() !== "").length;
  const pending = rows.filter(
    (r) => (r.transcription ?? "").trim() !== "" && r.classified_at == null,
  ).length;

  function aggregate(dim: "hook_type" | "script_structure" | "value_pillar"): CategoryStat[] {
    const byslug = new Map<string, { count: number; viewsSum: number; viewsN: number; engSum: number }>();
    for (const r of rows) {
      const slug = r[dim];
      if (!slug) continue;
      const acc = byslug.get(slug) ?? { count: 0, viewsSum: 0, viewsN: 0, engSum: 0 };
      acc.count += 1;
      acc.engSum += (r.likes ?? 0) + (r.comments ?? 0);
      if (r.video_views != null) {
        acc.viewsSum += r.video_views;
        acc.viewsN += 1;
      }
      byslug.set(slug, acc);
    }
    return Array.from(byslug.entries()).map(([slug, a]) => ({
      slug,
      count: a.count,
      avgViews: a.viewsN > 0 ? Math.round(a.viewsSum / a.viewsN) : null,
      avgEngagement: a.count > 0 ? Math.round(a.engSum / a.count) : 0,
    }));
  }

  return {
    totalClassified,
    totalWithTranscription,
    pending,
    hook_type: aggregate("hook_type"),
    script_structure: aggregate("script_structure"),
    value_pillar: aggregate("value_pillar"),
  };
}
