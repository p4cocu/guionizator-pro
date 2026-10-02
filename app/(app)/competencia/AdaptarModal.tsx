"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveScriptWithNewIdea } from "../guiones/actions";
import { extractSkeleton } from "./actions";
import {
  INTERPRETATION_MAX,
  sanitizeSkeleton,
  skeletonInstruction,
  type PostSkeleton,
} from "@/lib/competencia/skeleton";
import { HOOK_TYPE_LABELS } from "@/lib/competencia/taxonomy";
import { getProductOptions } from "../clientes/productActions";
import type { CompetitorPost } from "./actions";
import s from "./competencia.module.css";

type AdaptType = "completa" | "ligera";

type CarouselSlide = {
  number: number;
  text: string;
  body?: string;
  visual: string;
  micro_anchor: string | null;
};
type ReelContent = {
  voice_off: string;
  blocks: unknown[];
  music_a: unknown;
  music_b: unknown;
};
type CarouselContent = { slides: CarouselSlide[] };
type Content = ReelContent | CarouselContent;

type AdaptResponse = {
  content: Content;
  structure_name: string;
  title: string | null;
  type: "reel" | "carousel";
  brain_version_id: string | null;
};

type Props = {
  post: CompetitorPost;
  clientId: string;
  clientName?: string;
  onClose: () => void;
  /** Avisa al tablero lo que cambió del post (transcripción, esqueleto). */
  onPostUpdate?: (patch: Partial<CompetitorPost>) => void;
};

function isReel(c: Content): c is ReelContent {
  return "voice_off" in c;
}

function buildBrief(post: CompetitorPost): string {
  const caption = (post.caption ?? "").trim().replace(/\s+/g, " ");
  const excerpt = caption.length > 240 ? caption.slice(0, 240) + "…" : caption;
  const source = post.transcription ? "transcripción" : "caption";
  return `Adaptación del post de @${post.username} (vía ${source})${excerpt ? `: "${excerpt}"` : ""}`;
}

