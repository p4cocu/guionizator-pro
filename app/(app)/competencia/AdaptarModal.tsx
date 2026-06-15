"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { saveScriptWithNewIdea } from "../guiones/actions";
import type { CompetitorPost } from "./actions";
import s from "./competencia.module.css";

type CarouselSlide = {
  number: number;
  text: string;
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
  onClose: () => void;
};

function isReel(c: Content): c is ReelContent {
  return "voice_off" in c;
}

function buildBrief(post: CompetitorPost): string {
  const caption = (post.caption ?? "").trim().replace(/\s+/g, " ");
  const excerpt = caption.length > 240 ? caption.slice(0, 240) + "…" : caption;
  return `Adaptación del post de @${post.username}${excerpt ? `: "${excerpt}"` : ""}`;
}

export default function AdaptarModal({ post, clientId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdaptResponse | null>(null);
  const [title, setTitle] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  // No setState síncrono antes del primer await (regla react-hooks/set-state-in-effect):
  // `loading` arranca en true y el botón Regenerar repone el estado de carga.
  const generate = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/adapt-competitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, post }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al adaptar el post");
      setData(json as AdaptResponse);
      setTitle((json.title as string | null) ?? "");
      setSavedId(null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [clientId, post]);

  function regenerate() {
    setLoading(true);
    setError(null);
    setSavedId(null);
    generate();
  }

  useEffect(() => {
    // Fetch-on-mount: los setState de generate() ocurren tras el await, no causan
    // renders en cascada.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    generate();
  }, [generate]);

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

  function updateSlide(idx: number, field: "text" | "visual", value: string) {
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
        <div className={s.modalHead}>
          <div>
            <span className="eyebrow">Adaptar a mi marca</span>
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
          {loading && (
            <div className={s.modalLoading}>
              <div className={s.spinner} />
              <p>Adaptando a la voz de tu marca…</p>
            </div>
          )}

          {!loading && error && (
            <div className={s.modalError}>
              <p className={s.error}>{error}</p>
              <button className="btn btn-secondary" onClick={regenerate}>
                Reintentar
              </button>
            </div>
          )}

          {!loading && !error && data && (
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
                      <textarea
                        className="textarea"
                        rows={2}
                        value={sl.text}
                        onChange={(e) => updateSlide(i, "text", e.target.value)}
                        disabled={!!savedId}
                        placeholder="Texto del slide"
                      />
                      <textarea
                        className="textarea"
                        rows={2}
                        value={sl.visual}
                        onChange={(e) => updateSlide(i, "visual", e.target.value)}
                        disabled={!!savedId}
                        placeholder="Diseño visual"
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {!loading && !error && data && (
          <div className={s.modalFoot}>
            {savedId ? (
              <>
                <span className={s.modalSaved}>✓ Guion guardado e idea creada en el dashboard</span>
                <a className="btn btn-primary" href={`/guiones/${savedId}`}>
                  Ver guion →
                </a>
              </>
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
          </div>
        )}
      </div>
    </div>
  );
}
