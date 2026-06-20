"use client";

import { useEffect, useState, useTransition } from "react";
import { extractHook, saveHook } from "../ganchos/actions";
import { CATEGORY_LABELS } from "../ganchos/constants";
import type { CompetitorPost } from "./actions";
import s from "./competencia.module.css";

type Props = {
  post: CompetitorPost;
  onClose: () => void;
};

type Phase = "extracting" | "result" | "error" | "saved";

export default function GanchoModal({ post, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("extracting");
  const [hookOriginal, setHookOriginal] = useState("");
  const [hookTemplate, setHookTemplate] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!post.transcription) {
      setError("Este post no tiene transcripción.");
      setPhase("error");
      return;
    }
    extractHook(post.transcription).then((result) => {
      if (!result.ok) {
        setError(result.error);
        setPhase("error");
        return;
      }
      setHookOriginal(result.hook_original);
      setHookTemplate(result.hook_template);
      setCategory(result.category);
      setPhase("result");
    });
  }, [post.transcription]);

  function handleSave() {
    startSave(async () => {
      const result = await saveHook({
        source_post_id: post.id,
        source_username: post.username,
        source_permalink: post.permalink,
        hook_original: hookOriginal,
        hook_template: hookTemplate,
        category,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPhase("saved");
    });
  }

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHead}>
          <div>
            <span className="eyebrow">Extraer gancho</span>
            <p className={s.modalSub}>
              @{post.username} · Claude analiza la transcripción y crea una plantilla
            </p>
          </div>
          <button className={s.modalClose} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className={s.modalBody}>
          {phase === "extracting" && (
            <div className={s.modalLoading}>
              <div className={s.spinner} />
              <p>Extrayendo gancho con IA…</p>
            </div>
          )}

          {phase === "error" && (
            <div className={s.modalError}>
              <p className={s.error}>{error}</p>
            </div>
          )}

          {(phase === "result" || phase === "saved") && (
            <>
              <div className={s.modalField}>
                <label className="field-label">Gancho original (del audio)</label>
                <textarea
                  className="textarea"
                  rows={3}
                  value={hookOriginal}
                  onChange={(e) => setHookOriginal(e.target.value)}
                  disabled={phase === "saved"}
                />
              </div>

              <div className={s.modalField}>
                <label className="field-label">Tipo de gancho</label>
                <select
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={phase === "saved"}
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={s.modalField}>
                <label className="field-label">Plantilla reutilizable</label>
                <textarea
                  className="textarea"
                  rows={3}
                  value={hookTemplate}
                  onChange={(e) => setHookTemplate(e.target.value)}
                  disabled={phase === "saved"}
                  placeholder="¿Sabías que [DATO]% de [AUDIENCIA] nunca [ACCIÓN]?"
                />
                <p className={s.modalMeta}>
                  Editá la plantilla hasta que quede perfecta antes de guardar
                </p>
              </div>

              {phase === "saved" && (
                <div className={s.modalSaved}>
                  ✓ Guardado en el Baúl de Ganchos
                </div>
              )}
            </>
          )}
        </div>

        <div className={s.modalFoot}>
          {phase === "saved" ? (
            <>
              <button className="btn btn-secondary" onClick={onClose}>
                Cerrar
              </button>
              <a className="btn btn-primary" href="/ganchos">
                Ver Baúl →
              </a>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              {phase === "result" && (
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving || !hookOriginal.trim() || !hookTemplate.trim()}
                >
                  {saving ? "Guardando…" : "Guardar en Baúl"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
