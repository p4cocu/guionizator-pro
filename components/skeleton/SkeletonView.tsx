/**
 * El esqueleto de un post dibujado en tarjeta: gancho, primer problema, cómo
 * retiene, cómo cierra y las piezas. Lo comparten "Adaptar a mi marca"
 * (Competencia, migración `0021`) y "✦ Multiplicar" (Hechos, `0022`).
 *
 * `timed = false` cuando el esqueleto sale de un guion propio: no hay
 * transcripción con la que estimar el segundo y la etiqueta "seg —" solo
 * confundiría.
 */

import type { ReactNode } from "react";
import type { PostSkeleton } from "@/lib/competencia/skeleton";
import { HOOK_TYPE_LABELS } from "@/lib/competencia/taxonomy";
import s from "./SkeletonView.module.css";

export default function SkeletonView({
  skeleton,
  timed = true,
  footer,
}: {
  skeleton: PostSkeleton;
  timed?: boolean;
  footer?: ReactNode;
}) {
  const problemTag =
    !skeleton.first_problem.quote
      ? "no plantea"
      : !timed
        ? null
        : skeleton.first_problem.second != null
          ? `≈ seg ${skeleton.first_problem.second}`
          : skeleton.source === "caption"
            ? "sin audio"
            : "seg —";

  return (
    <div className={s.card}>
      <div className={s.row}>
        <span className={s.key}>Gancho</span>
        <div>
          {skeleton.hook.quote && <p className={s.quote}>“{skeleton.hook.quote}”</p>}
          <p className={s.note}>
            {skeleton.hook.hook_type && (
              <span className={s.tag}>{HOOK_TYPE_LABELS[skeleton.hook.hook_type] ?? skeleton.hook.hook_type}</span>
            )}
            {skeleton.hook.why}
          </p>
        </div>
      </div>

      <div className={s.row}>
        <span className={s.key}>Primer problema</span>
        <div>
          <p className={s.note}>
            {problemTag && <span className={s.tag}>{problemTag}</span>}
            {skeleton.first_problem.what}
          </p>
          {skeleton.first_problem.quote && <p className={s.quote}>“{skeleton.first_problem.quote}”</p>}
        </div>
      </div>

      {skeleton.retention.length > 0 && (
        <div className={s.row}>
          <span className={s.key}>Cómo retiene</span>
          <ul className={s.list}>
            {skeleton.retention.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={s.row}>
        <span className={s.key}>Cómo cierra</span>
        <div>
          {skeleton.closing.quote && <p className={s.quote}>“{skeleton.closing.quote}”</p>}
          {skeleton.closing.asks && <p className={s.note}>Pide: {skeleton.closing.asks}</p>}
        </div>
      </div>

      {skeleton.steps.length > 0 && (
        <div className={s.row}>
          <span className={s.key}>Esqueleto</span>
          <ol className={s.list}>
            {skeleton.steps.map((st, i) => (
              <li key={i}>{st}</li>
            ))}
          </ol>
        </div>
      )}

      {footer && <p className={s.footer}>{footer}</p>}
    </div>
  );
}
