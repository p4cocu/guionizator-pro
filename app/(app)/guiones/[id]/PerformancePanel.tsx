"use client";

/**
 * Panel "Rendimiento en Instagram" al pie de un guion publicado (migración
 * `0022`, punto 6). Vincula el guion con su post, muestra las métricas contra
 * la mediana de la cuenta y, si funcionó, ofrece "✦ Multiplicar": el esqueleto
 * de la pieza + 3 variaciones que lo mantienen y cambian una sola cosa.
 *
 * Se dibuja desde `page.tsx`, fuera de `ScriptDetailClient`, igual que
 * `ClientFeedbackPanel`.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  linkIgPost,
  listIgPostsForScript,
  multiplyScript,
  refreshIgMetrics,
  type IgPostOption,
} from "../rendimiento/actions";
import {
  evaluatePerformance,
  sanitizeIgMetrics,
  shortNumber,
  WORKED_THRESHOLD,
  type IgMetrics,
} from "@/lib/multiply/metrics";
import {
  hookTextWarning,
  variationBrief,
  VARIATION_AXES,
  type MultiplyResult,
} from "@/lib/multiply/prompt";
import SkeletonView from "@/components/skeleton/SkeletonView";
import s from "./performance.module.css";

type LinkState = {
  ig_media_id: string | null;
  ig_permalink: string | null;
  ig_posted_at: string | null;
  ig_metrics: IgMetrics | null;
  ig_metrics_at: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export default function PerformancePanel({
  scriptId,
  clientId,
  scriptTitle,
  productId,
  initial,
}: {
  scriptId: string;
  clientId: string;
  scriptTitle: string;
  productId: string | null;
  initial: {
    ig_media_id: string | null;
    ig_permalink: string | null;
    ig_posted_at: string | null;
    ig_metrics: unknown;
    ig_metrics_at: string | null;
  };
}) {
  const router = useRouter();
  const [link, setLink] = useState<LinkState>({ ...initial, ig_metrics: sanitizeIgMetrics(initial.ig_metrics) });
  const [posts, setPosts] = useState<IgPostOption[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<null | "posts" | "link" | "refresh" | "multiply">(null);
  const [error, setError] = useState<string | null>(null);
  const [multi, setMulti] = useState<(MultiplyResult & { performance: string }) | null>(null);

  const perf = evaluatePerformance(link.ig_metrics, link.ig_posted_at);
  const m = link.ig_metrics;

  async function openPicker() {
    setError(null);
    setPicking(true);
    if (posts) return;
    setBusy("posts");
    try {
      const res = await listIgPostsForScript(scriptId);
      if (res.ok) setPosts(res.posts);
      else {
        setError(res.error);
        setPicking(false);
      }
    } catch {
      setError("No se pudieron traer los posts.");
      setPicking(false);
    } finally {
      setBusy(null);
    }
  }

  async function choose(mediaId: string | null) {
    setError(null);
    setBusy("link");
    try {
      const res = await linkIgPost(scriptId, mediaId);
      if (res.ok) {
        setLink(res);
        setPicking(false);
        setMulti(null);
        router.refresh();
      } else setError(res.error);
    } catch {
      setError("No se pudo guardar el vínculo.");
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    setError(null);
    setBusy("refresh");
    try {
      const res = await refreshIgMetrics(clientId);
      if (!res.ok) setError(res.error);
      else if (res.errors.length) setError(res.errors[0]);
      // Las métricas nuevas llegan por props al refrescar la página.
      router.refresh();
    } catch {
      setError("No se pudieron actualizar las métricas.");
    } finally {
      setBusy(null);
    }
  }

  async function multiply() {
    setError(null);
    setBusy("multiply");
    try {
      const res = await multiplyScript(scriptId);
      if (res.ok) setMulti(res);
      else setError(res.error);
    } catch {
      setError("No se pudo multiplicar. Intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  function develop(i: number) {
    if (!multi) return;
    const brief = variationBrief({
      originalTitle: scriptTitle,
      performance: multi.performance,
      skeleton: multi.skeleton,
      variation: multi.variations[i],
    });
    const params = new URLSearchParams({
      client_id: clientId,
      type: multi.variations[i].type,
      brief,
      ...(productId ? { product_id: productId } : {}),
    });
    router.push(`/guiones/nuevo?${params.toString()}`);
  }

  return (
    <section className={s.panel} id="rendimiento">
      <div className={s.head}>
        <h2 className={s.title}>Rendimiento en Instagram</h2>
        {link.ig_media_id && perf.worked && perf.best && (
          <span className={s.worked}>🔥 Funcionó · {perf.best.x}× {perf.best.label}</span>
        )}
        {link.ig_media_id && perf.worked === false && perf.best && (
          <span className={s.normal}>Dentro de lo normal · {perf.best.x}× {perf.best.label}</span>
        )}
        {link.ig_media_id && perf.pending && <span className={s.normal}>{perf.pending}</span>}
      </div>

      {!link.ig_media_id && !picking && (
        <div className={s.empty}>
          <p>Vincula este guion con su post para medir cómo le fue contra el resto de tu cuenta.</p>
          <button className="btn btn-secondary" onClick={openPicker} disabled={busy !== null}>
            Vincular su post
          </button>
        </div>
      )}

      {link.ig_media_id && m && (
        <>
          <div className={s.metrics}>
            {m.views !== null && <Metric label="Vistas" value={m.views} median={m.baseline.views_median} />}
            <Metric label="Alcance" value={m.reach} median={m.baseline.reach_median} />
            <Metric label="Likes" value={m.likes} />
            <Metric label="Comentarios" value={m.comments} />
            <Metric label="Compartidos" value={m.shares} />
            <Metric label="Guardados" value={m.saved} />
          </div>
          <p className={s.meta}>
            Publicado el {formatDate(link.ig_posted_at)}
            {link.ig_permalink && (
              <>
                {" · "}
                <a href={link.ig_permalink} target="_blank" rel="noreferrer">
                  Ver en Instagram ↗
                </a>
              </>
            )}
            {" · "}Comparado contra la mediana de {m.baseline.sample} posts del último año · “Funcionó” = {WORKED_THRESHOLD}× o más
            {link.ig_metrics_at && ` · Medido el ${formatDate(link.ig_metrics_at)}`}
          </p>
          {perf.ratios.length > 1 && (
            <p className={s.meta}>{perf.ratios.map((r) => `${r.x}× ${r.label}`).join(" · ")}</p>
          )}
        </>
      )}

      {link.ig_media_id && !m && <p className={s.meta}>Vinculado, todavía sin métricas.</p>}

      {link.ig_media_id && !picking && (
        <div className={s.actions}>
          {perf.worked && (
            <button className="btn btn-primary" onClick={multiply} disabled={busy !== null}>
              {busy === "multiply" ? "Multiplicando… (~10 s)" : multi ? "↻ Otras 3 variaciones" : "✦ Multiplicar"}
            </button>
          )}
          <button className="btn btn-secondary" onClick={refresh} disabled={busy !== null}>
            {busy === "refresh" ? "Actualizando…" : "Actualizar métricas"}
          </button>
          <button className="btn btn-ghost" onClick={openPicker} disabled={busy !== null}>
            Cambiar post
          </button>
          <button className="btn btn-ghost" onClick={() => choose(null)} disabled={busy !== null}>
            Desvincular
          </button>
        </div>
      )}

      {picking && (
        <div className={s.picker}>
          <div className={s.pickerHead}>
            <span>¿Cuál es su post?</span>
            <button className="btn btn-ghost" onClick={() => setPicking(false)} disabled={busy === "link"}>
              Cancelar
            </button>
          </div>
          {busy === "posts" && <p className={s.meta}>Trayendo tus últimos posts…</p>}
          {posts && posts.length === 0 && <p className={s.meta}>La cuenta no tiene posts.</p>}
          {posts && posts.length > 0 && (
            <ul className={s.postList}>
              {posts.map((p) => {
                const current = p.id === link.ig_media_id;
                const other = p.linked_script_id && p.linked_script_id !== scriptId;
                return (
                  <li key={p.id}>
                    <button
                      className={`${s.post} ${current ? s.postCurrent : ""}`}
                      onClick={() => choose(p.id)}
                      disabled={busy !== null || current}
                    >
                      {p.thumbnail ? (
                        // Miniaturas del CDN de Instagram: vencen, no se guardan.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumbnail} alt="" className={s.thumb} />
                      ) : (
                        <span className={s.thumbEmpty}>{p.media_type === "VIDEO" ? "▶" : "▦"}</span>
                      )}
                      <span className={s.postText}>
                        <span className={s.postDate}>
                          {formatDate(p.timestamp)}
                          {current && " · vinculado"}
                          {other && " · ya está en otro guion"}
                        </span>
                        <span className={s.postCaption}>{p.caption || "Sin descripción"}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {error && <p className={s.error}>{error}</p>}

      {multi && (
        <div className={s.multiply}>
          <p className={s.meta}>Anatomía del post: lo que lo hizo funcionar.</p>
          <SkeletonView skeleton={multi.skeleton} timed={false} />
          <p className={s.meta}>3 variaciones con esa misma anatomía. Cada una cambia una sola cosa:</p>
          <div className={s.variations}>
            {multi.variations.map((v, i) => {
              const axis = VARIATION_AXES.find((a) => a.id === v.axis);
              const warn = hookTextWarning(v);
              return (
                <article key={v.axis} className={s.variation}>
                  <span className={s.axis}>
                    {axis?.label} · {v.type === "carousel" ? "Carrusel" : "Reel"}
                  </span>
                  <h3 className={s.varTitle}>{v.title}</h3>
                  {v.what_changes && <p className={s.changes}>{v.what_changes}</p>}
                  <p className={s.angle}>{v.angle}</p>
                  <dl className={s.layers}>
                    {v.hook_text && (
                      <>
                        <dt>Pantalla</dt>
                        <dd>{v.hook_text}</dd>
                      </>
                    )}
                    {v.hook_visual && (
                      <>
                        <dt>Se ve</dt>
                        <dd>{v.hook_visual}</dd>
                      </>
                    )}
                    {v.hook && (
                      <>
                        <dt>Dice</dt>
                        <dd>{v.hook}</dd>
                      </>
                    )}
                  </dl>
                  {warn && <p className={s.warn}>⚠ {warn}</p>}
                  <button className="btn btn-secondary" onClick={() => develop(i)}>
                    Desarrollar →
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, median }: { label: string; value: number; median?: number | null }) {
  return (
    <div className={s.metric}>
      <span className={s.metricValue}>{shortNumber(value)}</span>
      <span className={s.metricLabel}>{label}</span>
      {median != null && <span className={s.metricMedian}>mediana {shortNumber(median)}</span>}
    </div>
  );
}
