/**
 * El gancho visual de un reel (migración `0023`, Gemini) en tarjeta: las 3
 * capas, dónde vive el gancho, cámara, sin audio, los 7 criterios y la jugada.
 * Lo comparten el modal "👁 Gancho visual" y el paso de anatomía de Adaptar.
 */

import type { ReactNode } from "react";
import { CAMERA_LABELS, HOOK_LAYER_LABELS, type VisualHook } from "@/lib/competencia/visualHook";
import { HOOK_TYPE_LABELS } from "@/lib/competencia/taxonomy";
import { wordCount } from "@/lib/hooks/criteria";
import { Checklist, Layers, ScoreBadge } from "./HookParts";
import sk from "@/components/skeleton/SkeletonView.module.css";

export default function VisualHookView({
  hook,
  compact = false,
  footer,
}: {
  hook: VisualHook;
  /** Sin checklist (dentro de Adaptar, donde ya hay mucho en pantalla). */
  compact?: boolean;
  footer?: ReactNode;
}) {
  const words = wordCount(hook.text_overlay);
  return (
    <div className={sk.card}>
      <div className={sk.row}>
        <span className={sk.key}>Las 3 capas</span>
        <div>
          <Layers verbal={hook.verbal} text={hook.text_overlay || null} visual={hook.first_second || null} measure={false} />
          <p className={sk.note} style={{ marginTop: 6 }}>
            {hook.text_overlay ? (
              <span className={sk.tag}>
                {words} palabras{hook.text_second != null ? ` · seg ${hook.text_second}` : ""}
              </span>
            ) : (
              <span className={sk.tag}>sin texto en pantalla</span>
            )}
            {!hook.verbal && <span className={sk.tag}>nadie habla</span>}
          </p>
        </div>
      </div>

      {hook.layers.length > 0 && (
        <div className={sk.row}>
          <span className={sk.key}>Dónde vive</span>
          <p className={sk.note}>{hook.layers.map((l) => HOOK_LAYER_LABELS[l]).join(" > ")}</p>
        </div>
      )}

      {(hook.camera || hook.silent_ok != null) && (
        <div className={sk.row}>
          <span className={sk.key}>Cámara y audio</span>
          <div>
            {hook.camera && (
              <p className={sk.note}>
                <span className={sk.tag}>{CAMERA_LABELS[hook.camera]}</span>
                {hook.camera_note}
              </p>
            )}
            {hook.silent_ok != null && (
              <p className={sk.note} style={{ marginTop: 4 }}>
                <span className={sk.tag}>{hook.silent_ok ? "Se entiende sin audio" : "No se entiende sin audio"}</span>
                {hook.silent_note}
              </p>
            )}
          </div>
        </div>
      )}

      {!compact && (
        <div className={sk.row}>
          <span className={sk.key}>
            Criterios <ScoreBadge checks={hook.checks} />
          </span>
          <div>
            {hook.hook_type && (
              <p className={sk.note} style={{ marginBottom: 6 }}>
                <span className={sk.tag}>{HOOK_TYPE_LABELS[hook.hook_type] ?? hook.hook_type}</span>
              </p>
            )}
            <Checklist checks={hook.checks} />
          </div>
        </div>
      )}

      {hook.lesson && (
        <div className={sk.row}>
          <span className={sk.key}>La jugada</span>
          <p className={sk.quote} style={{ fontStyle: "normal" }}>{hook.lesson}</p>
        </div>
      )}

      {footer && <p className={sk.footer}>{footer}</p>}
    </div>
  );
}
