"use client";

/**
 * Modal "Adaptar a mi marca" del portal (Fase D, etapa 7).
 *
 * Dos pasos, como `/portal/[clientId]/generar`: generar (gasta 1 crédito del
 * add-on de IA) y, si le gusta, guardar (gratis, reusa `guardarGuion` del
 * flujo de generación libre — el guardado no distingue de dónde vino el
 * contenido). Cerrar sin guardar no cuesta nada más allá del crédito ya
 * gastado en generar.
 *
 * El tipo de destino (reel/carrusel) se deriva del post fuente: un carrusel de
 * competencia se adapta a carrusel, cualquier otra cosa a reel. Sin selector —
 * es una decisión de menos para alguien que solo quiere el resultado.
 */

import { useState } from "react";
import Link from "next/link";
import { toScriptView, parseMarkup, type TextChunk } from "@/lib/portal/scriptView";
import { adaptPortalPost } from "./actions";
import { guardarGuion } from "../generar/actions";
import s from "./competencia.module.css";

type ScriptType = "reel" | "carousel";

type Preview = { content: Record<string, unknown>; structureName: string; brief: string };

function Rich({ text }: { text: string }) {
  return (
    <>
      {parseMarkup(text).map((chunk: TextChunk, i) => {
        if (chunk.bold) return <strong key={i}>{chunk.text}</strong>;
        if (chunk.mark) return <mark key={i}>{chunk.text}</mark>;
        if (chunk.underline) return <em key={i}>{chunk.text}</em>;
        return <span key={i}>{chunk.text}</span>;
      })}
    </>
  );
}

export default function AdaptModal({
  clientId,
  post,
  onClose,
  onAdapted,
}: {
  clientId: string;
  post: { id: string; username: string; type: string | null };
  onClose: () => void;
  onAdapted: () => void;
}) {
  const type: ScriptType = post.type === "carousel" ? "carousel" : "reel";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setStarted(true);
    try {
      const res = await adaptPortalPost(clientId, post.id, type);
      if (res.ok) {
        setPreview({ content: res.content, structureName: res.structureName, brief: res.brief });
        onAdapted();
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo adaptar este post.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!preview) return;
    setSaving(true);
    setError(null);
    try {
      const res = await guardarGuion({
        clientId,
        type,
        brief: preview.brief,
        structureName: preview.structureName,
        title: title.trim() || null,
        content: preview.content,
      });
      if (res.ok) setSavedId(res.scriptId);
      else setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el guion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHeader}>
          <span className="eyebrow">Adaptar a mi marca</span>
          <h3 className={s.modalTitle}>Idea de @{post.username}</h3>
          <button type="button" className={s.modalClose} onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {!started && (
          <div className={s.modalBody}>
            <p className={s.modalHint}>
              Vamos a tomar el ángulo y la estructura que le funcionaron a este
              post y reescribirlos 100% con tu voz, tu producto y tu tono. Esto
              gasta una generación de tu cupo mensual.
            </p>
            <div className={s.modalActions}>
              <button type="button" className="btn btn-primary" onClick={generate}>
                Adaptar →
              </button>
            </div>
          </div>
        )}

        {loading && started && (
          <div className={s.modalBody}>
            <div className={s.modalLoading}>
              <span className={s.spinner} />
              <span>Reescribiendo la idea con tu marca…</span>
            </div>
          </div>
        )}

        {error && (
          <div className={s.modalBody}>
            <p className={s.creditError}>{error}</p>
            {!preview && (
              <div className={s.modalActions}>
                <button type="button" className="btn btn-secondary" onClick={generate}>
                  Reintentar
                </button>
              </div>
            )}
          </div>
        )}

        {!loading && preview && (
          <div className={s.modalBody}>
            <article className={s.script}>
              <ScriptPreview content={preview.content} type={type} />
            </article>

            {savedId ? (
              <div className={s.savedBox}>
                <p className={s.savedTitle}>Guion guardado</p>
                <p className={s.savedText}>
                  Ya está en tus guiones, marcado como <strong>En preparación</strong>.
                </p>
                <div className={s.modalActions}>
                  <Link href={`/portal/${clientId}/guiones/${savedId}`} className="btn btn-primary">
                    Ver el guion →
                  </Link>
                  <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={s.modalField}>
                  <label className="field-label" htmlFor="adapt-title">
                    Título (opcional)
                  </label>
                  <input
                    id="adapt-title"
                    className="input"
                    maxLength={200}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className={s.modalActions}>
                  <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                    Cerrar sin guardar
                  </button>
                  <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                    {saving ? "Guardando…" : "Guardar guion"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScriptPreview({ content, type }: { content: Record<string, unknown>; type: ScriptType }) {
  const view = toScriptView(content, type);

  if (view.kind === "empty") {
    return <p className={s.emptyText}>La adaptación llegó vacía. Prueba de nuevo.</p>;
  }

  if (view.kind === "carousel") {
    return (
      <div className={s.slides}>
        {view.slides.map((slide) => (
          <section key={slide.number} className={s.slideCard}>
            <span className={s.slideNumber}>Slide {slide.number}</span>
            <p className={s.slideText}>
              <Rich text={slide.text} />
            </p>
            {slide.visual && <p className={s.slideVisual}>Visual: {slide.visual}</p>}
          </section>
        ))}
      </div>
    );
  }

  return (
    <p className={s.voiceOff}>
      <Rich text={view.voiceOff} />
    </p>
  );
}
