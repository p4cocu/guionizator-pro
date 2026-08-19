"use client";

/**
 * Editor de texto del guion, del lado del cliente (Fase D, etapa 8).
 *
 * Se usa en tres lugares: antes de guardar (adaptar un post de competencia y
 * generar un guion) y después (la pantalla del guion en el portal). Es
 * controlado — el borrador vive en quien lo usa — porque en dos de esos tres
 * casos el contenido se guarda junto con otras cosas.
 *
 * Solo texto, a propósito: ver el porqué en `lib/portal/scriptEdit.ts`.
 *
 * El markdown ligero (`**negrita**`, `==resaltado==`, `_subrayado_`) se escribe
 * a mano y se ve al salir de la edición: replicar la barra de formato del
 * estudio acá sería mucha UI para lo que el cliente hace, que es corregir una
 * frase.
 */

import type { ScriptTextDraft } from "@/lib/portal/scriptEdit";
import { MAX_TEXT_LENGTH } from "@/lib/portal/scriptEdit";
import s from "./ScriptTextEditor.module.css";

export default function ScriptTextEditor({
  draft,
  onChange,
  disabled = false,
}: {
  draft: ScriptTextDraft;
  onChange: (next: ScriptTextDraft) => void;
  disabled?: boolean;
}) {
  if (draft.kind === "reel") {
    return (
      <div className={s.editor}>
        <label className="field-label" htmlFor="script-voice-off">
          Voz en off
        </label>
        <textarea
          id="script-voice-off"
          className={`textarea ${s.voiceOff}`}
          value={draft.voiceOff}
          maxLength={MAX_TEXT_LENGTH}
          rows={10}
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, voiceOff: e.target.value })}
        />
        <p className={s.hint}>
          Es el texto que se lee en cámara. Lo demás del guion (planos,
          duraciones, música) lo ajustamos nosotros.
        </p>
      </div>
    );
  }

  if (draft.kind === "carousel") {
    return (
      <div className={s.editor}>
        {draft.slides.map((slide, i) => (
          <div key={i} className={s.slide}>
            <span className={s.slideNumber}>Slide {slide.number}</span>

            <label className="field-label" htmlFor={`slide-text-${i}`}>
              Titular
            </label>
            <textarea
              id={`slide-text-${i}`}
              className="textarea"
              value={slide.text}
              maxLength={MAX_TEXT_LENGTH}
              rows={2}
              disabled={disabled}
              onChange={(e) => {
                const slides = draft.slides.map((sl, j) =>
                  j === i ? { ...sl, text: e.target.value } : sl,
                );
                onChange({ ...draft, slides });
              }}
            />

            {slide.body !== null && (
              <>
                <label className="field-label" htmlFor={`slide-body-${i}`}>
                  Texto del slide
                </label>
                <textarea
                  id={`slide-body-${i}`}
                  className="textarea"
                  value={slide.body}
                  maxLength={MAX_TEXT_LENGTH}
                  rows={3}
                  disabled={disabled}
                  onChange={(e) => {
                    const slides = draft.slides.map((sl, j) =>
                      j === i ? { ...sl, body: e.target.value } : sl,
                    );
                    onChange({ ...draft, slides });
                  }}
                />
              </>
            )}
          </div>
        ))}
        <p className={s.hint}>
          El diseño de cada slide (imágenes, colores, jerarquía) lo armamos
          nosotros a partir de este texto.
        </p>
      </div>
    );
  }

  return <p className={s.hint}>Este guion no tiene texto editable.</p>;
}
