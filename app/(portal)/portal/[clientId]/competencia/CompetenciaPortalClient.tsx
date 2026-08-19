"use client";

/**
 * Tablero de competencia del cliente (Fase D, etapas 5 y 7).
 *
 * No reusa `app/(app)/competencia/CompetenciaClient.tsx` a propósito: ese está
 * hecho alrededor de las acciones internas de Paco (scrapear, clasificar,
 * marcar favoritos/dislikes, borrar, seleccionar para reporte) y arrastraría
 * todas esas server actions al bundle del cliente. Lo que SÍ se comparte con
 * el estudio es la técnica del embed de Instagram (mismo script, mismo
 * blockquote) — es la única forma de mostrar la portada real del video: no
 * hay columna de thumbnail en la base, Apify no la trae.
 *
 * Transcribir y adaptar gastan crédito (`app/(portal)/portal/[clientId]/
 * competencia/actions.ts`); el resto de los filtros son en memoria y gratis.
 */

import { useEffect, useMemo, useState } from "react";
import type { OutlierFlags } from "@/lib/competencia/outliers";
import { labelFor, colorFor } from "@/lib/competencia/taxonomy";
import { normalizePublicId } from "@/lib/competencia/publicId";
import { transcribePortalPost, toggleClientFavorite } from "./actions";
import AdaptModal from "./AdaptModal";
import s from "./competencia.module.css";

export type PortalPostBase = {
  id: string;
  public_id: string;
  username: string;
  permalink: string | null;
  type: string | null;
  caption: string | null;
  likes: number;
  comments: number;
  video_views: number | null;
  posted_at: string | null;
  transcription: string | null;
  is_favorite: boolean;
  is_manual: boolean;
  hook_type: string | null;
  script_structure: string | null;
  value_pillar: string | null;
};

export type PortalPost = PortalPostBase & OutlierFlags;

type Orden = "recientes" | "comentarios" | "vistas";

const nf = new Intl.NumberFormat("es-MX");

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

function formatNumber(n: number | null): string {
  if (n == null) return "—";
  return nf.format(n);
}

