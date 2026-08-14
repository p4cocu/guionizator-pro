"use client";

/**
 * Tablero de competencia del cliente. Solo lectura: filtra y muestra, no muta.
 *
 * No reusa `app/(app)/competencia/CompetenciaClient.tsx` a propósito: ese está
 * hecho alrededor de las acciones de Paco (scrapear, transcribir, clasificar,
 * adaptar, seleccionar para reporte) y arrastraría todas esas server actions al
 * bundle del cliente, además de mostrar botones que la RLS le va a rechazar.
 *
 * Los filtros corren en memoria sobre lo que ya trajo el server: un cliente
 * tiene decenas o pocos cientos de posts (la limpieza borra a los 40 días), así
 * que no hay motivo para ir y volver al servidor por cada tecla.
 */

import { useMemo, useState } from "react";
import type { OutlierFlags } from "@/lib/competencia/outliers";
import { labelFor, colorFor } from "@/lib/competencia/taxonomy";
import { normalizePublicId } from "@/lib/competencia/publicId";
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
  posts,
  clientLabel,
}: {
  posts: PortalPost[];
  clientLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [cuenta, setCuenta] = useState("");
  const [soloDestacados, setSoloDestacados] = useState(false);
  const [orden, setOrden] = useState<Orden>("recientes");
  const [abierto, setAbierto] = useState<string | null>(null);

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
      if (soloDestacados && !p.is_outlier && !p.is_favorite) return false;
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
  }, [posts, query, cuenta, soloDestacados, orden]);

  return (
    <div>
      <div className={s.header}>
        <span className="eyebrow">{clientLabel}</span>
        <h2 className={s.title}>Competencia</h2>
        <p className={s.subtitle}>
          Lo que están publicando las cuentas que seguimos en tu categoría. Los
          marcados como <strong>destacados</strong> son los que rindieron muy por
          encima de lo normal para esa cuenta. Cada pieza tiene un código de 6
          caracteres: si quieres pedir algo sobre una en particular, mándanos ese
          código.
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
              <span>Solo destacados</span>
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
    </div>
  );
}

function PostCard({
  post,
  expandido,
  onToggle,
}: {
  post: PortalPost;
  expandido: boolean;
  onToggle: () => void;
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
    <article className={`${s.card} ${post.is_outlier ? s.cardOutlier : ""}`}>
      <div className={s.cardTop}>
        <span className={s.account}>@{post.username}</span>
        {post.is_outlier && <span className={s.outlier}>Destacado</span>}
      </div>

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
