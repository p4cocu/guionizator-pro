/**
 * Snapshot de un reporte de competencia.
 *
 * El reporte NO consulta las tablas al descargarse: congela sus filas al momento
 * de generarse. Razón: el cron `cleanup-competencia-scheduled` borra posts con
 * más de 40 días, así que un reporte "en vivo" se vaciaría solo — el cliente
 * abriría en septiembre el reporte de julio y no habría nada. Con el snapshot,
 * el .xlsx y el .pdf se regeneran idénticos siempre.
 *
 * SERVER-ONLY.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  HOOK_TYPES,
  SCRIPT_STRUCTURES,
  VALUE_PILLARS,
  type TaxonomyItem,
} from "../competencia/taxonomy";

export const SNAPSHOT_VERSION = 1 as const;

export type ReportPost = {
  id: string;
  username: string;
  permalink: string | null;
  type: string | null;
  caption: string | null;
  likes: number;
  comments: number;
  videoViews: number | null;
  followers: number | null;
  postedAt: string | null;
  transcription: string | null;
  isFavorite: boolean;
  /** Engagement sobre followers, en %. null si no conocemos los followers. */
  engagementRate: number | null;
  /** Comentarios del post ÷ mediana de comentarios de esa cuenta. */
  outlierMultiple: number | null;
  isOutlier: boolean;
};

export type ReportClassification = {
  hookType: string | null;
  hookTypeLabel: string | null;
  scriptStructure: string | null;
  scriptStructureLabel: string | null;
  valuePillar: string | null;
  valuePillarLabel: string | null;
  notes: string | null;
};

export type ReportScript = {
  id: string;
  title: string | null;
  type: string;
  structureName: string | null;
  /** Guion completo ya renderizado a texto plano, listo para grabar. */
  text: string;
  /** Primera línea / gancho, para la columna resumida del Excel. */
  hook: string;
};

export type ReportRow = {
  post: ReportPost;
  classification: ReportClassification;
  script: ReportScript | null;
};

export type CategoryBreakdown = {
  slug: string;
  label: string;
  count: number;
  avgViews: number | null;
  avgEngagement: number;
};

export type ReportSnapshot = {
  version: typeof SNAPSHOT_VERSION;
  generatedAt: string;
  client: { id: string; nombre: string; marca: string | null };
  period: { start: string | null; end: string | null };
  rows: ReportRow[];
  stats: {
    totalPosts: number;
    withTranscription: number;
    withScript: number;
    hookType: CategoryBreakdown[];
    scriptStructure: CategoryBreakdown[];
    valuePillar: CategoryBreakdown[];
  };
};

// ─── Helpers de taxonomía ─────────────────────────────────────────────────────

function labelOf(entries: TaxonomyItem[], slug: string | null): string | null {
  if (!slug) return null;
  return entries.find((e) => e.slug === slug)?.label ?? slug;
}

// ─── Render de guiones a texto plano ──────────────────────────────────────────

type CarouselSlide = {
  number?: number;
  text?: string;
  body?: string;
  visual?: string;
  micro_anchor?: string | null;
};

/**
 * Convierte el `content` (jsonb) de un guion a texto legible. Los reels guardan
 * `voice_off` (teleprompter); los carruseles, `slides`. Se escribe plano a
 * propósito: este texto va a una celda de Excel y a un párrafo de PDF, ninguno
 * de los dos entiende el markdown ligero (**, _, ==) que usa el editor.
 */
export function scriptToText(content: Record<string, unknown> | null): string {
  if (!content) return "";

  const voiceOff = typeof content.voice_off === "string" ? content.voice_off.trim() : "";
  if (voiceOff) return stripMarkup(voiceOff);

  const slides = Array.isArray(content.slides) ? (content.slides as CarouselSlide[]) : null;
  if (slides?.length) {
    return slides
      .map((s, i) => {
        const n = s.number ?? i + 1;
        const parts = [
          `Slide ${n}: ${stripMarkup(s.text ?? "")}`,
          s.body ? stripMarkup(s.body) : null,
          s.visual ? `[Visual: ${stripMarkup(s.visual)}]` : null,
        ].filter(Boolean);
        return parts.join("\n");
      })
      .join("\n\n");
  }

  return "";
}

/** Quita el markdown ligero del editor (**negrita**, _subrayado_, ==resaltado==). */
function stripMarkup(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/==(.+?)==/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .trim();
}