function formatDate(iso: string | null): string {
  if (!iso) return "Sin fecha";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CompetenciaPortalClient({
  posts: initialPosts,
  clientId,
  clientLabel,
  canAdapt,
  canFavorite,
  transcriptionRemaining: initialTranscriptionRemaining,
  adaptRemaining: initialAdaptRemaining,
}: {
  posts: PortalPost[];
  clientId: string;
  clientLabel: string;
  canAdapt: boolean;
  /** `collaborator` (o el dueño en preview). Un `viewer` no ve la estrella. */
  canFavorite: boolean;
  transcriptionRemaining: number | null;
  adaptRemaining: number | null;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [query, setQuery] = useState("");
  const [cuenta, setCuenta] = useState("");
  // Destacados y guardados son dos cosas distintas (etapa 8): el primero es
  // automático (el post rindió muy por encima de su propia cuenta), el segundo
  // es curaduría a mano. Antes iban en un solo checkbox y un post que entraba
  // solo por favorito no llevaba ninguna marca en la tarjeta. Desde la etapa 9
  // la estrella la puede poner también el cliente: es la misma columna.
  const [soloDestacados, setSoloDestacados] = useState(false);
  const [soloSeleccion, setSoloSeleccion] = useState(false);
  const [soloTranscritos, setSoloTranscritos] = useState(false);
  const [orden, setOrden] = useState<Orden>("recientes");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [adaptingPost, setAdaptingPost] = useState<PortalPost | null>(null);
  const [transcriptionRemaining, setTranscriptionRemaining] = useState(
    initialTranscriptionRemaining,
  );
  const [adaptRemaining, setAdaptRemaining] = useState(initialAdaptRemaining);
  const [errorFor, setErrorFor] = useState<{ id: string; message: string } | null>(null);

  const transcriptionBlocked = transcriptionRemaining !== null && transcriptionRemaining <= 0;
  const adaptBlocked = adaptRemaining !== null && adaptRemaining <= 0;

  // ── Script de embeds de Instagram: una vez por página ──
  useEffect(() => {
    if (document.getElementById("ig-embed-script")) return;
    const sc = document.createElement("script");
    sc.id = "ig-embed-script";
    sc.async = true;
    sc.src = "https://www.instagram.com/embed.js";
    document.body.appendChild(sc);
  }, []);

  const cuentas = useMemo(
    () => [...new Set(posts.map((p) => p.username))].sort((a, b) => a.localeCompare(b)),
    [posts],
  );

  const visibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    // El ID público se busca normalizado (mayúsculas, sin ambiguos) para que
    // "q7f2m9" y "Q7F2M9" encuentren lo mismo: el cliente lo dicta como lo lee.
    const idQuery = normalizePublicId(query);

    const filtrados = posts.filter((p) => {
      if (cuenta && p.username !== cuenta) return false;
      // Los dos marcadores se suman (unión) cuando están los dos prendidos: la
      // intersección "outlier Y favorito" devolvería casi nada. La
      // transcripción sí va en AND — es otra dimensión, no otro marcador.
      if (soloDestacados || soloSeleccion) {
        const marcado =
          (soloDestacados && p.is_outlier) || (soloSeleccion && p.is_favorite);
        if (!marcado) return false;
      }
      if (soloTranscritos && !p.transcription) return false;
      if (!q) return true;
      return (
        p.public_id === idQuery ||
        p.username.toLowerCase().includes(q.replace(/^@/, "")) ||
        (p.caption ?? "").toLowerCase().includes(q)
      );
    });

    const ordenados = [...filtrados];
    if (orden === "comentarios") ordenados.sort((a, b) => b.comments - a.comments);
    else if (orden === "vistas")
      ordenados.sort((a, b) => (b.video_views ?? 0) - (a.video_views ?? 0));
    return ordenados;
  }, [posts, query, cuenta, soloDestacados, soloSeleccion, soloTranscritos, orden]);

  // ── Procesar embeds cada vez que cambia lo visible ──
  useEffect(() => {
    const t = setTimeout(() => window.instgrm?.Embeds.process(), 300);
    return () => clearTimeout(t);
  }, [visibles]);

  async function handleTranscribe(post: PortalPost) {
    setTranscribingId(post.id);
    setErrorFor(null);
    try {
      const res = await transcribePortalPost(clientId, post.id);
      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, transcription: res.transcription } : p)),
        );
        setTranscriptionRemaining((r) => (r === null ? null : Math.max(0, r - 1)));
        setAbierto(post.id);
      } else {
        setErrorFor({ id: post.id, message: res.error });
      }
    } catch (e) {
      setErrorFor({
        id: post.id,
        message: e instanceof Error ? e.message : "No se pudo transcribir.",
      });
    } finally {
      setTranscribingId(null);
    }
  }

  /**
   * La estrella se pinta antes de que responda el servidor y se revierte si
   * falla (regla dura de `CLAUDE.md`: nunca una action de mutación sin
   * `try/catch` del lado del cliente).
   */
  async function handleFavorite(post: PortalPost) {
    const nuevo = !post.is_favorite;
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, is_favorite: nuevo } : p)),
    );
    setErrorFor(null);
    try {
      const res = await toggleClientFavorite(clientId, post.id, nuevo);
      if (!res.ok) {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, is_favorite: !nuevo } : p)),
        );
        setErrorFor({ id: post.id, message: res.error });
      }
    } catch (e) {
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, is_favorite: !nuevo } : p)),
      );
      setErrorFor({
        id: post.id,
        message: e instanceof Error ? e.message : "No se pudo guardar la estrella.",
      });
    }
  }

  return (
    <div>
      <div className={s.header}>
        <span className="eyebrow">{clientLabel}</span>
        <h2 className={s.title}>Competencia</h2>
        <p className={s.subtitle}>
          Lo que están publicando las cuentas que seguimos en tu categoría.{" "}
          <strong>🔥 Destacado</strong> es el que rindió muy por encima de lo
          normal para su propia cuenta; <strong>⭐ Guardado</strong> es el que
          alguno de los dos marcó porque da para algo tuyo
          {canFavorite ? " — la estrella de cada tarjeta es tuya para usar" : ""}.
          Cada pieza tiene un código de 6 caracteres: si quieres pedir algo sobre
          una en particular, mándanos ese código.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className={s.empty}>
          <p className={s.emptyTitle}>Todavía no hay nada acá</p>
          <p className={s.emptyText}>
            En cuanto analicemos las cuentas de tu competencia, sus publicaciones
            aparecen en esta pantalla.
          </p>
        </div>
      ) : (
        <>
          <div className={s.filters}>
            <input
              className="input"
              type="search"
              placeholder="Buscar por código, cuenta o texto…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar publicaciones"
            />
            <select
              className="input"
              value={cuenta}
              onChange={(e) => setCuenta(e.target.value)}
              aria-label="Filtrar por cuenta"
            >
              <option value="">Todas las cuentas</option>
              {cuentas.map((c) => (
                <option key={c} value={c}>
                  @{c}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              aria-label="Ordenar"
            >
              <option value="recientes">Más recientes</option>
              <option value="comentarios">Más comentados</option>
              <option value="vistas">Más vistos</option>
            </select>
            <label className={s.check}>
              <input
                type="checkbox"
                checked={soloDestacados}
                onChange={(e) => setSoloDestacados(e.target.checked)}
              />
              <span>🔥 Destacados</span>
            </label>
            <label className={s.check}>
              <input
                type="checkbox"
                checked={soloSeleccion}
                onChange={(e) => setSoloSeleccion(e.target.checked)}
              />
              <span>⭐ Guardados</span>
            </label>
            <label className={s.check}>
              <input
                type="checkbox"
                checked={soloTranscritos}
                onChange={(e) => setSoloTranscritos(e.target.checked)}
              />
              <span>🎤 Con transcripción</span>
            </label>
          </div>

          <p className={s.count}>
            {visibles.length === posts.length
              ? `${posts.length} publicaciones`
              : `${visibles.length} de ${posts.length} publicaciones`}
          </p>

          <div className={s.grid}>
            {visibles.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                expandido={abierto === p.id}
                onToggle={() => setAbierto(abierto === p.id ? null : p.id)}
                onTranscribe={() => handleTranscribe(p)}
                transcribing={transcribingId === p.id}
                transcriptionBlocked={transcriptionBlocked}
                transcriptionRemaining={transcriptionRemaining}
                canAdapt={canAdapt && p.type !== "image"}
                adaptBlocked={adaptBlocked}
                adaptRemaining={adaptRemaining}
                onAdapt={() => setAdaptingPost(p)}
                canFavorite={canFavorite}
                onFavorite={() => handleFavorite(p)}
                error={errorFor?.id === p.id ? errorFor.message : null}
              />
            ))}
          </div>

          {visibles.length === 0 && (
            <p className={s.noMatch}>
              Ninguna publicación coincide con lo que buscas. Prueba con otro
              código o limpia los filtros.
            </p>
          )}
        </>
      )}

      {adaptingPost && (
        <AdaptModal
          clientId={clientId}
          post={adaptingPost}
          onClose={() => setAdaptingPost(null)}
          onAdapted={() => setAdaptRemaining((r) => (r === null ? null : Math.max(0, r - 1)))}
        />
      )}
    </div>
  );
}

