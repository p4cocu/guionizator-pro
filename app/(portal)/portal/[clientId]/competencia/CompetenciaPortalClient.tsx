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
 * competencia/actions.ts`); el resto —filtros, guardar un link, notas y
 * borrar— es en memoria o consultas chicas, y gratis.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { OutlierFlags } from "@/lib/competencia/outliers";
import { labelFor, colorFor } from "@/lib/competencia/taxonomy";
import { normalizePublicId } from "@/lib/competencia/publicId";
import { accountLabel, type SavedLinkType } from "@/lib/competencia/savedLink";
import {
  MAX_POST_COMMENT_LENGTH,
  type PostComment,
  type PostCommentsByPost,
} from "@/lib/competencia/postCommentShape";
import {
  transcribePortalPost,
  toggleClientFavorite,
  savePortalLink,
  addPortalPostComment,
  deletePortalPost,
  enrichPortalPost,
} from "./actions";
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

type Orden = "recientes" | "comentarios" | "vistas" | "likes";

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
  canSaveLink,
  canDelete,
  commentsByPost,
  transcriptionRemaining: initialTranscriptionRemaining,
  adaptRemaining: initialAdaptRemaining,
  adaptCreditBalance,
}: {
  posts: PortalPost[];
  clientId: string;
  clientLabel: string;
  canAdapt: boolean;
  /** `collaborator` (o el dueño en preview). Un `viewer` no ve la estrella. */
  canFavorite: boolean;
  /** Mismo candado que la estrella: escribe sobre el tablero compartido. */
  canSaveLink: boolean;
  /** Mismo candado. Borrar es definitivo y también le saca el post a Paco. */
  canDelete: boolean;
  /**
   * Las notas de todos los posts, agrupadas por post. Vienen del servidor en
   * una sola consulta; comentar SÍ lo puede hacer un `viewer`, así que no hay
   * prop de permiso para esto.
   */
  commentsByPost: PostCommentsByPost;
  transcriptionRemaining: number | null;
  adaptRemaining: number | null;
  /** Saldo de recargas compradas (Fase E). No vence. */
  adaptCreditBalance: number;
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
  const [comentarios, setComentarios] = useState<PostCommentsByPost>(commentsByPost);
  // El post que el bote de basura puso en la mira. Mientras no sea `null` se
  // dibuja el diálogo de confirmación: borrar no tiene vuelta atrás.
  const [porBorrar, setPorBorrar] = useState<PortalPost | null>(null);
  const [borrando, setBorrando] = useState(false);
  // Los links recién guardados a los que se les están pidiendo las métricas a
  // Apify. Es solo para dibujar "trayendo datos…" en esa tarjeta.
  const [enriqueciendo, setEnriqueciendo] = useState<Set<string>>(new Set());

  const transcriptionBlocked = transcriptionRemaining !== null && transcriptionRemaining <= 0;
  // Agotar el cupo del ciclo NO bloquea si quedan créditos comprados: esos no
  // vencen y son justamente para esto.
  const adaptBlocked =
    adaptRemaining !== null && adaptRemaining <= 0 && adaptCreditBalance <= 0;

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
    else if (orden === "likes") ordenados.sort((a, b) => b.likes - a.likes);
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

  /**
   * Guarda un link suelto. El post vuelve del servidor con las mismas columnas
   * que trae el server render, así que se puede meter tal cual en la lista.
   *
   * Si el link ya estaba en el tablero, el servidor no duplica: devuelve la
   * fila existente con la estrella puesta y `alreadyExisted`. Acá se reemplaza
   * en su lugar en vez de agregarla arriba, o el cliente vería el mismo video
   * dos veces.
   */
  async function handleSaveLink(input: {
    url: string;
    account: string;
    type: SavedLinkType;
    note: string;
  }): Promise<string | null> {
    try {
      const res = await savePortalLink(clientId, input);
      if (!res.ok) return res.error;
      const { alreadyExisted } = res;

      // Un guardado a mano nunca es outlier: no tiene métricas con las que
      // compararse contra la mediana de su cuenta.
      const nuevo = {
        ...(res.post as unknown as PortalPostBase),
        is_outlier: false,
        outlier_multiple: null,
        account_median_comments: null,
      } as PortalPost;

      setPosts((prev) => {
        const idx = prev.findIndex((p) => p.id === nuevo.id);
        if (idx === -1) return [nuevo, ...prev];
        const copia = [...prev];
        // Se conservan los flags de outlier que ya tenía: la fila existente sí
        // pudo haberlos ganado con métricas reales.
        copia[idx] = { ...prev[idx], ...(res.post as unknown as PortalPostBase) };
        return copia;
      });
      // La nota inicial se pinta acá y no en el hilo: `revalidatePath` no toca
      // este `useState`, así que sin esto quedaba guardada pero invisible.
      if (res.comment) {
        const nota = res.comment;
        setComentarios((prev) => ({
          ...prev,
          [nota.postId]: [...(prev[nota.postId] ?? []), nota],
        }));
      }
      setPorBorrar(null);
      // El embed necesita el DOM ya actualizado; React puede diferir el render.
      setTimeout(() => window.instgrm?.Embeds.process(), 800);
      // Las métricas van en un segundo viaje, ya con la tarjeta en pantalla:
      // la corrida de Apify tarda entre 5 y 20 segundos y no vale la pena
      // hacer esperar a nadie para ver un número. Si falla, la tarjeta se
      // queda con ceros y no se muestra ningún error: el link ya se guardó.
      if (!alreadyExisted) void enriquecer(nuevo.id);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "No se pudo guardar el link.";
    }
  }

  /**
   * Pide las métricas reales a Apify y las mete en la tarjeta. No devuelve
   * error a la UI a propósito: que la marca no tenga token de Apify, o que el
   * post sea privado, es un caso normal y el link ya quedó guardado.
   */
  async function enriquecer(postId: string) {
    setEnriqueciendo((prev) => new Set(prev).add(postId));
    try {
      const res = await enrichPortalPost(clientId, postId);
      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? ({ ...p, ...(res.fields as Partial<PortalPost>) } as PortalPost) : p,
          ),
        );
      }
    } catch {
      // Silencio deliberado: ver el comentario de arriba.
    } finally {
      setEnriqueciendo((prev) => {
        const copia = new Set(prev);
        copia.delete(postId);
        return copia;
      });
    }
  }

  /** Devuelve el mensaje de error, o `null` si salió bien. */
  async function handleComment(postId: string, body: string): Promise<string | null> {
    try {
      const res = await addPortalPostComment(clientId, postId, body);
      if (!res.ok) return res.error;
      setComentarios((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), res.comment] }));
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "No se pudo guardar la nota.";
    }
  }

  /**
   * Borra de verdad y para los dos lados. No hay UI optimista a propósito: si
   * el servidor rechaza, hacer reaparecer una tarjeta que ya se había ido se
   * lee como un fantasma. Se espera la respuesta y recién ahí se saca.
   */
  async function handleDelete(post: PortalPost) {
    setBorrando(true);
    setErrorFor(null);
    try {
      const res = await deletePortalPost(clientId, post.id);
      if (!res.ok) {
        setErrorFor({ id: post.id, message: res.error });
      } else {
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        setComentarios((prev) => {
          const copia = { ...prev };
          delete copia[post.id];
          return copia;
        });
      }
    } catch (e) {
      setErrorFor({
        id: post.id,
        message: e instanceof Error ? e.message : "No se pudo borrar la publicación.",
      });
    } finally {
      setBorrando(false);
      setPorBorrar(null);
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
          una en particular, mándanos ese código. En cualquier publicación puedes
          dejar una nota con lo que te llamó la atención — la leemos nosotros.
        </p>
      </div>

      {canSaveLink && <GuardarLinkPanel onSave={handleSaveLink} />}

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
                  {accountLabel(c)}
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
              <option value="likes">Más likes</option>
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
                adaptCreditBalance={adaptCreditBalance}
                onAdapt={() => setAdaptingPost(p)}
                canFavorite={canFavorite}
                onFavorite={() => handleFavorite(p)}
                canDelete={canDelete}
                onDelete={() => setPorBorrar(p)}
                enriqueciendo={enriqueciendo.has(p.id)}
                comments={comentarios[p.id] ?? []}
                onComment={(body) => handleComment(p.id, body)}
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

      {porBorrar && (
        <ConfirmarBorrado
          post={porBorrar}
          borrando={borrando}
          onCancel={() => setPorBorrar(null)}
          onConfirm={() => handleDelete(porBorrar)}
        />
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

/**
 * Panel para pegar un link y que quede en el tablero.
 *
 * Se dibuja también cuando el tablero está vacío: si estuviera adentro del
 * `else` del empty-state, una marca sin scrapes todavía no tendría por dónde
 * empezar a guardar nada.
 *
 * La cuenta es opcional a propósito — Instagram no la revela en la URL de un
 * reel y averiguarla cuesta un scrape (ver `lib/competencia/savedLink.ts`).
 * Cuando el link sí la trae, el servidor la saca solo y este campo sobra.
 */
function GuardarLinkPanel({
  onSave,
}: {
  onSave: (input: {
    url: string;
    account: string;
    type: SavedLinkType;
    note: string;
  }) => Promise<string | null>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [url, setUrl] = useState("");
  const [account, setAccount] = useState("");
  const [type, setType] = useState<SavedLinkType>("video");
  const [note, setNote] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  async function submit() {
    if (!url.trim()) {
      setError("Pega el link del contenido.");
      return;
    }
    setGuardando(true);
    setError(null);
    const err = await onSave({ url, account, type, note });
    setGuardando(false);
    if (err) {
      setError(err);
      return;
    }
    setUrl("");
    setAccount("");
    setNote("");
    setType("video");
    setAbierto(false);
    setListo(true);
    setTimeout(() => setListo(false), 3000);
  }

  return (
    <div className={s.savePanel}>
      <div className={s.savePanelHead}>
        <div>
          <p className={s.savePanelTitle}>Guardar un link</p>
          <p className={s.savePanelHint}>
            ¿Viste algo que te gustaría para tu marca? Pega el link acá y queda
            guardado con la estrella, junto al resto. Los números de la
            publicación entran solos unos segundos después.
          </p>
        </div>
        <button
          type="button"
          className={s.savePanelToggle}
          onClick={() => {
            setAbierto((v) => !v);
            setError(null);
          }}
        >
          {abierto ? "Cancelar" : "+ Guardar link"}
        </button>
      </div>

      {listo && <p className={s.saveOk}>Guardado. Ya aparece en tu tablero.</p>}

      {abierto && (
        <div className={s.saveForm}>
          <label className={s.saveField}>
            <span className={s.saveLabel}>Link del contenido</span>
            <input
              className="input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/..."
              autoFocus
            />
          </label>

          <label className={s.saveField}>
            <span className={s.saveLabel}>
              Cuenta <span className={s.saveOptional}>(opcional)</span>
            </span>
            <input
              className="input"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="@cuenta"
            />
          </label>

          <label className={s.saveField}>
            <span className={s.saveLabel}>Tipo</span>
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as SavedLinkType)}
            >
              <option value="video">Reel / video</option>
              <option value="carousel">Carrusel</option>
              <option value="image">Imagen</option>
            </select>
          </label>

          <label className={`${s.saveField} ${s.saveFieldWide}`}>
            <span className={s.saveLabel}>
              Nota <span className={s.saveOptional}>(opcional)</span>
            </span>
            <textarea
              className="textarea"
              rows={2}
              value={note}
              maxLength={MAX_POST_COMMENT_LENGTH}
              onChange={(e) => setNote(e.target.value)}
              placeholder="¿Qué te gustó de este contenido?"
            />
          </label>

          {error && <p className={s.saveError}>{error}</p>}

          <div className={s.saveActions}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={submit}
              disabled={guardando}
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hilo de notas de una tarjeta. Colapsado por defecto: la mayoría de los posts
 * no tiene ninguna y una caja de texto por tarjeta llenaría la grilla de ruido.
 *
 * Comentar lo puede hacer cualquier miembro, incluido el `viewer` — es la misma
 * regla que en los comentarios de un guion.
 */
function NotasPost({
  comments,
  onComment,
}: {
  comments: PostComment[];
  onComment: (body: string) => Promise<string | null>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [body, setBody] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!body.trim()) return;
    setGuardando(true);
    setError(null);
    const err = await onComment(body);
    setGuardando(false);
    if (err) {
      setError(err);
      return;
    }
    setBody("");
  }

  return (
    <div className={s.notes}>
      <button
        type="button"
        className={s.notesToggle}
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        📝 Notas{comments.length > 0 ? ` (${comments.length})` : ""}
      </button>

      {abierto && (
        <div className={s.notesBody}>
          {comments.length === 0 ? (
            <p className={s.notesEmpty}>
              Todavía no hay notas. Escribí por qué te sirve este contenido.
            </p>
          ) : (
            <ul className={s.notesList}>
              {comments.map((c) => (
                <li key={c.id} className={s.note}>
                  <p className={s.noteMeta}>
                    <span className={s.noteAuthor}>{c.isMine ? "Tú" : c.authorLabel}</span>
                    <span className={s.noteDate}>{formatDate(c.createdAt)}</span>
                  </p>
                  <p className={s.noteBody}>{c.body}</p>
                </li>
              ))}
            </ul>
          )}

          <textarea
            className="textarea"
            rows={2}
            value={body}
            maxLength={MAX_POST_COMMENT_LENGTH}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribe una nota…"
          />
          {error && <p className={s.creditError}>{error}</p>}
          <button
            type="button"
            className={s.notesSend}
            onClick={submit}
            disabled={guardando || !body.trim()}
          >
            {guardando ? "Guardando…" : "Agregar nota"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * La doble verificación del bote de basura. Es un diálogo propio y no un
 * `window.confirm` por dos razones: el nativo no dice QUÉ se pierde (las notas,
 * la transcripción) y no se puede señalar que es definitivo.
 *
 * El foco arranca en "Cancelar" y Escape cierra: si alguien llegó acá sin
 * querer, la salida es lo primero que encuentra.
 */
function ConfirmarBorrado({
  post,
  borrando,
  onCancel,
  onConfirm,
}: {
  post: PortalPost;
  borrando: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className={s.confirmOverlay} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className={s.confirmBox}>
        <p className={s.confirmTitle} id="confirm-title">
          ¿Borrar esta publicación?
        </p>
        <p className={s.confirmText}>
          Se va de tu tablero y del nuestro, con sus notas y su transcripción.
          <strong> No se puede deshacer.</strong>
        </p>
        <p className={s.confirmTarget}>
          {accountLabel(post.username)} · {post.public_id}
        </p>
        <div className={s.confirmActions}>
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={borrando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={s.confirmDanger}
            onClick={onConfirm}
            disabled={borrando}
          >
            {borrando ? "Borrando…" : "Sí, borrar"}
          </button>
        </div>
      </div>
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
  adaptCreditBalance,
  onAdapt,
  canFavorite,
  onFavorite,
  canDelete,
  onDelete,
  enriqueciendo,
  comments,
  onComment,
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
  adaptCreditBalance: number;
  onAdapt: () => void;
  canFavorite: boolean;
  onFavorite: () => void;
  canDelete: boolean;
  onDelete: () => void;
  /** Se le están pidiendo las métricas a Apify (link recién guardado). */
  enriqueciendo: boolean;
  comments: PostComment[];
  onComment: (body: string) => Promise<string | null>;
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
        <span className={s.account}>{accountLabel(post.username)}</span>
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

          {canDelete && (
            <button
              type="button"
              className={s.trashBtn}
              onClick={onDelete}
              title="Borrar esta publicación de tu tablero"
              aria-label="Borrar esta publicación"
            >
              🗑
            </button>
          )}

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
        {enriqueciendo && (
          <span className={s.metricsLoading} title="Buscando los números reales de esta publicación">
            Trayendo datos…
          </span>
        )}
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
                ? "Llegaste al tope de transcripciones de este ciclo"
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
            <span className={s.creditHint}>{transcriptionRemaining} este ciclo</span>
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
            title={adaptBlocked ? "Llegaste al tope del ciclo y no te quedan créditos" : undefined}
          >
            ✦ Adaptar a mi marca
          </button>
          {adaptRemaining !== null && (
            <span className={s.creditHint}>
              {adaptRemaining > 0
                ? `${adaptRemaining} en este ciclo`
                : `${adaptCreditBalance} créditos comprados`}
            </span>
          )}
        </div>
      )}

      {error && <p className={s.creditError}>{error}</p>}

      <NotasPost comments={comments} onComment={onComment} />

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