/** Primera oración/línea del guion — sirve como "gancho" en la vista resumida. */
export function extractHookLine(text: string): string {
  const firstLine = text.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  const firstSentence = firstLine.split(/(?<=[.!?])\s/)[0] ?? firstLine;
  return firstSentence.length > 180 ? `${firstSentence.slice(0, 177)}…` : firstSentence;
}

// ─── Construcción del snapshot ────────────────────────────────────────────────

const OUTLIER_MIN_SAMPLE = 5;
const OUTLIER_MULTIPLE = 3;
const OUTLIER_MIN_EXTRA_COMMENTS = 15;

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type RawPost = {
  id: string;
  username: string;
  permalink: string | null;
  type: string | null;
  caption: string | null;
  likes: number | null;
  comments: number | null;
  video_views: number | null;
  followers: number | null;
  posted_at: string | null;
  transcription: string | null;
  is_favorite: boolean | null;
  is_manual: boolean | null;
  hook_type: string | null;
  script_structure: string | null;
  value_pillar: string | null;
  classification_notes: string | null;
};

type RawScript = {
  id: string;
  client_id: string;
  title: string | null;
  type: string;
  structure_name: string | null;
  content: Record<string, unknown> | null;
  source_post_id: string | null;
  is_latest: boolean | null;
  created_at: string;
};

export type BuildSnapshotResult =
  | { ok: true; snapshot: ReportSnapshot }
  | { ok: false; error: string };

