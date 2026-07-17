"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getClassificationStats,
  getLatestResults,
  type CategoryStat,
  type ClassificationStats,
  type CompetitorPost,
} from "../actions";
import {
  DIMENSIONS,
  labelFor,
  colorFor,
  type ClassificationDimension,
} from "@/lib/competencia/taxonomy";
import s from "./analisis.module.css";

type Client = { id: string; nombre: string; marca: string | null };
type Props = { clients: Client[]; initialClientId: string | null };

type Metric = "count" | "avgViews" | "avgEngagement";

const METRIC_LABELS: Record<Metric, string> = {
  count: "Cantidad de posts",
  avgViews: "Vistas promedio",
  avgEngagement: "Engagement promedio",
};

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

export default function AnalisisClient({ clients, initialClientId }: Props) {
  const [clientId, setClientId] = useState(
    initialClientId && clients.some((c) => c.id === initialClientId)
      ? initialClientId
      : clients[0]?.id ?? "",
  );
  const [stats, setStats] = useState<ClassificationStats | null>(null);
  const [posts, setPosts] = useState<CompetitorPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<Metric>("count");
  const [selected, setSelected] = useState<{ dim: ClassificationDimension; slug: string } | null>(
    null,
  );

  // ── Cargar stats + posts al cambiar de cliente ──
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setLoading(true);
    setSelected(null);
    (async () => {
      const [st, results] = await Promise.all([
        getClassificationStats(clientId),
        getLatestResults(clientId),
      ]);
      if (cancelled) return;
      setStats(st);
      setPosts(results.posts);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // ── Script de embeds de Instagram ──
  useEffect(() => {
    if (document.getElementById("ig-embed-script")) return;
    const sc = document.createElement("script");
    sc.id = "ig-embed-script";
    sc.async = true;
    sc.src = "https://www.instagram.com/embed.js";
    document.body.appendChild(sc);
  }, []);

  const filteredPosts = useMemo(() => {
    if (!selected) return [];
    return posts
      .filter((p) => (p[selected.dim] as string | null) === selected.slug)
      .sort((a, b) => (b.video_views ?? 0) - (a.video_views ?? 0));
  }, [posts, selected]);

  useEffect(() => {
    const t = setTimeout(() => window.instgrm?.Embeds.process(), 300);
    return () => clearTimeout(t);
  }, [filteredPosts]);

  function metricValue(stat: CategoryStat): number | null {
    if (metric === "count") return stat.count;
    if (metric === "avgViews") return stat.avgViews;
    return stat.avgEngagement;
  }

  const currentClient = clients.find((c) => c.id === clientId);

  if (clients.length === 0) {
    return (
      <div>
        <div className={s.header}>
          <h1 className="text-grad">Análisis de Competencia</h1>
        </div>
        <div className="card" style={{ marginTop: 20, padding: 24 }}>
          <p>Primero crea un cliente y corre una búsqueda en <strong>Competencia</strong>.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={s.header}>
        <div>
          <Link href="/competencia" className={s.back}>
            ← Volver a Competencia
          </Link>
          <h1 className="text-grad">Análisis de Competencia</h1>
        </div>
        <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
              {c.marca ? ` · ${c.marca}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* ── Resumen ── */}
      {stats && (
        <div className={s.summary}>
          <Stat value={String(stats.totalClassified)} label="Posts clasificados" />
          <Stat value={String(stats.totalWithTranscription)} label="Con transcripción" />
          <Stat
            value={String(stats.pending)}
            label="Pendientes de clasificar"
            accent={stats.pending > 0}
          />
        </div>
      )}

      {stats && stats.totalClassified === 0 && !loading && (
        <div className="card" style={{ marginTop: 16, padding: 24 }}>
          <p>
            Todavía no hay contenido clasificado para{" "}
            <strong>{currentClient?.nombre ?? "este cliente"}</strong>. Transcribe posts en
            Competencia y usa <strong>“Clasificar pendientes”</strong> para ver las gráficas aquí.
          </p>
        </div>
      )}

      {stats && stats.totalClassified > 0 && (
        <>
          {/* ── Selector de métrica ── */}
          <div className={s.metricRow}>
            <span className={s.metricLabel}>Medir por:</span>
            {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
              <button
                key={m}
                className={`${s.chipBtn} ${metric === m ? s.chipBtnActive : ""}`}
                onClick={() => setMetric(m)}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>

          {/* ── Gráficas por dimensión ── */}
          <div className={s.charts}>
            {DIMENSIONS.map(({ key, title, items }) => {
              const statList = stats[key];
              const byslug = new Map(statList.map((st) => [st.slug, st]));
              const values = items
                .map((it) => metricValue(byslug.get(it.slug) ?? { slug: it.slug, count: 0, avgViews: null, avgEngagement: 0 }))
                .filter((v): v is number => v != null && v > 0);
              const max = values.length > 0 ? Math.max(...values) : 1;

              return (
                <div key={key} className={`card ${s.chartCard}`}>
                  <h2 className={s.chartTitle}>{title}</h2>
                  <div className={s.bars}>
                    {items.map((it) => {
                      const st = byslug.get(it.slug);
                      const val = st ? metricValue(st) : null;
                      const isSel = selected?.dim === key && selected.slug === it.slug;
                      const width = val != null && val > 0 ? Math.max(4, (val / max) * 100) : 0;
                      const clickable = (st?.count ?? 0) > 0;
                      return (
                        <button
                          key={it.slug}
                          className={`${s.barRow} ${isSel ? s.barRowActive : ""}`}
                          disabled={!clickable}
                          onClick={() =>
                            setSelected(isSel ? null : { dim: key, slug: it.slug })
                          }
                        >
                          <span className={s.barLabel}>{it.label}</span>
                          <span className={s.barTrack}>
                            <span
                              className={s.barFill}
                              style={{ width: `${width}%`, background: colorFor(key, it.slug) }}
                            />
                          </span>
                          <span className={s.barValue}>
                            {metric === "count" ? (st?.count ?? 0) : fmt(val)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Posts filtrados por categoría ── */}
          {selected && (
            <div className={s.filteredSection}>
              <div className={s.filteredHead}>
                <h2 className={s.chartTitle}>
                  {DIMENSIONS.find((d) => d.key === selected.dim)?.title}:{" "}
                  <span style={{ color: colorFor(selected.dim, selected.slug) }}>
                    {labelFor(selected.dim, selected.slug)}
                  </span>{" "}
                  <span className={s.filteredCount}>({filteredPosts.length})</span>
                </h2>
                <button className={s.clearBtn} onClick={() => setSelected(null)}>
                  Limpiar filtro
                </button>
              </div>
              <div className={s.grid}>
                {filteredPosts.map((p) => (
                  <div key={p.id} className={s.postCard}>
                    <div className={s.postTop}>
                      <a
                        className={s.user}
                        href={`https://www.instagram.com/${p.username}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        @{p.username}
                      </a>
                      <span className={s.postMetricsInline}>
                        {p.video_views != null && <span>▶️ {fmt(p.video_views)}</span>}
                        <span>❤️ {fmt(p.likes)}</span>
                        <span>💬 {fmt(p.comments)}</span>
                      </span>
                    </div>
                    {p.permalink ? (
                      <blockquote
                        className="instagram-media"
                        data-instgrm-permalink={p.permalink}
                        data-instgrm-version="14"
                        style={{ margin: 0, width: "100%", minWidth: 0 }}
                      />
                    ) : (
                      <div className={s.noEmbed}>Sin enlace embebible</div>
                    )}
                    <div className={s.tags}>
                      {DIMENSIONS.map(({ key }) => {
                        const slug = p[key] as string | null;
                        if (!slug) return null;
                        return (
                          <span
                            key={key}
                            className={s.tag}
                            style={{ borderColor: colorFor(key, slug), color: colorFor(key, slug) }}
                          >
                            {labelFor(key, slug)}
                          </span>
                        );
                      })}
                    </div>
                    {p.transcription && (
                      <details className={s.transcript}>
                        <summary>Ver transcripción</summary>
                        <p>{p.transcription}</p>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {loading && <p className={s.loading}>Cargando…</p>}
    </div>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className={`${s.statCard} ${accent ? s.statCardAccent : ""}`}>
      <span className={s.statValue}>{value}</span>
      <span className={s.statLabel}>{label}</span>
    </div>
  );
}
