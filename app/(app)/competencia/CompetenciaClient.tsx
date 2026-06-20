"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  addCompetitor,
  addManualPost,
  deleteCompetitorPost,
  getLatestResults,
  getScrapeStatus,
  listCompetitors,
  removeCompetitor,
  startScrape,
  toggleDislikePost,
  toggleFavoritePost,
  type Competitor,
  type CompetitorPost,
} from "./actions";
import AdaptarModal from "./AdaptarModal";
import GanchoModal from "./GanchoModal";
import s from "./competencia.module.css";

type Client = { id: string; nombre: string; marca: string | null };
type Props = { clients: Client[] };

const transcribeEnabled = process.env.NEXT_PUBLIC_TRANSCRIBE_ENABLED === "true";

type SortKey = "views" | "likes" | "comments" | "engagement" | "recent" | "manual";
type TypeFilter = "all" | "video" | "carousel" | "image";

const SORT_LABELS: Record<SortKey, string> = {
  manual: "Agregados manualmente",
  views: "Más vistos",
  engagement: "Mejor engagement",
  likes: "Más likes",
  comments: "Más comentarios",
  recent: "Más recientes",
};

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "Todos",
  video: "Reels",
  carousel: "Carruseles",
  image: "Imágenes",
};

const N_OPTIONS = [5, 10, 15, 30, 50];

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function eng(p: CompetitorPost): number {
  return (p.likes ?? 0) + (p.comments ?? 0);
}

function fmtAgo(hours: number): string {
  if (hours < 1) return "hace menos de 1 hora";
  if (hours < 24) return `hace ${Math.round(hours)} h`;
  const d = Math.round(hours / 24);
  return `hace ${d} día${d !== 1 ? "s" : ""}`;
}

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

