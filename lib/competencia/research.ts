/**
 * Posts de investigación (migración `0020`): "analicé N reels de cuentas de
 * dentistas y esto es lo que hacen los que más se ven".
 *
 * La regla de oro: **los números los calcula este módulo, nunca la IA.** El
 * prompt recibe el bloque ya armado (`researchToPrompt`) con la orden de usar
 * esos números tal cual. Así la afirmación del post es verdad.
 *
 * - Nicho = `competitors.niche` de la cuenta (se cruza por `client_id` +
 *   `username`). Con nicho, el hallazgo es de PATRONES (ganchos, estructuras),
 *   aunque cada reel hable de otra cosa.
 * - Tema = `competitor_posts.topic` (lo pone `classifyPost`). Filtrar por tema
 *   permite afirmar "analicé 25 reels sobre recordatorios de citas".
 * - Debajo de `MIN_RESEARCH_POSTS` no se arma el post: la muestra no sostiene
 *   ninguna afirmación.
 *
 * Módulo puro (no importa Supabase).
 */

import { labelFor, type ClassificationDimension } from "./taxonomy";

export const MIN_RESEARCH_POSTS = 10;

export function normalizeNiche(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 60);
  return t || null;
}

/** Igual que el nicho: el modelo devuelve "Recordatorios de citas" y "recordatorios de citas". */
export const normalizeTopic = normalizeNiche;

export type ResearchPost = {
  /** Clave para no contar dos veces el mismo reel guardado en dos marcas. */
  key: string;
  username: string;
  niche: string | null;
  topic: string | null;
  hook_type: string | null;
  script_structure: string | null;
  value_pillar: string | null;
  video_views: number | null;
  likes: number | null;
  comments: number | null;
  transcription: string | null;
};

export type ResearchOption = { niche: string; count: number; topics: { topic: string; count: number }[] };

/** Nichos con su cantidad de reels y, dentro de cada uno, los temas. Para los selectores. */
export function researchOptions(posts: ResearchPost[]): ResearchOption[] {
  const byNiche = new Map<string, ResearchPost[]>();
  for (const p of dedupe(posts)) {
    if (!p.niche) continue;
    byNiche.set(p.niche, [...(byNiche.get(p.niche) ?? []), p]);
  }
  return [...byNiche.entries()]
    .map(([niche, list]) => {
      const topics = new Map<string, number>();
      for (const p of list) if (p.topic) topics.set(p.topic, (topics.get(p.topic) ?? 0) + 1);
      return {
        niche,
        count: list.length,
        topics: [...topics.entries()]
          .map(([topic, count]) => ({ topic, count }))
          .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic)),
      };
    })
    .sort((a, b) => b.count - a.count);
}

function dedupe(posts: ResearchPost[]): ResearchPost[] {
  const seen = new Map<string, ResearchPost>();
  for (const p of posts) if (!seen.has(p.key)) seen.set(p.key, p);
  return [...seen.values()];
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export type ResearchBreakdown = { slug: string; label: string; count: number; pct: number; medianViews: number | null };

export type ResearchStats = {
  niche: string;
  topic: string | null;
  posts: number;
  accounts: number;
  medianViews: number | null;
  /** Cuántos tienen vistas (los carruseles no traen). */
  withViews: number;
  hook_type: ResearchBreakdown[];
  script_structure: ResearchBreakdown[];
  value_pillar: ResearchBreakdown[];
  /** Los 5 más vistos, con el arranque de su transcripción. */
  top: { username: string; views: number; hook: ResearchBreakdown["label"] | null; opening: string | null }[];
};

export function computeResearch(
  all: ResearchPost[],
  filter: { niche: string; topic?: string | null },
): ResearchStats | null {
  const niche = normalizeNiche(filter.niche);
  const topic = normalizeTopic(filter.topic);
  if (!niche) return null;
  const posts = dedupe(all).filter((p) => p.niche === niche && (!topic || p.topic === topic));

  const views = posts.map((p) => p.video_views).filter((v): v is number => typeof v === "number" && v > 0);

  function breakdown(dim: ClassificationDimension): ResearchBreakdown[] {
    const groups = new Map<string, ResearchPost[]>();
    for (const p of posts) {
      const slug = p[dim];
      if (slug) groups.set(slug, [...(groups.get(slug) ?? []), p]);
    }
    return [...groups.entries()]
      .map(([slug, list]) => ({
        slug,
        label: labelFor(dim, slug) ?? slug,
        count: list.length,
        pct: Math.round((list.length / posts.length) * 100),
        medianViews: median(list.map((p) => p.video_views).filter((v): v is number => typeof v === "number" && v > 0)),
      }))
      .sort((a, b) => b.count - a.count);
  }

  return {
    niche,
    topic,
    posts: posts.length,
    accounts: new Set(posts.map((p) => p.username)).size,
    medianViews: median(views),
    withViews: views.length,
    hook_type: breakdown("hook_type"),
    script_structure: breakdown("script_structure"),
    value_pillar: breakdown("value_pillar"),
    top: posts
      .filter((p) => (p.video_views ?? 0) > 0)
      .sort((a, b) => (b.video_views ?? 0) - (a.video_views ?? 0))
      .slice(0, 5)
      .map((p) => ({
        username: p.username,
        views: p.video_views ?? 0,
        hook: labelFor("hook_type", p.hook_type),
        opening: p.transcription ? p.transcription.trim().split(/(?<=[.!?¿?])\s+/)[0].slice(0, 160) : null,
      })),
  };
}

const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString("es-MX"));

/** El bloque que va al prompt. Los números ya vienen calculados. */
export function researchToPrompt(s: ResearchStats): string {
  const list = (items: ResearchBreakdown[]) =>
    items
      .slice(0, 5)
      .map((b) => `- ${b.label}: ${b.count} de ${s.posts} (${b.pct}%)${b.medianViews != null ? ` · mediana de vistas ${fmt(b.medianViews)}` : ""}`)
      .join("\n");
  return [
    `**Muestra:** ${s.posts} reels de ${s.accounts} cuentas del nicho "${s.niche}"${s.topic ? `, todos sobre "${s.topic}"` : ""}.`,
    s.medianViews != null && `**Mediana de vistas:** ${fmt(s.medianViews)} (de ${s.withViews} reels con vistas).`,
    `**Tipos de gancho más usados:**\n${list(s.hook_type)}`,
    `**Estructuras más usadas:**\n${list(s.script_structure)}`,
    `**Pilares de valor más usados:**\n${list(s.value_pillar)}`,
    s.top.length > 0 &&
      `**Los ${s.top.length} más vistos:**\n${s.top
        .map((t) => `- @${t.username} · ${fmt(t.views)} vistas${t.hook ? ` · gancho ${t.hook}` : ""}${t.opening ? ` · arranca: "${t.opening}"` : ""}`)
        .join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
