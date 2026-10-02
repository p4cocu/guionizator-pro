/**
 * Rendimiento de lo publicado (migración `0022`, punto 6: multiplicar lo que
 * funcionó).
 *
 * Un guion `publicado` se vincula a su post de Instagram y guarda en
 * `scripts.ig_metrics` sus métricas reales JUNTO CON la mediana de la cuenta
 * con la que se comparó. Guardar la mediana importa: la cuenta cambia, y "le
 * fue 2× mejor" solo significa algo contra la referencia de ese momento.
 *
 * ⚠️ Si "funcionó" lo decide el CÓDIGO, no la IA — mismo criterio que los
 * outliers de Competencia y los números de los posts de investigación. El
 * modelo recibe la conclusión ya calculada.
 *
 * Módulo puro: lo usan las server actions, el panel y la tarjeta de Hechos.
 */

import type { IgInsights } from "@/lib/instagram/client";

/**
 * Cuántas veces la mediana de la cuenta tiene que superar una pieza para
 * contar como "funcionó". Decisión de Paco (2026-10-02): 1.5×. Pendiente
 * hacerlo editable (pendientes.md).
 */
export const WORKED_THRESHOLD = 1.5;

/** Cuántos posts recientes de la cuenta forman la mediana. */
export const BASELINE_SAMPLE = 50;

/**
 * Y solo los del último año: una cuenta que estuvo parada años (FLUIA tenía 4
 * posts de 2026 y el resto de 2022) compararía contra otra época de la cuenta.
 */
export const BASELINE_MAX_AGE_DAYS = 365;

/** Antes de esto las métricas todavía se están moviendo: no se juzga. */
export const MIN_AGE_DAYS = 3;

/** Mínimo de posts para que una mediana signifique algo. */
const MIN_SAMPLE = 5;

export type Baseline = {
  /** Mediana de vistas de los videos de la cuenta (null = pocos videos). */
  views_median: number | null;
  /** Mediana de alcance de todos los posts. */
  reach_median: number | null;
  /** Mediana de (compartidos + guardados) ÷ alcance. */
  rate_median: number | null;
  /** Cuántos posts entraron a la muestra. */
  sample: number;
};

export type IgMetrics = {
  reach: number;
  views: number | null;
  likes: number;
  comments: number;
  shares: number;
  saved: number;
  media_type: string | null;
  baseline: Baseline;
};

export type Performance = {
  /** null = muy reciente o sin referencia: no se juzga. */
  worked: boolean | null;
  /** Por qué no se juzga, si no se juzga. */
  pending: string | null;
  /** La mejor comparación contra la cuenta. */
  best: { label: string; x: number } | null;
  /** Todas las comparaciones disponibles, para el detalle. */
  ratios: { label: string; x: number }[];
};

// ─── Cálculo ─────────────────────────────────────────────────────────────────

export function median(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (v.length < MIN_SAMPLE) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** (compartidos + guardados) ÷ alcance. null si no hubo alcance. */
export function interactionRate(i: IgInsights): number | null {
  const reach = i.reach ?? 0;
  if (reach <= 0) return null;
  return ((i.shares ?? 0) + (i.saved ?? 0)) / reach;
}

export function buildBaseline(posts: { media_type: string; timestamp: string; insights: IgInsights }[]): Baseline {
  const since = Date.now() - BASELINE_MAX_AGE_DAYS * 86_400_000;
  const withData = posts.filter(
    (p) => (p.insights.reach ?? 0) > 0 && new Date(p.timestamp).getTime() >= since,
  );
  const videos = withData.filter((p) => p.media_type === "VIDEO");
  return {
    views_median: median(videos.map((p) => p.insights.views ?? 0)),
    reach_median: median(withData.map((p) => p.insights.reach ?? 0)),
    rate_median: median(
      withData.map((p) => interactionRate(p.insights)).filter((r): r is number => r !== null),
    ),
    sample: withData.length,
  };
}

export function toIgMetrics(i: IgInsights, mediaType: string | null, baseline: Baseline): IgMetrics {
  return {
    reach: i.reach ?? 0,
    views: typeof i.views === "number" ? i.views : null,
    likes: i.likes ?? 0,
    comments: i.comments ?? 0,
    shares: i.shares ?? 0,
    saved: i.saved ?? 0,
    media_type: mediaType,
    baseline,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function evaluatePerformance(
  m: IgMetrics | null,
  postedAt: string | null,
  threshold = WORKED_THRESHOLD,
): Performance {
  if (!m) return { worked: null, pending: "Sin métricas", best: null, ratios: [] };
  if (postedAt) {
    const ageDays = (Date.now() - new Date(postedAt).getTime()) / 86_400_000;
    if (ageDays < MIN_AGE_DAYS) {
      return { worked: null, pending: `Muy reciente (menos de ${MIN_AGE_DAYS} días)`, best: null, ratios: [] };
    }
  }

  const b = m.baseline;
  const ratios: { label: string; x: number }[] = [];
  // Video: se compara en vistas contra los videos. Sin vistas (carrusel,
  // imagen), en alcance contra toda la cuenta.
  if (m.views !== null && b.views_median) ratios.push({ label: "tus vistas", x: round1(m.views / b.views_median) });
  else if (b.reach_median) ratios.push({ label: "tu alcance", x: round1(m.reach / b.reach_median) });

  const rate = m.reach > 0 ? (m.shares + m.saved) / m.reach : null;
  if (rate !== null && b.rate_median) {
    ratios.push({ label: "tus compartidos + guardados", x: round1(rate / b.rate_median) });
  }

  if (!ratios.length) {
    return { worked: null, pending: "La cuenta tiene muy pocos posts del último año para comparar", best: null, ratios };
  }
  const best = ratios.reduce((a, r) => (r.x > a.x ? r : a));
  return { worked: best.x >= threshold, pending: null, best, ratios };
}

// ─── Lectura tolerante (jsonb sin esquema) ──────────────────────────────────

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Nunca lanza. null si no hay métricas guardadas. */
export function sanitizeIgMetrics(raw: unknown): IgMetrics | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const b = (r.baseline && typeof r.baseline === "object" ? r.baseline : {}) as Record<string, unknown>;
  return {
    reach: num(r.reach),
    views: numOrNull(r.views),
    likes: num(r.likes),
    comments: num(r.comments),
    shares: num(r.shares),
    saved: num(r.saved),
    media_type: typeof r.media_type === "string" ? r.media_type : null,
    baseline: {
      views_median: numOrNull(b.views_median),
      reach_median: numOrNull(b.reach_median),
      rate_median: numOrNull(b.rate_median),
      sample: num(b.sample),
    },
  };
}

/** "12.3k", "1.2M" — mismo formato corto que Competencia. */
export function shortNumber(n: number): string {
  if (n >= 1_000_000) return `${round1(n / 1_000_000)}M`;
  if (n >= 1_000) return `${round1(n / 1_000)}k`;
  return String(Math.round(n));
}
