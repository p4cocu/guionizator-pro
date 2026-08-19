"use client";

/**
 * El guion dibujado, en modo lectura (Fase D, etapa 8).
 *
 * Hasta la etapa 7 este render estaba copiado en tres lugares —
 * `guiones/[scriptId]/page.tsx`, `competencia/AdaptModal.tsx` y
 * `generar/GenerarClient.tsx`— con tres variantes que ya empezaban a
 * desincronizarse (una dibujaba `body` de los slides, otra no). Acá vive una
 * sola vez, y desde la etapa 8 lo usa también el modal del calendario del
 * estudio.
 *
 * Es `"use client"` porque el modal del calendario es cliente. En un server
 * component funciona igual (no tiene estado ni efectos): Next lo trata como
 * frontera de cliente y ya.
 *
 * Dibuja lo que `toScriptView` normaliza y **nunca lanza**: un guion viejo con
 * otra forma se muestra degradado, no rompe la pantalla. El markdown ligero se
 * resuelve con `parseMarkup`, que devuelve datos y no HTML — sin
 * `dangerouslySetInnerHTML` sobre texto que hoy escribe Paco y mañana puede
 * escribir un colaborador del cliente.
 */

import { toScriptView, parseMarkup, type TextChunk } from "@/lib/portal/scriptView";
import s from "./ScriptBody.module.css";

/** Texto con `**negrita**`, `==resaltado==` y `_subrayado_` resueltos a JSX. */
export function Rich({ text }: { text: string }) {
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

export default function ScriptBody({
  content,
  type,
  /** Marco de tarjeta propio. `false` cuando quien llama ya dibuja el suyo. */
  framed = true,
  /** Tipografía y espaciado reducidos, para modales. */
  compact = false,
  emptyText = "Este guion todavía no tiene contenido escrito.",
}: {
  content: Record<string, unknown> | null | undefined;
  type: string | null;
  framed?: boolean;
  compact?: boolean;
  emptyText?: string;
}) {
  const view = toScriptView(content, type);
  const className = `${s.script} ${framed ? s.framed : ""} ${compact ? s.compact : ""}`;

  if (view.kind === "empty") {
    return (
      <div className={className}>
        <p className={s.emptyText}>{emptyText}</p>
      </div>
    );
  }

  if (view.kind === "carousel") {
    return (
      <div className={className}>
        <div className={s.slides}>
          {view.slides.map((slide) => (
            <section key={slide.number} className={s.slide}>
              <span className={s.slideNumber}>Slide {slide.number}</span>
              <p className={s.slideText}>
                <Rich text={slide.text} />
              </p>
              {slide.body && (
                <p className={s.slideBody}>
                  <Rich text={slide.body} />
                </p>
              )}
              {slide.visual && <p className={s.slideVisual}>Visual: {slide.visual}</p>}
              {slide.microAnchor && <p className={s.slideAnchor}>{slide.microAnchor}</p>}
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {view.voiceOff && (
        <section className={s.block}>
          <h3 className={s.blockTitle}>Voz en off</h3>
          <p className={s.voiceOff}>
            <Rich text={view.voiceOff} />
          </p>
        </section>
      )}

      {view.blocks.map((b, i) => (
        <section key={i} className={s.block}>
          <h3 className={s.blockTitle}>
            {b.name || `Bloque ${i + 1}`}
            {b.duration && <span className={s.duration}>{b.duration}</span>}
          </h3>
          {b.lines.map((l, j) => (
            <p key={j} className={s.line}>
              {l.tag && <span className={s.tag}>{l.tag}</span>}
              <Rich text={l.text} />
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
