"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  fetchBestPosts,
  getTranscriptionStatuses,
  queueTranscription,
  type PostWithMetrics,
  type TranscriptionStatus,
} from "./actions";
import s from "./instagram.module.css";

type Account = {
  id: string;
  username: string;
  clientId: string | null;
  clientName: string | null;
};

type Pattern = { titulo: string; porque: string };
type Idea = { titulo: string; gancho: string; formato: string; porque: string };
type Analysis = { resumen: string; patrones: Pattern[]; ideas: Idea[] };

type Props = { accounts: Account[] };

type MetricKey = "reach" | "likes" | "comments" | "shares" | "saved" | "views";

const METRIC_LABELS: Record<MetricKey, string> = {
  reach: "Alcance",
  likes: "Likes",
  comments: "Comentarios",
  shares: "Compartidos",
  saved: "Guardados",
  views: "Vistas",
};

function fmt(n: number | undefined): string {
  if (n == null) return "—";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export default function InstagramDashboard({ accounts }: Props) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [posts, setPosts] = useState<PostWithMetrics[] | null>(null);
  const [sortBy, setSortBy] = useState<MetricKey>("reach");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isPending, start] = useTransition();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, startAnalysis] = useTransition();

  // Transcription state: ig_media_id → status
  const [transcriptionMap, setTranscriptionMap] = useState<
    Record<string, TranscriptionStatus>
  >({});
  const [queuingId, setQueuingId] = useState<string | null>(null);
  const [expandedTranscript, setExpandedTranscript] = useState<string | null>(null);

  const currentAccount = accounts.find((a) => a.id === accountId) ?? null;

  function resetAnalysis() {
    setAnalysis(null);
    setAnalysisError(null);
  }

  function load(id: string) {
    if (!id) return;
    setError(null);
    setLoaded(false);
    resetAnalysis();
    setTranscriptionMap({});
    start(async () => {
      const res = await fetchBestPosts(id);
      if (res.ok) {
        setPosts(res.posts);
        setLoaded(true);
        // Cargar estados de transcripción existentes
        const ts = await getTranscriptionStatuses(id);
        if (ts.ok) setTranscriptionMap(ts.statuses);
      } else {
        setError(res.error);
        setPosts(null);
      }
    });
  }

  // Poll cada 5 s mientras haya jobs pending o processing
  useEffect(() => {
    const hasActive = Object.values(transcriptionMap).some(
      (j) => j.status === "pending" || j.status === "processing",
    );
    if (!hasActive || !accountId) return;

    const interval = setInterval(async () => {
      const result = await getTranscriptionStatuses(accountId);
      if (result.ok) setTranscriptionMap(result.statuses);
    }, 5000);

    return () => clearInterval(interval);
  }, [transcriptionMap, accountId]);

  async function handleTranscribe(post: PostWithMetrics) {
    setQueuingId(post.id);
    const result = await queueTranscription(accountId, {
      ig_media_id: post.id,
      media_type: post.media_type,
      media_url: post.media_url,
      thumbnail_url: post.thumbnail_url,
      permalink: post.permalink,
      caption: post.caption,
      timestamp: post.timestamp,
    });
    if (result.ok) {
      setTranscriptionMap((prev) => ({
        ...prev,
        [post.id]: prev[post.id] ?? { status: "pending" },
      }));
    }
    setQueuingId(null);
  }

  function analyze() {
    if (!posts || posts.length === 0) return;
    setAnalysisError(null);
    setAnalysis(null);
    startAnalysis(async () => {
      try {
        const res = await fetch("/api/ai/instagram-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: currentAccount?.clientId ?? null,
            posts: posts.map((p) => ({
              caption: p.caption,
              media_type: p.media_type,
              timestamp: p.timestamp,
              permalink: p.permalink,
              insights: p.insights,
              transcript: transcriptionMap[p.id]?.transcript,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setAnalysisError(data.error ?? "No se pudo generar el análisis.");
          return;
        }
        setAnalysis(data as Analysis);
      } catch {
        setAnalysisError("No se pudo generar el análisis.");
      }
    });
  }

  const sorted = useMemo(() => {
    if (!posts) return [];
    return [...posts].sort(
      (a, b) => (b.insights[sortBy] ?? 0) - (a.insights[sortBy] ?? 0),
    );
  }, [posts, sortBy]);

  const totals = useMemo(() => {
    const t: Record<MetricKey, number> = {
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saved: 0,
      views: 0,
    };
    for (const p of posts ?? [])
      for (const k of Object.keys(t) as MetricKey[])
        t[k] += p.insights[k] ?? 0;
    return t;
  }, [posts]);

  const transcribedCount = useMemo(
    () => Object.values(transcriptionMap).filter((j) => j.status === "done").length,
    [transcriptionMap],
  );

  if (accounts.length === 0) {
    return (
      <div>
        <h1 className="text-grad">Instagram</h1>
        <div className="card" style={{ marginTop: 20, padding: 24 }}>
          <p style={{ marginBottom: 8 }}>
            No tenés ninguna cuenta de Instagram conectada todavía.
          </p>
          <p style={{ fontSize: 14, opacity: 0.75 }}>
            Andá al perfil de un cliente y conectá su cuenta en la sección
            <strong> Instagram</strong> para empezar a ver métricas aquí.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={s.header}>
        <h1 className="text-grad">Instagram</h1>
        <div className={s.controls}>
          <select
            className="input"
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setPosts(null);
              setLoaded(false);
              resetAnalysis();
              setTranscriptionMap({});
            }}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                @{a.username}
                {a.clientName ? ` · ${a.clientName}` : ""}
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={() => load(accountId)}
            disabled={isPending}
          >
            {isPending ? "Cargando…" : "Cargar métricas"}
          </button>
        </div>
      </div>

      {error && <p className={s.error}>{error}</p>}

      {loaded && posts && (
        <>
          <div className={s.statsRow}>
            {(Object.keys(METRIC_LABELS) as MetricKey[]).map((k) => (
              <div key={k} className={s.statCard}>
                <span className={s.statValue}>{fmt(totals[k])}</span>
                <span className={s.statLabel}>{METRIC_LABELS[k]}</span>
              </div>
            ))}
          </div>

          <div className={s.analyzeBar}>
            <div>
              <span className={s.analyzeTitle}>Análisis con IA</span>
              <p className={s.analyzeHint}>
                Qué está funcionando, por qué, e ideas a partir de tus posts.
                {transcribedCount > 0 && (
                  <span className={s.transcribedNote}>
                    {" "}· {transcribedCount} reel{transcribedCount !== 1 ? "s" : ""} con transcripción incluida.
                  </span>
                )}
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={analyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? "Analizando…" : "Analizar con IA"}
            </button>
          </div>

          {analysisError && <p className={s.error}>{analysisError}</p>}

          {analysis && (
            <div className={`card ${s.analysisPanel}`}>
              {analysis.resumen && (
                <p className={s.analysisResumen}>{analysis.resumen}</p>
              )}

              {analysis.patrones?.length > 0 && (
                <div className={s.analysisBlock}>
                  <span className="eyebrow">Qué funciona y por qué</span>
                  <ul className={s.analysisList}>
                    {analysis.patrones.map((p, i) => (
                      <li key={i} className={s.analysisItem}>
                        <strong>{p.titulo}</strong>
                        <span>{p.porque}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.ideas?.length > 0 && (
                <div className={s.analysisBlock}>
                  <span className="eyebrow">Ideas de contenido</span>
                  <div className={s.ideaGrid}>
                    {analysis.ideas.map((idea, i) => (
                      <div key={i} className={s.ideaCard}>
                        <div className={s.ideaHead}>
                          <strong>{idea.titulo}</strong>
                          <span className="badge">{idea.formato}</span>
                        </div>
                        {idea.gancho && (
                          <p className={s.ideaHook}>"{idea.gancho}"</p>
                        )}
                        <p className={s.ideaWhy}>{idea.porque}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={s.sortRow}>
            <span className={s.sortLabel}>Mejores por:</span>
            {(Object.keys(METRIC_LABELS) as MetricKey[]).map((k) => (
              <button
                key={k}
                className={`${s.sortChip} ${sortBy === k ? s.sortChipActive : ""}`}
                onClick={() => setSortBy(k)}
              >
                {METRIC_LABELS[k]}
              </button>
            ))}
          </div>

          <div className={s.grid}>
            {sorted.map((p, i) => {
              const ts = transcriptionMap[p.id];
              const isVideo = p.media_type === "VIDEO";
              const isQueuing = queuingId === p.id;

              return (
                <div key={p.id} className={s.postCard}>
                  <a
                    href={p.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={s.postLink}
                  >
                    <div className={s.rank}>#{i + 1}</div>
                    {(p.thumbnail_url || p.media_url) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbnail_url || p.media_url}
                        alt={p.caption?.slice(0, 40) ?? "post"}
                        className={s.postImg}
                      />
                    )}
                    <div className={s.postBody}>
                      <span className={s.postHero}>
                        {fmt(p.insights[sortBy])} {METRIC_LABELS[sortBy]}
                      </span>
                      {p.caption && (
                        <p className={s.postCaption}>{p.caption.slice(0, 80)}</p>
                      )}
                      <div className={s.postMetrics}>
                        <span>❤️ {fmt(p.insights.likes)}</span>
                        <span>💬 {fmt(p.insights.comments)}</span>
                        <span>🔖 {fmt(p.insights.saved)}</span>
                        <span>📤 {fmt(p.insights.shares)}</span>
                      </div>
                    </div>
                  </a>

                  {/* Franja de transcripción — solo para VIDEO */}
                  {isVideo && (
                    <div className={s.transcriptBar}>
                      {!ts && (
                        <button
                          className={s.transcriptBtn}
                          onClick={() => handleTranscribe(p)}
                          disabled={isQueuing}
                        >
                          {isQueuing ? "Encolando…" : "🎙 Transcribir"}
                        </button>
                      )}
                      {ts?.status === "pending" && (
                        <span className={`${s.transcriptBadge} ${s.badgePending}`}>
                          ⏳ En cola
                        </span>
                      )}
                      {ts?.status === "processing" && (
                        <span className={`${s.transcriptBadge} ${s.badgeProcessing}`}>
                          ⚙️ Procesando…
                        </span>
                      )}
                      {ts?.status === "error" && (
                        <div className={s.transcriptError}>
                          <span>Error: {ts.error ?? "desconocido"}</span>
                          <button
                            className={s.transcriptBtn}
                            onClick={() => handleTranscribe(p)}
                            disabled={isQueuing}
                          >
                            Reintentar
                          </button>
                        </div>
                      )}
                      {ts?.status === "done" && ts.transcript && (
                        <>
                          <button
                            className={`${s.transcriptBadge} ${s.badgeDone}`}
                            onClick={() =>
                              setExpandedTranscript(
                                expandedTranscript === p.id ? null : p.id,
                              )
                            }
                          >
                            ✅ Transcripción{" "}
                            {expandedTranscript === p.id ? "▲" : "▼"}
                          </button>
                          {expandedTranscript === p.id && (
                            <p className={s.transcriptText}>{ts.transcript}</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loaded && !isPending && (
        <p style={{ marginTop: 24, opacity: 0.7, fontSize: 14 }}>
          Elegí una cuenta y presioná <strong>Cargar métricas</strong>.
        </p>
      )}
    </div>
  );
}
