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
 *
 * Etapa 8: el resultado ya no es solo lectura. Se puede corregir el texto
 * ANTES de guardar (lo generado por IA casi nunca sale perfecto, y volver a
 * generar cuesta otro crédito). Lo que se guarda es lo que quedó en pantalla.
 */

import { useState } from "react";
import Link from "next/link";
import ScriptBody from "@/components/portal/ScriptBody";
import ScriptTextEditor from "@/components/portal/ScriptTextEditor";
import {
  applyTextDraft,
  toTextDraft,
  isEditableDraft,
  type ScriptTextDraft,
} from "@/lib/portal/scriptEdit";
import { adaptPortalPost } from "./actions";
import { guardarGuion } from "../generar/actions";
import s from "./competencia.module.css";

type ScriptType = "reel" | "carousel";

type Preview = { content: Record<string, unknown>; structureName: string; brief: string };

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
  const [draft, setDraft] = useState<ScriptTextDraft | null>(null);
  const [editing, setEditing] = useState(false);
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
        setDraft(toTextDraft(res.content, type));
        setEditing(false);
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
      // Se guarda lo editado, no lo que devolvió la IA. `applyTextDraft`
      // mergea sobre el content original para no perder lo que el portal no
      // dibuja (bloques, música, `visual` de cada slide).
      const content = draft ? applyTextDraft(preview.content, draft) : preview.content;
      const res = await guardarGuion({
        clientId,
        type,
        brief: preview.brief,
        structureName: preview.structureName,
        title: title.trim() || null,
        content,
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
            {!savedId && draft && isEditableDraft(draft) && (
              <div className={s.editToggleRow}>
                <button
                  type="button"
                  className={s.editToggle}
                  onClick={() => setEditing((v) => !v)}
                  disabled={saving}
                >
                  {editing ? "Ver como queda" : "✎ Editar el texto"}
                </button>
              </div>
            )}

            <article className={s.script}>
              {editing && draft ? (
                <ScriptTextEditor draft={draft} onChange={setDraft} disabled={saving} />
              ) : (
                <ScriptBody
                  content={draft ? applyTextDraft(preview.content, draft) : preview.content}
                  type={type}
                  framed={false}
                  compact
                  emptyText="La adaptación llegó vacía. Prueba de nuevo."
                />
              )}
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