export async function buildReportSnapshot(
  supabase: SupabaseClient,
  ownerId: string,
  input: {
    clientId: string;
    postIds: string[];
    periodStart: string | null;
    periodEnd: string | null;
  },
): Promise<BuildSnapshotResult> {
  if (input.postIds.length === 0) {
    return { ok: false, error: "Selecciona al menos un post para el reporte." };
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, nombre, marca")
    .eq("id", input.clientId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!client) return { ok: false, error: "Cliente no encontrado." };

  const { data: postsData, error: postsErr } = await supabase
    .from("competitor_posts")
    .select(
      "id, username, permalink, type, caption, likes, comments, video_views, followers, posted_at, transcription, is_favorite, is_manual, hook_type, script_structure, value_pillar, classification_notes",
    )
    .eq("owner_id", ownerId)
    .eq("client_id", input.clientId)
    .in("id", input.postIds);

  if (postsErr) return { ok: false, error: postsErr.message };
  const posts = (postsData ?? []) as RawPost[];
  if (posts.length === 0) {
    return { ok: false, error: "Los posts seleccionados ya no existen." };
  }

  // La mediana de comentarios se calcula sobre TODOS los posts de la cuenta en
  // este cliente, no solo los seleccionados: con 3 o 4 posts elegidos a mano la
  // mediana no significaría nada (y justo se eligen los que destacan, lo que
  // inflaría la referencia y escondería el outlier).
  const usernames = Array.from(new Set(posts.map((p) => p.username)));
  const { data: allForMedian } = await supabase
    .from("competitor_posts")
    .select("username, comments, is_manual")
    .eq("owner_id", ownerId)
    .eq("client_id", input.clientId)
    .in("username", usernames);

  const commentsByUser = new Map<string, number[]>();
  for (const r of (allForMedian ?? []) as { username: string; comments: number | null; is_manual: boolean | null }[]) {
    if (r.is_manual) continue;
    const arr = commentsByUser.get(r.username) ?? [];
    arr.push(r.comments ?? 0);
    commentsByUser.set(r.username, arr);
  }
  const medianByUser = new Map<string, number>();
  for (const [username, arr] of commentsByUser) {
    if (arr.length >= OUTLIER_MIN_SAMPLE) medianByUser.set(username, median(arr));
  }

  // Guiones adaptados de estos posts. Se acota al cliente del reporte: un guion
  // de OTRA marca sale de este mismo post cuando Paco adapta entre clientes, y
  // no tiene nada que hacer en el reporte de este cliente.
  const { data: scriptsData } = await supabase
    .from("scripts")
    .select("id, client_id, title, type, structure_name, content, source_post_id, is_latest, created_at")
    .eq("owner_id", ownerId)
    .eq("client_id", input.clientId)
    .in("source_post_id", posts.map((p) => p.id));

  const scriptByPost = new Map<string, RawScript>();
  for (const s of (scriptsData ?? []) as RawScript[]) {
    if (!s.source_post_id) continue;
    const prev = scriptByPost.get(s.source_post_id);
    // Preferimos la última versión; a igualdad, la más reciente.
    if (
      !prev ||
      (s.is_latest && !prev.is_latest) ||
      (s.is_latest === prev.is_latest && s.created_at > prev.created_at)
    ) {
      scriptByPost.set(s.source_post_id, s);
    }
  }

  const rows: ReportRow[] = posts.map((p) => {
    const likes = p.likes ?? 0;
    const comments = p.comments ?? 0;
    const med = medianByUser.get(p.username) ?? null;
    const outlierMultiple = med != null && med > 0 ? comments / med : null;
    const rawScript = scriptByPost.get(p.id) ?? null;
    const text = rawScript ? scriptToText(rawScript.content) : "";

    return {
      post: {
        id: p.id,
        username: p.username,
        permalink: p.permalink,
        type: p.type,
        caption: p.caption,
        likes,
        comments,
        videoViews: p.video_views,
        followers: p.followers,
        postedAt: p.posted_at,
        transcription: p.transcription,
        isFavorite: p.is_favorite ?? false,
        engagementRate:
          p.followers && p.followers > 0
            ? Number((((likes + comments) / p.followers) * 100).toFixed(2))
            : null,
        outlierMultiple: outlierMultiple != null ? Number(outlierMultiple.toFixed(1)) : null,
        isOutlier:
          !p.is_manual &&
          outlierMultiple != null &&
          outlierMultiple >= OUTLIER_MULTIPLE &&
          comments - (med ?? 0) >= OUTLIER_MIN_EXTRA_COMMENTS,
      },
      classification: {
        hookType: p.hook_type,
        hookTypeLabel: labelOf(HOOK_TYPES, p.hook_type),
        scriptStructure: p.script_structure,
        scriptStructureLabel: labelOf(SCRIPT_STRUCTURES, p.script_structure),
        valuePillar: p.value_pillar,
        valuePillarLabel: labelOf(VALUE_PILLARS, p.value_pillar),
        notes: p.classification_notes,
      },
      script: rawScript
        ? {
            id: rawScript.id,
            title: rawScript.title,
            type: rawScript.type,
            structureName: rawScript.structure_name,
            text,
            hook: extractHookLine(text),
          }
        : null,
    };
  });

  // Orden de entrega: primero lo más accionable. Los que ya tienen guion listo
  // encabezan, luego por múltiplo de outlier y por engagement.
  rows.sort((a, b) => {
    if (Boolean(a.script) !== Boolean(b.script)) return a.script ? -1 : 1;
    const om = (b.post.outlierMultiple ?? 0) - (a.post.outlierMultiple ?? 0);
    if (om !== 0) return om;
    return b.post.likes + b.post.comments - (a.post.likes + a.post.comments);
  });

  function breakdown(
    dim: "hookType" | "scriptStructure" | "valuePillar",
    entries: TaxonomyItem[],
  ): CategoryBreakdown[] {
    const acc = new Map<string, { count: number; viewsSum: number; viewsN: number; engSum: number }>();
    for (const r of rows) {
      const slug = r.classification[dim];
      if (!slug) continue;
      const a = acc.get(slug) ?? { count: 0, viewsSum: 0, viewsN: 0, engSum: 0 };
      a.count += 1;
      a.engSum += r.post.likes + r.post.comments;
      if (r.post.videoViews != null) {
        a.viewsSum += r.post.videoViews;
        a.viewsN += 1;
      }
      acc.set(slug, a);
    }
    return Array.from(acc.entries())
      .map(([slug, a]) => ({
        slug,
        label: labelOf(entries, slug) ?? slug,
        count: a.count,
        avgViews: a.viewsN > 0 ? Math.round(a.viewsSum / a.viewsN) : null,
        avgEngagement: Math.round(a.engSum / a.count),
      }))
      .sort((x, y) => y.count - x.count);
  }

  return {
    ok: true,
    snapshot: {
      version: SNAPSHOT_VERSION,
      generatedAt: new Date().toISOString(),
      client: {
        id: client.id as string,
        nombre: client.nombre as string,
        marca: (client.marca as string | null) ?? null,
      },
      period: { start: input.periodStart, end: input.periodEnd },
      rows,
      stats: {
        totalPosts: rows.length,
        withTranscription: rows.filter((r) => (r.post.transcription ?? "").trim() !== "").length,
        withScript: rows.filter((r) => r.script != null).length,
        hookType: breakdown("hookType", HOOK_TYPES),
        scriptStructure: breakdown("scriptStructure", SCRIPT_STRUCTURES),
        valuePillar: breakdown("valuePillar", VALUE_PILLARS),
      },
    },
  };
}