function buildCompletaBrief(
  post: CompetitorPost,
  skeleton: PostSkeleton | null,
  interpretation: string,
): string {
  const caption = (post.caption ?? "").trim().replace(/\s+/g, " ");
  const excerpt = caption.length > 300 ? caption.slice(0, 300) + "…" : caption;

  const metrics = [
    post.video_views != null && `${post.video_views} vistas`,
    post.likes != null && `${post.likes} likes`,
    post.comments != null && `${post.comments} comentarios`,
  ]
    .filter(Boolean)
    .join(" · ");

  const transcriptSection = post.transcription
    ? `\nTranscripción del audio:\n"${post.transcription}"`
    : "";

  return [
    `Adaptar idea de la competencia (@${post.username}):`,
    excerpt ? `"${excerpt}"` : null,
    metrics ? `\nMétricas del post original: ${metrics}` : null,
    transcriptSection || null,
    `\nObjetivo: tomar el ángulo y gancho ganadores de este post y reescribirlos 100% con el estilo, productos y tono del cliente. No es una copia: apropiarse del patrón que funcionó.`,
    skeletonInstruction(skeleton, interpretation) || null,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function AdaptarModal({ post, clientId, clientName, onClose, onPostUpdate }: Props) {
  const router = useRouter();

  // Paso 0: esqueleto del post fuente + "tu interpretación" (0021)
  const [phase, setPhase] = useState<"skeleton" | "pick" | "loading" | "result">("skeleton");
  const [skeleton, setSkeleton] = useState<PostSkeleton | null>(() => sanitizeSkeleton(post.skeleton));
  const [skLoading, setSkLoading] = useState(false);
  const [skError, setSkError] = useState<string | null>(null);
  const [needsTranscription, setNeedsTranscription] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [interpretation, setInterpretation] = useState("");

  const runSkeleton = useCallback(
    async (force = false) => {
      setSkLoading(true);
      setSkError(null);
      setNeedsTranscription(false);
      try {
        const res = await extractSkeleton(post.id, { force });
        if (!res.ok) {
          setSkError(res.error);
          setNeedsTranscription(Boolean(res.needsTranscription));
          return;
        }
        setSkeleton(res.skeleton);
        onPostUpdate?.({ skeleton: res.skeleton, skeleton_at: res.skeleton_at });
      } catch (e) {
        setSkError((e as Error).message || "No se pudo extraer el esqueleto.");
      } finally {
        setSkLoading(false);
      }
    },
    [post.id, onPostUpdate]
  );

  // Al abrir: si no hay esqueleto guardado, se extrae solo (~5s, MODEL_FAST).
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || skeleton) return;
    autoRan.current = true;
    void runSkeleton(false);
  }, [skeleton, runSkeleton]);

  async function transcribeThenSkeleton() {
    setTranscribing(true);
    setSkError(null);
    try {
      const res = await fetch("/api/transcribe-reel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: post.id }),
      });
      const json = (await res.json()) as { transcription?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Error al transcribir");
      onPostUpdate?.({ transcription: json.transcription ?? null });
      setTranscribing(false);
      await runSkeleton(true);
    } catch (e) {
      setSkError((e as Error).message);
    } finally {
      setTranscribing(false);
    }
  }
  const [adaptType, setAdaptType] = useState<AdaptType>("completa");
  const [adaptContext, setAdaptContext] = useState("");

  // Servicio al que se adapta, además de la marca (ficha de oferta, 0016).
  // Se cargan al abrir: la marca destino puede ser otra que la del tablero.
  const [products, setProducts] = useState<{ id: string; nombre: string; tipo: string }[]>([]);
  const [productId, setProductId] = useState("");
  useEffect(() => {
    let alive = true;
    getProductOptions(clientId)
      .then((list) => {
        if (alive) setProducts(list);
      })
      .catch(() => {
        // Sin lista, se adapta solo a la marca, como antes.
        if (alive) setProducts([]);
      });
    return () => {
      alive = false;
    };
  }, [clientId]);

  // Paso 2: resultado
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdaptResponse | null>(null);
  const [title, setTitle] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const generate = useCallback(
    async (type: AdaptType, context: string) => {
      setPhase("loading");
      setError(null);
      try {
        const res = await fetch("/api/ai/adapt-competitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            post,
            adapt_type: type,
            context: context.trim() || undefined,
            product_id: productId || undefined,
            skeleton: skeleton ?? undefined,
            interpretation: interpretation.trim() || undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Error al adaptar el post");
        setData(json as AdaptResponse);
        setTitle((json.title as string | null) ?? "");
        setSavedId(null);
        setPhase("result");
      } catch (e) {
        setError((e as Error).message);
        setPhase("result");
      }
    },
    [clientId, post, productId, skeleton, interpretation]
  );

  function handleContinuar() {
    if (adaptType === "completa") {
      const brief = buildCompletaBrief(post, skeleton, interpretation);
      const type = post.type === "carousel" ? "carousel" : "reel";
      const params = new URLSearchParams({
        client_id: clientId,
        type,
        brief,
        source_post_id: post.id,
        ...(post.permalink ? { source_post_permalink: post.permalink } : {}),
        ...(productId ? { product_id: productId } : {}),
      });
      router.push(`/guiones/nuevo?${params.toString()}`);
      onClose();
    } else {
      generate("ligera", adaptContext);
    }
  }

  function regenerate() {
    setData(null);
    setSavedId(null);
    generate(adaptType, adaptContext);
  }

  // Cerrar con Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function updateVoiceOff(value: string) {
    if (!data || !isReel(data.content)) return;
    setData({ ...data, content: { ...data.content, voice_off: value } });
  }

  function updateSlide(idx: number, field: "text" | "body" | "visual", value: string) {
    if (!data || isReel(data.content)) return;
    const slides = data.content.slides.map((sl, i) =>
      i === idx ? { ...sl, [field]: value } : sl
    );
    setData({ ...data, content: { slides } });
  }

  function handleSave() {
    if (!data) return;
    startSave(async () => {
      try {
        const id = await saveScriptWithNewIdea({
          client_id: clientId,
          type: data.type,
          brief: buildBrief(post),
          structure_name: data.structure_name,
          title: title.trim() || null,
          content: data.content as Record<string, unknown>,
          brain_version_id: data.brain_version_id,
          source_post_permalink: post.permalink ?? null,
          source_post_id: post.id,
          product_id: productId || null,
        });
        setSavedId(id);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>

        {/* ── Cabecera ── */}
        <div className={s.modalHead}>
          <div>
            <span className="eyebrow">
              {clientName ? `Adaptar para ${clientName}` : "Adaptar a mi marca"}
            </span>
            <p className={s.modalSub}>
              Idea-fuente: @{post.username}
              {data ? ` · ${data.type === "carousel" ? "Carrusel" : "Reel"}` : ""}
            </p>
          </div>
          <button className={s.modalClose} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className={s.modalBody}>

          {/* ── Paso 0: Esqueleto ── */}
          {phase === "skeleton" && (
            <div className={s.adaptPicker}>
              <p className={s.adaptPickerLabel}>
                La estructura que hizo funcionar este post, separada de su tema. Es lo que se va a
                replicar con el tuyo.
              </p>

              {skLoading && (
                <div className={s.modalLoading}>
                  <div className={s.spinner} />
                  <p>Sacando el esqueleto…</p>
                </div>
              )}
              {transcribing && !skLoading && (
                <div className={s.modalLoading}>
                  <div className={s.spinner} />
                  <p>Transcribiendo el reel…</p>
                </div>
              )}

              {!skLoading && !transcribing && skError && (
                <div className={s.skeletonNotice}>
                  <p className={s.error}>{skError}</p>
                  <div className={s.skeletonNoticeActions}>
                    {needsTranscription ? (
                      <button className="btn btn-secondary" onClick={transcribeThenSkeleton}>
                        🎤 Transcribir y sacar esqueleto
                      </button>
                    ) : (
                      <button className="btn btn-secondary" onClick={() => runSkeleton(true)}>
                        Reintentar
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!skLoading && !transcribing && skeleton && (
                <div className={s.skeletonCard}>
                  <div className={s.skeletonRow}>
                    <span className={s.skeletonKey}>Gancho</span>
                    <div>
                      {skeleton.hook.quote && <p className={s.skeletonQuote}>“{skeleton.hook.quote}”</p>}
                      <p className={s.skeletonNote}>
                        {skeleton.hook.hook_type && (
                          <span className={s.skeletonTag}>
                            {HOOK_TYPE_LABELS[skeleton.hook.hook_type] ?? skeleton.hook.hook_type}
                          </span>
                        )}
                        {skeleton.hook.why}
                      </p>
                    </div>
                  </div>

                  <div className={s.skeletonRow}>
                    <span className={s.skeletonKey}>Primer problema</span>
                    <div>
                      <p className={s.skeletonNote}>
                        <span className={s.skeletonTag}>
                          {skeleton.first_problem.second != null
                            ? `≈ seg ${skeleton.first_problem.second}`
                            : !skeleton.first_problem.quote
                              ? "no plantea"
                              : skeleton.source === "caption"
                                ? "sin audio"
                                : "seg —"}
                        </span>
                        {skeleton.first_problem.what}
                      </p>
                      {skeleton.first_problem.quote && (
                        <p className={s.skeletonQuote}>“{skeleton.first_problem.quote}”</p>
                      )}
                    </div>
                  </div>

                  {skeleton.retention.length > 0 && (
                    <div className={s.skeletonRow}>
                      <span className={s.skeletonKey}>Cómo retiene</span>
                      <ul className={s.skeletonList}>
                        {skeleton.retention.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className={s.skeletonRow}>
                    <span className={s.skeletonKey}>Cómo cierra</span>
                    <div>
                      {skeleton.closing.quote && <p className={s.skeletonQuote}>“{skeleton.closing.quote}”</p>}
                      {skeleton.closing.asks && <p className={s.skeletonNote}>Pide: {skeleton.closing.asks}</p>}
                    </div>
                  </div>

                  {skeleton.steps.length > 0 && (
                    <div className={s.skeletonRow}>
                      <span className={s.skeletonKey}>Esqueleto</span>
                      <ol className={s.skeletonList}>
                        {skeleton.steps.map((st, i) => (
                          <li key={i}>{st}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <p className={s.modalMeta}>
                    {skeleton.source === "transcription"
                      ? "El segundo es estimado (≈2.5 palabras/s): la transcripción no trae tiempos."
                      : "Sacado de la descripción del post."}{" "}
                    <button className={s.linkBtn} onClick={() => runSkeleton(true)} type="button">
                      Rehacer
                    </button>
                  </p>
                </div>
              )}

              {!skLoading && !transcribing && (
                <div className={s.adaptContextField}>
                  <label className="field-label">Tu interpretación (opcional)</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    maxLength={INTERPRETATION_MAX}
                    placeholder="Qué ángulo le pones tú, qué te ha pasado con esto, con qué no estás de acuerdo… Se usa tal cual: no se le agregan cifras ni casos."
                    value={interpretation}
                    onChange={(e) => setInterpretation(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Paso 1: Picker ── */}
          {phase === "pick" && (
            <div className={s.adaptPicker}>
              {post.transcription && (
                <p className={s.adaptPickerLabel} style={{ color: "var(--emerald)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--emerald)", display: "inline-block", flexShrink: 0 }} />
                  Transcripción disponible — Claude usará el audio, no solo el caption
                </p>
              )}
              <p className={s.adaptPickerLabel}>¿Cómo quieres adaptar este contenido?</p>

              <div className={s.adaptOptions}>
                <button
                  className={`${s.adaptOption} ${adaptType === "completa" ? s.adaptOptionActive : ""}`}
                  onClick={() => setAdaptType("completa")}
                  type="button"
                >
                  <span className={s.adaptOptionIcon}>✦</span>
                  <div className={s.adaptOptionContent}>
                    <span className={s.adaptOptionTitle}>Adaptación completa</span>
                    <span className={s.adaptOptionDesc}>
                      Tomo el ángulo y gancho ganadores y los reescribo 100% con tu marca,
                      productos y tono de voz. Te lleva al flujo de generación con control total.
                    </span>
                  </div>
                </button>

                <button
                  className={`${s.adaptOption} ${adaptType === "ligera" ? s.adaptOptionActive : ""}`}
                  onClick={() => setAdaptType("ligera")}
                  type="button"
                >
                  <span className={s.adaptOptionIcon}>◎</span>
                  <div className={s.adaptOptionContent}>
                    <span className={s.adaptOptionTitle}>Adaptación ligera</span>
                    <span className={s.adaptOptionDesc}>
                      Conservo la misma idea y estructura, solo adapto el tono de voz al
                      estilo de tu marca. Resultado directo aquí.
                    </span>
                  </div>
                </button>
              </div>

              {products.length > 0 && (
                <div className={s.adaptContextField}>
                  <label className="field-label">Adaptar también a un servicio (opcional)</label>
                  <select
                    className="input"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    <option value="">— Solo a la marca —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.tipo === "producto" ? "Producto" : "Servicio"}: {p.nombre}
                      </option>
                    ))}
                  </select>
                  {productId && (
                    <p className={s.adaptPickerLabel} style={{ marginTop: 6, fontSize: 12 }}>
                      {adaptType === "completa"
                        ? "El ángulo ganador se aterriza en el problema, el proceso y el CTA de su ficha."
                        : "El post se conserva; solo el cierre conecta con el servicio y su CTA."}
                    </p>
                  )}
                </div>
              )}

              {adaptType === "ligera" && (
                <div className={s.adaptContextField}>
                  <label className="field-label">Contexto adicional (opcional)</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    placeholder="Ej: quiero que el tono sea más cercano y tutee al lector, evita tecnicismos, enfoca en el beneficio emocional…"
                    value={adaptContext}
                    onChange={(e) => setAdaptContext(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Paso 2a: Cargando ── */}
          {phase === "loading" && (
            <div className={s.modalLoading}>
              <div className={s.spinner} />
              <p>Adaptando con tono ligero…</p>
            </div>
          )}

          {/* ── Paso 2b: Error ── */}
          {phase === "result" && error && (
            <div className={s.modalError}>
              <p className={s.error}>{error}</p>
              <button className="btn btn-secondary" onClick={regenerate}>
                Reintentar
              </button>
            </div>
          )}

          {/* ── Paso 2c: Resultado ── */}
          {phase === "result" && !error && data && (
            <>
              <div className={s.modalField}>
                <label className="field-label">Título de publicación</label>
                <input
                  className="input"
                  value={title}
                  placeholder="Título para esta publicación"
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!!savedId}
                />
                <p className={s.modalMeta}>Estructura: {data.structure_name}</p>
              </div>

              {isReel(data.content) ? (
                <div className={s.modalField}>
                  <label className="field-label">Voz en off (teleprompter)</label>
                  <textarea
                    className="textarea"
                    rows={10}
                    value={data.content.voice_off}
                    onChange={(e) => updateVoiceOff(e.target.value)}
                    disabled={!!savedId}
                  />
                </div>
              ) : (
                <div className={s.modalSlides}>
                  {data.content.slides.map((sl, i) => (
                    <div key={sl.number ?? i} className={s.modalSlide}>
                      <span className={s.modalSlideNum}>Slide {sl.number ?? i + 1}</span>
                      <div className={s.modalSlideField}>
                        <label className={s.modalSlideLabel}>Titular</label>
                        <textarea
                          className="textarea"
                          rows={2}
                          value={sl.text}
                          onChange={(e) => updateSlide(i, "text", e.target.value)}
                          disabled={!!savedId}
                          placeholder="Titular del slide"
                        />
                      </div>
                      <div className={s.modalSlideField}>
                        <label className={s.modalSlideLabel}>Cuerpo del slide</label>
                        <textarea
                          className="textarea"
                          rows={3}
                          value={sl.body ?? ""}
                          onChange={(e) => updateSlide(i, "body", e.target.value)}
                          disabled={!!savedId}
                          placeholder="Párrafo de desarrollo (1-2 oraciones)"
                        />
                      </div>
                      <div className={s.modalSlideField}>
                        <label className={s.modalSlideLabel}>Diseño visual</label>
                        <textarea
                          className="textarea"
                          rows={2}
                          value={sl.visual}
                          onChange={(e) => updateSlide(i, "visual", e.target.value)}
                          disabled={!!savedId}
                          placeholder="Notas de diseño visual"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className={s.modalFoot}>
          {phase === "skeleton" && (
            <>
              <button className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setPhase("pick")}
                disabled={skLoading || transcribing}
              >
                {skeleton ? "Continuar →" : "Seguir sin esqueleto →"}
              </button>
            </>
          )}

          {phase === "pick" && (
            <>
              <button className="btn btn-secondary" onClick={() => setPhase("skeleton")}>
                ← Esqueleto
              </button>
              <button className="btn btn-primary" onClick={handleContinuar}>
                {adaptType === "completa" ? "Ir a generación →" : "Generar →"}
              </button>
            </>
          )}

          {phase === "loading" && (
            <button className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
          )}

          {phase === "result" && (
            <>
              {savedId ? (
                <>
                  <span className={s.modalSaved}>✓ Guion guardado e idea creada en el calendario</span>
                  <a className="btn btn-primary" href={`/guiones/${savedId}`}>
                    Ver guion →
                  </a>
                </>
              ) : (
                <>
                  {error ? (
                    <button className="btn btn-secondary" onClick={() => setPhase("pick")}>
                      ← Volver
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn-secondary"
                        onClick={regenerate}
                        disabled={saving}
                      >
                        Regenerar
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? "Guardando…" : "Guardar guion"}
                      </button>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