function PostCard({
  post,
  expandido,
  onToggle,
  onTranscribe,
  transcribing,
  transcriptionBlocked,
  transcriptionRemaining,
  canAdapt,
  adaptBlocked,
  adaptRemaining,
  onAdapt,
  canFavorite,
  onFavorite,
  error,
}: {
  post: PortalPost;
  expandido: boolean;
  onToggle: () => void;
  onTranscribe: () => void;
  transcribing: boolean;
  transcriptionBlocked: boolean;
  transcriptionRemaining: number | null;
  canAdapt: boolean;
  adaptBlocked: boolean;
  adaptRemaining: number | null;
  onAdapt: () => void;
  canFavorite: boolean;
  onFavorite: () => void;
  error: string | null;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiarId() {
    try {
      await navigator.clipboard.writeText(post.public_id);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1400);
    } catch {
      // Sin permiso de portapapeles (o http): el código igual se ve en pantalla.
    }
  }

  const chips = [
    { dim: "hook_type" as const, slug: post.hook_type },
    { dim: "script_structure" as const, slug: post.script_structure },
    { dim: "value_pillar" as const, slug: post.value_pillar },
  ].filter((c) => c.slug);

  return (
    <article
      className={`${s.card} ${post.is_outlier ? s.cardOutlier : ""} ${
        !post.is_outlier && post.is_favorite ? s.cardPicked : ""
      }`}
    >
      <div className={s.cardTop}>
        <span className={s.account}>@{post.username}</span>
        <div className={s.cardTopRight}>
          {/*
            Un post puede ser las dos cosas; en ese caso manda el dato duro
            (outlier), que es el que explica los números de abajo. El guardado
            sin números excepcionales entra por curaduría y hasta la etapa 8 no
            llevaba ninguna marca, aunque el filtro sí lo devolvía.
          */}
          {post.is_outlier ? (
            <span className={s.outlier} title="Rindió muy por encima de lo normal para esa cuenta">
              🔥 Destacado
            </span>
          ) : post.is_favorite && !canFavorite ? (
            // Sin estrella clicable (viewer) el badge es la única señal.
            <span className={s.picked} title="Está guardado para esta marca">
              ⭐ Guardado
            </span>
          ) : null}

          {canFavorite && (
            <button
              type="button"
              className={`${s.starBtn} ${post.is_favorite ? s.starOn : ""}`}
              onClick={onFavorite}
              aria-pressed={post.is_favorite}
              title={
                post.is_favorite
                  ? "Quitar de guardados"
                  : "Guardar esta publicación para tu marca"
              }
            >
              {post.is_favorite ? "★" : "☆"}
            </button>
          )}
        </div>
      </div>

      {post.permalink ? (
        <blockquote
          className="instagram-media"
          data-instgrm-permalink={post.permalink}
          data-instgrm-version="14"
          style={{ margin: 0, width: "100%", minWidth: 0 }}
        />
      ) : (
        <div className={s.noEmbed}>Sin enlace embebible</div>
      )}

      <p className={s.date}>{formatDate(post.posted_at)}</p>

      {post.caption && (
        <p className={s.caption}>
          {post.caption.length > 180 && !expandido
            ? post.caption.slice(0, 180).trimEnd() + "…"
            : post.caption}
        </p>
      )}

      {chips.length > 0 && (
        <div className={s.chips}>
          {chips.map((c) => (
            <span
              key={c.dim}
              className={s.chip}
              style={{ borderColor: colorFor(c.dim, c.slug), color: colorFor(c.dim, c.slug) }}
            >
              {labelFor(c.dim, c.slug)}
            </span>
          ))}
        </div>
      )}

      <div className={s.metrics}>
        <span title="Vistas">▶ {formatNumber(post.video_views)}</span>
        <span title="Me gusta">♥ {formatNumber(post.likes)}</span>
        <span title="Comentarios">💬 {formatNumber(post.comments)}</span>
        {/*
          Antes la transcripción solo se notaba al expandir la tarjeta, así que
          no había forma de barrer la grilla y ver qué estaba transcrito.
        */}
        {post.transcription && (
          <span className={s.transcriptFlag} title="Este video ya está transcrito">
            🎤 Transcrito
          </span>
        )}
        <button
          type="button"
          className={s.idBadge}
          onClick={copiarId}
          title="Copiar el código de esta publicación"
        >
          {copiado ? "¡Copiado!" : post.public_id}
        </button>
      </div>

      {expandido && post.transcription && (
        <div className={s.transcript}>
          <p className={s.transcriptTitle}>Lo que dice el video</p>
          <p className={s.transcriptBody}>{post.transcription}</p>
        </div>
      )}

      {post.type !== "image" && (
        <div className={s.creditRow}>
          <button
            type="button"
            className={s.creditBtn}
            onClick={onTranscribe}
            disabled={transcribing || (transcriptionBlocked && !post.transcription)}
            title={
              transcriptionBlocked && !post.transcription
                ? "Llegaste al tope de transcripciones de este mes"
                : undefined
            }
          >
            {transcribing
              ? "Transcribiendo…"
              : post.transcription
                ? "🎤 Re-transcribir"
                : "🎤 Transcribir"}
          </button>
          {transcriptionRemaining !== null && (
            <span className={s.creditHint}>{transcriptionRemaining} este mes</span>
          )}
        </div>
      )}

      {canAdapt && (
        <div className={s.creditRow}>
          <button
            type="button"
            className={`${s.creditBtn} ${s.creditBtnPrimary}`}
            onClick={onAdapt}
            disabled={adaptBlocked}
            title={adaptBlocked ? "Llegaste al tope de generaciones de este mes" : undefined}
          >
            ✦ Adaptar a mi marca
          </button>
          {adaptRemaining !== null && (
            <span className={s.creditHint}>{adaptRemaining} este mes</span>
          )}
        </div>
      )}

      {error && <p className={s.creditError}>{error}</p>}

      <div className={s.cardActions}>
        {(post.transcription || (post.caption?.length ?? 0) > 180) && (
          <button type="button" className={s.linkBtn} onClick={onToggle}>
            {expandido ? "Ver menos" : "Ver más"}
          </button>
        )}
        {post.permalink && (
          <a
            className={s.linkBtn}
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver en Instagram ↗
          </a>
        )}
      </div>
    </article>
  );
}
