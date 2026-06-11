"use client";

import { useMemo, useState, useTransition } from "react";
import { fetchBestPosts, type PostWithMetrics } from "./actions";
import s from "./instagram.module.css";

type Account = { id: string; username: string; clientName: string | null };

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

  function load(id: string) {
    if (!id) return;
    setError(null);
    setLoaded(false);
    start(async () => {
      const res = await fetchBestPosts(id);
      if (res.ok) {
        setPosts(res.posts);
        setLoaded(true);
      } else {
        setError(res.error);
        setPosts(null);
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
            {sorted.map((p, i) => (
              <a
                key={p.id}
                href={p.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className={s.postCard}
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
            ))}
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
