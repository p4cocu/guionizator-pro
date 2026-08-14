/**
 * Detección de outliers en posts de competencia.
 *
 * Vivía dentro de `app/(app)/competencia/actions.ts`, que es un módulo
 * `"use server"`: ahí **todo export tiene que ser una función async**, así que
 * no se podía compartir. El portal de cliente (Fase D, etapa 5) muestra los
 * mismos posts marcados igual, y duplicar los umbrales garantizaba que un día
 * quedaran distintos.
 *
 * Módulo puro: sin Supabase, sin servidor. Lo pueden importar tanto un server
 * component como un `"use client"`.
 *
 * ── El criterio ──
 * Un post es "outlier" cuando sus comentarios superan por mucho (≥3×) la
 * mediana de comentarios de esa misma cuenta. Se usa mediana y no promedio
 * porque el propio outlier, incluido en un promedio, infla la referencia y
 * esconde el efecto (un post viral entre pocos posts ya sesga la media). Se
 * piden al menos 5 posts no-manuales de la cuenta para tener una mediana
 * confiable; cuentas con menos muestra no se marcan.
 */

const OUTLIER_MIN_SAMPLE = 5;
const OUTLIER_MULTIPLE = 3;
/**
 * Con medianas muy bajas (cuentas chicas: mediana de 1-5 comentarios), el
 * múltiplo 3× se dispara con ruido normal (mediana 5 → 16 comentarios ya
 * "califica" sin ser un post realmente destacado). Se exige además una
 * diferencia absoluta mínima sobre la mediana.
 */
const OUTLIER_MIN_EXTRA_COMMENTS = 15;

/** Lo mínimo que necesita un post para poder clasificarse. */
export type OutlierInput = {
  username: string;
  comments: number | null;
  is_manual: boolean;
};

/** Lo que agrega `withOutliers` a cada post. */
export type OutlierFlags = {
  is_outlier: boolean;
  /** Cuántas veces la mediana de la cuenta. `null` si no hay muestra suficiente. */
  outlier_multiple: number | null;
  account_median_comments: number | null;
};

export function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Marca los outliers de una tanda de posts. La mediana se calcula **por cuenta**
 * y sobre todos los posts recibidos, así que hay que pasarle la lista completa
 * del cliente — no un subconjunto filtrado, o la referencia deja de significar
 * algo (mismo criterio que el snapshot de reportes).
 */
export function withOutliers<T extends OutlierInput>(posts: T[]): (T & OutlierFlags)[] {
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