export default function CompetenciaClient({ clients }: Props) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [newUser, setNewUser] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, startAdd] = useTransition();

  const [nPosts, setNPosts] = useState(10);
  const [sinceDate, setSinceDate] = useState("");

  const [posts, setPosts] = useState<CompetitorPost[]>([]);
  const [scrapedAt, setScrapedAt] = useState<string | null>(null);
  // Horas desde la última búsqueda; se calcula al setear scrapedAt (Date.now no
  // puede vivir en render/useMemo por la regla react-hooks/purity).
  const [hoursSinceScrape, setHoursSinceScrape] = useState<number | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const [sortBy, setSortBy] = useState<SortKey>("views");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");

  const [competitorSort, setCompetitorSort] = useState<"added" | "name" | "followers">("added");
  const [adaptingPost, setAdaptingPost] = useState<CompetitorPost | null>(null);
  const [adaptTargetClientId, setAdaptTargetClientId] = useState<string | null>(null);
  const [ganchoPost, setGanchoPost] = useState<CompetitorPost | null>(null);
  const [otherBrandPickerPostId, setOtherBrandPickerPostId] = useState<string | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [visibleCount, setVisibleCount] = useState(15);

  const PAGE_SIZE = 15;

  // ── Formulario agregar manual ──
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [manualUser, setManualUser] = useState("");
  const [manualType, setManualType] = useState<"video" | "carousel" | "image">("video");
  const [manualCaption, setManualCaption] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [isAddingManual, startAddManual] = useTransition();

  const sortedCompetitors = useMemo(() => {
    const list = competitors.slice();
    if (competitorSort === "name") list.sort((a, b) => a.username.localeCompare(b.username));
    else if (competitorSort === "followers") list.sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));
    return list;
  }, [competitors, competitorSort]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cargar cuentas + últimos resultados al cambiar de cliente ──
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const [comps, results] = await Promise.all([
        listCompetitors(clientId),
        getLatestResults(clientId),
      ]);
      if (cancelled) return;
      setCompetitors(comps);
      setPosts(results.posts);
      setScrapedAt(results.scrapedAt);
      setAccountFilter("all");
      setTypeFilter("all");
      setVisibleCount(15);
      const hrs = results.scrapedAt
        ? (Date.now() - new Date(results.scrapedAt).getTime()) / 3_600_000
        : null;
      setHoursSinceScrape(hrs);
      // Si la base se actualizó hace <72h, recomendamos un re-scrape ligero (5 posts)
      // que refresca métricas de los posts repetidos sin gastar créditos de más.
      if (hrs != null && hrs < 72) setNPosts(5);
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [clientId]);

  // ── Cargar el script de embeds de Instagram una vez ──
  useEffect(() => {
    if (document.getElementById("ig-embed-script")) return;
    const sc = document.createElement("script");
    sc.id = "ig-embed-script";
    sc.async = true;
    sc.src = "https://www.instagram.com/embed.js";
    document.body.appendChild(sc);
  }, []);

  // ── Procesar embeds cada vez que cambia la lista visible ──
  const sorted = useMemo(() => {
    setVisibleCount(15);
    let list = posts.slice();
    if (onlyFavorites) list = list.filter((p) => p.is_favorite);
    if (typeFilter !== "all") list = list.filter((p) => p.type === typeFilter);
    if (accountFilter !== "all") list = list.filter((p) => p.username === accountFilter);
    list.sort((a, b) => {
      switch (sortBy) {
        case "manual":
          if (a.is_manual === b.is_manual) return 0;
          return a.is_manual ? -1 : 1;
        case "views":
          return (b.video_views ?? 0) - (a.video_views ?? 0);
        case "likes":
          return (b.likes ?? 0) - (a.likes ?? 0);
        case "comments":
          return (b.comments ?? 0) - (a.comments ?? 0);
        case "engagement":
          return eng(b) - eng(a);
        case "recent":
          return (
            new Date(b.posted_at ?? 0).getTime() - new Date(a.posted_at ?? 0).getTime()
          );
      }
    });
    return list;
  }, [posts, sortBy, typeFilter, accountFilter, onlyFavorites]);

  useEffect(() => {
    const t = setTimeout(() => window.instgrm?.Embeds.process(), 300);
    return () => clearTimeout(t);
  }, [sorted]);

  // ── Promedio de engagement por cuenta (para el badge de outlier) ──
  const avgByUser = useMemo(() => {
    const sum = new Map<string, { total: number; n: number }>();
    for (const p of posts) {
      const cur = sum.get(p.username) ?? { total: 0, n: 0 };
      cur.total += eng(p);
      cur.n += 1;
      sum.set(p.username, cur);
    }
    const out = new Map<string, number>();
    for (const [u, v] of sum) out.set(u, v.n ? v.total / v.n : 0);
    return out;
  }, [posts]);

  // ── Totales para las tarjetas (dinámicos: respetan los filtros activos) ──
  // Se calculan sobre `sorted` (ya filtrado por cuenta y tipo) para que al
  // seleccionar una competencia los recuadros muestren SUS datos, no los de todos.
  const totals = useMemo(() => {
    let likes = 0,
      comments = 0,
      views = 0;
    for (const p of sorted) {
      likes += p.likes ?? 0;
      comments += p.comments ?? 0;
      views += p.video_views ?? 0;
    }
    const accounts = accountFilter === "all" ? competitors.length : 1;
    return { likes, comments, views, accounts, posts: sorted.length };
  }, [sorted, competitors.length, accountFilter]);

  // ── Acciones ──
  function handleAdd() {
    const u = newUser.trim();
    if (!u) return;
    setAddError(null);
    startAdd(async () => {
      const res = await addCompetitor(clientId, u);
      if (res.ok) {
        setCompetitors((prev) => [...prev, res.competitor]);
        setNewUser("");
      } else {
        setAddError(res.error);
      }
    });
  }

  async function handleRemove(id: string) {
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
    await removeCompetitor(id);
  }

  async function runSearch() {
    if (!clientId || competitors.length === 0) return;
    setRunError(null);
    setRunning(true);
    if (pollRef.current) clearInterval(pollRef.current);

    const res = await startScrape(clientId, nPosts, sinceDate || null);
    if (!res.ok) {
      setRunError(res.error);
      setRunning(false);
      return;
    }

    if (res.mode === "sync") {
      const results = await getLatestResults(clientId);
      setPosts(results.posts);
      setScrapedAt(results.scrapedAt);
      setHoursSinceScrape(
        results.scrapedAt
          ? (Date.now() - new Date(results.scrapedAt).getTime()) / 3_600_000
          : null,
      );
      setRunning(false);
      return;
    }

    // background: poll status
    pollRef.current = setInterval(async () => {
      const st = await getScrapeStatus(res.scrapeId);
      if (!st) return;
      if (st.status === "done") {
        if (pollRef.current) clearInterval(pollRef.current);
        const results = await getLatestResults(clientId);
        setPosts(results.posts);
        setScrapedAt(results.scrapedAt);
        setHoursSinceScrape(
          results.scrapedAt
            ? (Date.now() - new Date(results.scrapedAt).getTime()) / 3_600_000
            : null,
        );
        setRunning(false);
      } else if (st.status === "error") {
        if (pollRef.current) clearInterval(pollRef.current);
        setRunError(st.error ?? "Falló el scraping.");
        setRunning(false);
      }
    }, 4000);
  }

  function handleTranscribeClick(post: CompetitorPost) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*,audio/*,.mp4,.mov,.m4a,.mp3";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setTranscribingId(post.id);
      try {
        const form = new FormData();
        form.append("post_id", post.id);
        form.append("file", file);
        const res = await fetch("/api/transcribe-reel", { method: "POST", body: form });
        const json = (await res.json()) as { transcription?: string; error?: string };
        if (!res.ok) {
          alert(json.error ?? "Error al transcribir");
          return;
        }
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, transcription: json.transcription ?? null } : p
          )
        );
      } catch (e) {
        alert(e instanceof Error ? e.message : "Error al transcribir");
      } finally {
        setTranscribingId(null);
      }
    };
    input.click();
  }

  async function handleDeletePost(post: CompetitorPost) {
    if (!window.confirm("¿Eliminar este post de competencia? Esta acción no se puede deshacer.")) return;
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    await deleteCompetitorPost(post.id);
  }

  async function handleToggleFavorite(post: CompetitorPost) {
    const newValue = !post.is_favorite;
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, is_favorite: newValue } : p))
    );
    await toggleFavoritePost(post.id, newValue);
  }

  async function handleToggleDislike(post: CompetitorPost) {
    const newValue = !post.is_disliked;
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, is_disliked: newValue } : p))
    );
    await toggleDislikePost(post.id, newValue);
  }

  function handleAddManual() {
    setManualError(null);
    const url = manualUrl.trim();
    const user = manualUser.trim().replace(/^@/, "").toLowerCase();
    if (!user) {
      setManualError("Escribe el @usuario.");
      return;
    }
    startAddManual(async () => {
      const res = await addManualPost({
        clientId,
        permalink: url,
        username: user,
        type: manualType,
        caption: manualCaption,
      });
      if (!res.ok) {
        setManualError(res.error);
        return;
      }
      setPosts((prev) => [res.post, ...prev]);
      setManualUrl("");
      setManualUser("");
      setManualCaption("");
      setManualType("video");
      setShowManualForm(false);
      // El embed necesita que el DOM esté actualizado; useTransition puede diferir
      // el render, así que forzamos un process() con suficiente margen.
      setTimeout(() => window.instgrm?.Embeds.process(), 800);
    });
  }

  const isFresh = hoursSinceScrape != null && hoursSinceScrape < 72;

  const currentClient = clients.find((c) => c.id === clientId);
  const otherClients = clients.filter((c) => c.id !== clientId);

  if (clients.length === 0) {
    return (
      <div>
        <h1 className="text-grad">Competencia</h1>
        <div className="card" style={{ marginTop: 20, padding: 24 }}>
          <p>Primero crea un cliente en la sección <strong>Clientes</strong>.</p>
          <p style={{ fontSize: 14, opacity: 0.75, marginTop: 6 }}>
            Las cuentas de competencia se guardan por cliente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={s.header}>
        <h1 className="text-grad">Competencia</h1>
        <select
          className="input"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
              {c.marca ? ` · ${c.marca}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* ── Gestión de cuentas ── */}
      <div className={`card ${s.panel}`}>
        <div className={s.panelHead}>
          <span className="eyebrow">Cuentas de {currentClient?.nombre ?? "este cliente"}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {competitors.length > 1 && (
              <select
                className="input"
                style={{ fontSize: 12, padding: "4px 8px" }}
                value={competitorSort}
                onChange={(e) => setCompetitorSort(e.target.value as "added" | "name" | "followers")}
              >
                <option value="added">Orden de alta</option>
                <option value="name">Por nombre A–Z</option>
                <option value="followers">Por seguidores</option>
              </select>
            )}
            <span className={s.count}>{competitors.length} cuenta{competitors.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        <div className={s.addRow}>
          <input
            className="input"
            placeholder="@usuario de la competencia"
            value={newUser}
            onChange={(e) => setNewUser(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button className="btn btn-secondary" onClick={handleAdd} disabled={isAdding}>
            {isAdding ? "Agregando…" : "Agregar"}
          </button>
        </div>
        {addError && <p className={s.error}>{addError}</p>}

        {competitors.length > 0 && (
          <div className={s.chips}>
            {sortedCompetitors.map((c) => (
              <span key={c.id} className={s.chip}>
                @{c.username}
                {c.followers != null && (
                  <span className={s.chipMeta}>{fmt(c.followers)}</span>
                )}
                <button
                  className={s.chipX}
                  onClick={() => handleRemove(c.id)}
                  aria-label={`Quitar ${c.username}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Controles de búsqueda ── */}
      <div className={`card ${s.panel}`}>
        {isFresh && hoursSinceScrape != null && (
          <p className={s.freshWarn}>
            ⚠️ La base de datos está algo actualizada (última búsqueda{" "}
            {fmtAgo(hoursSinceScrape)}). Para refrescar las métricas sin gastar de más,
            te recomendamos traer solo los <strong>últimos 5</strong> posts: se
            actualizarán los datos de los posts repetidos y se agregarán los nuevos.
          </p>
        )}
        <div className={s.searchRow}>
          <label className={s.field}>
            <span className="field-label">Posts por cuenta</span>
            <select
              className="input"
              value={nPosts}
              onChange={(e) => setNPosts(Number(e.target.value))}
            >
              {N_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  Últimos {n}
                  {isFresh && n === 5 ? " (recomendado)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            <span className="field-label">Desde (opcional)</span>
            <input
              type="date"
              className="input"
              value={sinceDate}
              onChange={(e) => setSinceDate(e.target.value)}
            />
          </label>
          <button
            className="btn btn-primary"
            onClick={runSearch}
            disabled={running || competitors.length === 0}
          >
            {running ? "Buscando…" : "Ejecutar búsqueda"}
          </button>
        </div>
        <p className={s.hint}>
          Trae los posts de las {competitors.length} cuenta{competitors.length !== 1 ? "s" : ""} vía
          Apify y los guarda. El orden (más vistos, mejor engagement…) se ajusta abajo sin volver a
          buscar.
        </p>
        {runError && <p className={s.error}>{runError}</p>}
      </div>

      {/* ── Resultados ── */}
      {posts.length > 0 && (
        <>
          <div className={s.statsRow}>
            <Stat value={String(totals.accounts)} label="Cuentas" />
            <Stat value={String(totals.posts)} label="Posts" />
            <Stat value={fmt(totals.views)} label="Vistas (Reels)" />
            <Stat value={fmt(totals.likes)} label="Likes" />
            <Stat value={fmt(totals.comments)} label="Comentarios" />
          </div>

          {scrapedAt && (
            <p className={s.scrapedAt}>
              Última búsqueda: {new Date(scrapedAt).toLocaleString("es-MX")}
            </p>
          )}

          <div className={s.filters}>
            <div className={s.filterGroup}>
              <button
                className={`${s.chipBtn} ${onlyFavorites ? s.chipBtnActive : ""}`}
                onClick={() => setOnlyFavorites((v) => !v)}
              >
                {onlyFavorites ? "♥ Favoritos" : "♡ Solo favoritos"}
              </button>
            </div>
            <div className={s.filterGroup}>
              <span className={s.filterLabel}>Ordenar:</span>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <button
                  key={k}
                  className={`${s.chipBtn} ${sortBy === k ? s.chipBtnActive : ""}`}
                  onClick={() => setSortBy(k)}
                >
                  {SORT_LABELS[k]}
                </button>
              ))}
            </div>
            <div className={s.filterGroup}>
              <span className={s.filterLabel}>Tipo:</span>
              {(Object.keys(TYPE_LABELS) as TypeFilter[]).map((k) => (
                <button
                  key={k}
                  className={`${s.chipBtn} ${typeFilter === k ? s.chipBtnActive : ""}`}
                  onClick={() => setTypeFilter(k)}
                >
                  {TYPE_LABELS[k]}
                </button>
              ))}
            </div>
            {competitors.length > 1 && (
              <div className={s.filterGroup}>
                <span className={s.filterLabel}>Cuenta:</span>
                <button
                  className={`${s.chipBtn} ${accountFilter === "all" ? s.chipBtnActive : ""}`}
                  onClick={() => setAccountFilter("all")}
                >
                  Todas
                </button>
                {competitors.map((c) => (
                  <button
                    key={c.id}
                    className={`${s.chipBtn} ${accountFilter === c.username ? s.chipBtnActive : ""}`}
                    onClick={() => setAccountFilter(c.username)}
                  >
                    @{c.username}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Agregar contenido manualmente ── */}
          <div className={`card ${s.panel} ${s.manualPanel}`}>
            <div className={s.panelHead}>
              <span className="eyebrow">Agregar contenido manualmente</span>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: "5px 12px" }}
                onClick={() => { setShowManualForm((v) => !v); setManualError(null); }}
              >
                {showManualForm ? "Cancelar" : "+ Agregar"}
              </button>
            </div>
            {!showManualForm && (
              <p className={s.hint}>
                ¿Encontraste un video que te encanta pero no está en la base? Agrégalo aquí y úsalo con "Adaptar a mi marca".
              </p>
            )}
            {showManualForm && (
              <div className={s.manualForm}>
                <label className={s.field}>
                  <span className="field-label">URL de Instagram *</span>
                  <input
                    className="input"
                    placeholder="https://www.instagram.com/p/..."
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                  />
                </label>
                <label className={s.field}>
                  <span className="field-label">@usuario *</span>
                  <input
                    className="input"
                    placeholder="@usuario"
                    value={manualUser}
                    onChange={(e) => setManualUser(e.target.value)}
                  />
                </label>
                <label className={s.field}>
                  <span className="field-label">Tipo</span>
                  <select
                    className="input"
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value as "video" | "carousel" | "image")}
                  >
                    <option value="video">Reel / Video</option>
                    <option value="carousel">Carrusel</option>
                    <option value="image">Imagen</option>
                  </select>
                </label>
                <label className={s.field}>
                  <span className="field-label">Descripción / notas (opcional)</span>
                  <textarea
                    className="textarea"
                    rows={3}
                    placeholder="¿Por qué te gustó? ¿Qué quieres adaptar?"
                    value={manualCaption}
                    onChange={(e) => setManualCaption(e.target.value)}
                  />
                </label>
                {manualError && <p className={s.error}>{manualError}</p>}
                <button
                  className="btn btn-primary"
                  onClick={handleAddManual}
                  disabled={isAddingManual}
                >
                  {isAddingManual ? "Guardando…" : "Guardar post"}
                </button>
              </div>
            )}
          </div>

          <div className={s.grid}>
            {sorted.slice(0, visibleCount).map((p, i) => {
              const avg = avgByUser.get(p.username) ?? 0;
              const mult = avg > 0 ? eng(p) / avg : 0;
              const isOutlier = mult >= 1.5;
              return (
                <div key={p.id} className={s.postCard}>
                  <div className={s.postTop}>
                    <span className={s.rank}>#{i + 1}</span>
                    <a
                      className={s.user}
                      href={`https://www.instagram.com/${p.username}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      @{p.username}
                    </a>
                    {p.is_manual && (
                      <span className={s.manualBadge}>Manual</span>
                    )}
                    {isOutlier && (
                      <span className={s.outlier} title="Engagement vs su promedio">
                        🔥 {mult.toFixed(1)}×
                      </span>
                    )}
                    <span className={s.postActions}>
                      <button
                        className={s.iconBtn}
                        title={p.is_favorite ? "Quitar de favoritos" : "Marcar como favorito"}
                        onClick={() => handleToggleFavorite(p)}
                      >
                        {p.is_favorite ? "♥" : "♡"}
                      </button>
                      <button
                        className={`${s.iconBtn} ${p.is_disliked ? s.iconBtnDisliked : ""}`}
                        title={p.is_disliked ? "Quitar dislike" : "Ya lo vi, no me gustó"}
                        onClick={() => handleToggleDislike(p)}
                      >
                        👎
                      </button>
                      <button
                        className={`${s.iconBtn} ${s.iconBtnDelete}`}
                        title="Eliminar este post"
                        onClick={() => handleDeletePost(p)}
                      >
                        🗑
                      </button>
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

                  <div className={s.postMetrics}>
                    {p.video_views != null && <span>▶️ {fmt(p.video_views)}</span>}
                    <span>❤️ {fmt(p.likes)}</span>
                    <span>💬 {fmt(p.comments)}</span>
                    {p.posted_at && (
                      <span className={s.date}>
                        {new Date(p.posted_at).toLocaleDateString("es-MX")}
                      </span>
                    )}
                  </div>

                  {transcribeEnabled && p.type !== "image" && (
                    <div className={s.transcribeRow}>
                      {p.transcription ? (
                        <span className={s.transcribedBadge}>
                          <span className={s.transcribedDot} />
                          Transcripción lista
                        </span>
                      ) : (
                        <span className={s.transcribedBadge} style={{ opacity: 0.5 }}>
                          Sin transcripción
                        </span>
                      )}
                      <button
                        className={s.transcribeBtn}
                        disabled={transcribingId === p.id}
                        onClick={() => handleTranscribeClick(p)}
                      >
                        {transcribingId === p.id ? "Transcribiendo…" : p.transcription ? "Re-transcribir" : "🎤 Transcribir"}
                      </button>
                    </div>
                  )}

                  {p.transcription && (
                    <button
                      className={s.ganchoBtn}
                      onClick={() => setGanchoPost(p)}
                    >
                      ⚡ Extraer gancho
                    </button>
                  )}

                  <button
                    className={s.adaptBtn}
                    onClick={() => {
                      setAdaptTargetClientId(null);
                      setOtherBrandPickerPostId(null);
                      setAdaptingPost(p);
                    }}
                  >
                    ✦ Adaptar a mi marca
                  </button>

                  {otherClients.length > 0 && (
                    otherBrandPickerPostId === p.id ? (
                      <div className={s.otherBrandPicker}>
                        <span className={s.otherBrandPickerLabel}>¿Para qué marca?</span>
                        <div className={s.otherBrandOptions}>
                          {otherClients.map((c) => (
                            <button
                              key={c.id}
                              className={s.otherBrandOption}
                              onClick={() => {
                                setAdaptTargetClientId(c.id);
                                setOtherBrandPickerPostId(null);
                                setAdaptingPost(p);
                              }}
                            >
                              {c.nombre}
                              {c.marca ? <span className={s.otherBrandMarca}>{c.marca}</span> : null}
                            </button>
                          ))}
                          <button
                            className={s.otherBrandCancel}
                            onClick={() => setOtherBrandPickerPostId(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className={s.otherBrandBtn}
                        onClick={() => setOtherBrandPickerPostId(p.id)}
                      >
                        ↗ Adaptar para otra marca
                      </button>
                    )
                  )}

                  {p.permalink && (
                    <button
                      className={s.downloadBtn}
                      onClick={async () => {
                        await navigator.clipboard.writeText(p.permalink!);
                        window.open("https://snapinsta.to/es", "_blank", "noopener,noreferrer");
                      }}
                    >
                      ↓ Descargar
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {visibleCount < sorted.length && (
            <div className={s.loadMore}>
              <button
                className="btn btn-secondary"
                onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              >
                Cargar {Math.min(PAGE_SIZE, sorted.length - visibleCount)} más
                <span className={s.loadMoreCount}>
                  ({visibleCount} de {sorted.length})
                </span>
              </button>
            </div>
          )}
        </>
      )}

      {adaptingPost && (
        <AdaptarModal
          post={adaptingPost}
          clientId={adaptTargetClientId ?? clientId}
          clientName={
            adaptTargetClientId
              ? clients.find((c) => c.id === adaptTargetClientId)?.nombre
              : undefined
          }
          onClose={() => {
            setAdaptingPost(null);
            setAdaptTargetClientId(null);
          }}
        />
      )}

      {ganchoPost && (
        <GanchoModal
          post={ganchoPost}
          onClose={() => setGanchoPost(null)}
        />
      )}

      {posts.length === 0 && competitors.length > 0 && !running && (
        <p className={s.empty}>
          Agregadas las cuentas, presiona <strong>Ejecutar búsqueda</strong> para traer su contenido.
        </p>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={s.statCard}>
      <span className={s.statValue}>{value}</span>
      <span className={s.statLabel}>{label}</span>
    </div>
  );
}
