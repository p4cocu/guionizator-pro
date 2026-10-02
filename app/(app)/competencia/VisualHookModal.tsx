"use client";

import { useEffect, useState } from "react";
import { analyzeVisualHook, type CompetitorPost } from "./actions";
import {
  DEFAULT_VISUAL_HOOK_SECONDS,
  sanitizeVisualHook,
  VISUAL_HOOK_SECONDS,
  type VisualHook,
  type VisualHookSeconds,
} from "@/lib/competencia/visualHook";
import VisualHookView from "@/components/hooks/VisualHookView";
import s from "./competencia.module.css";

type Props = {
  post: CompetitorPost;
  onClose: () => void;
  onPostUpdate: (patch: Partial<CompetitorPost>) => void;
};

/**
 * "👁 Gancho visual" (migración `0023`): Gemini mira los primeros segundos del
 * reel. No se dispara solo al abrir — cada análisis es una llamada de pago y
 * el largo lo eliges tú. Si ya hay uno guardado, se muestra directo.
 */
export default function VisualHookModal({ post, onClose, onPostUpdate }: Props) {
  const [hook, setHook] = useState<VisualHook | null>(() => sanitizeVisualHook(post.visual_hook));
  const [seconds, setSeconds] = useState<VisualHookSeconds>(
    () => (sanitizeVisualHook(post.visual_hook)?.seconds as VisualHookSeconds) ?? DEFAULT_VISUAL_HOOK_SECONDS,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, loading]);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeVisualHook(post.id, { seconds, force: true });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setHook(res.visual_hook);
      onPostUpdate({ visual_hook: res.visual_hook, visual_hook_at: res.visual_hook_at });
    } catch (e) {
      setError((e as Error).message || "No se pudo analizar el video.");
    } finally {
      setLoading(false);
    }
  }

  const sameAsSaved = hook != null && hook.seconds === seconds;

  return (
    <div className={s.modalOverlay} onClick={loading ? undefined : onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHead}>
          <div>
            <span className="eyebrow">Gancho visual</span>
            <p className={s.modalSub}>
              @{post.username} · Gemini mira solo los primeros segundos del video: texto en pantalla, qué se ve,
              qué se dice, cámara y si se entiende sin audio
            </p>
          </div>
          <button className={s.modalClose} onClick={onClose} aria-label="Cerrar" disabled={loading}>
            ×
          </button>
        </div>

        <div className={s.modalBody}>
          <div className={s.visualHookBar}>
            <span className="field-label" style={{ margin: 0 }}>Analizar los primeros</span>
            <div className={s.visualHookSeconds} role="radiogroup" aria-label="Segundos a analizar">
              {VISUAL_HOOK_SECONDS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={seconds === n}
                  className={`${s.visualHookSec} ${seconds === n ? s.visualHookSecActive : ""}`}
                  onClick={() => setSeconds(n)}
                  disabled={loading}
                >
                  {n} s
                </button>
              ))}
            </div>
            <span className={s.modalMeta} style={{ margin: 0 }}>
              {seconds === 10 ? "Para ganchos lentos" : seconds === 3 ? "Más cuadros por segundo" : "Recomendado"}
            </span>
          </div>

          {loading && (
            <div className={s.modalLoading}>
              <div className={s.spinner} />
              <p>Gemini está mirando los primeros {seconds} segundos…</p>
            </div>
          )}

          {!loading && error && <p className={s.error}>{error}</p>}

          {!loading && hook && (
            <VisualHookView
              hook={hook}
              footer={
                <>
                  Analizado en los primeros {hook.seconds} s del video. Se usa también en &quot;Adaptar a mi marca&quot;.
                </>
              }
            />
          )}

          {!loading && !hook && !error && (
            <p className={s.modalMeta}>
              Elige cuántos segundos mirar y dale a Analizar. El resultado se guarda: abrirlo de nuevo no vuelve a
              cobrar.
            </p>
          )}
        </div>

        <div className={s.modalFoot}>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cerrar
          </button>
          <button className="btn btn-primary" onClick={run} disabled={loading}>
            {loading ? "Analizando…" : !hook ? "👁 Analizar" : sameAsSaved ? "↻ Rehacer" : `Analizar ${seconds} s`}
          </button>
        </div>
      </div>
    </div>
  );
}
