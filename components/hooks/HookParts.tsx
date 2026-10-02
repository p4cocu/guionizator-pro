import { HOOK_CRITERIA, scoreChecks, type HookCheck } from "@/lib/hooks/criteria";
import styles from "./HookParts.module.css";

/**
 * Piezas visuales de un gancho de 3 capas (migración `0018`). Las comparten el
 * panel "Ganchos" de `/guiones/[id]` y el revisor de `/ganchos`.
 */

/** "6/7" con color según qué tan cerca está de pasar todo. */
export function ScoreBadge({ checks }: { checks: HookCheck[] }) {
  const { ok, total } = scoreChecks(checks);
  if (total === 0) return null;
  const tone = ok === total ? styles.scoreGood : ok >= total - 2 ? styles.scoreMid : styles.scoreBad;
  return (
    <span className={`${styles.score} ${tone}`}>
      {ok}/{total}
    </span>
  );
}

export function Checklist({ checks }: { checks: HookCheck[] }) {
  return (
    <ul className={styles.checklist}>
      {checks.map((c) => {
        const def = HOOK_CRITERIA.find((x) => x.id === c.id);
        return (
          <li key={c.id} className={styles.checkItem} title={def?.hint}>
            <span className={c.status === "ok" ? styles.checkOk : c.status === "falla" ? styles.checkFail : styles.checkNa}>
              {c.status === "ok" ? "✓" : c.status === "falla" ? "✕" : "–"}
            </span>
            <span>
              {def?.label}
              {c.note && <span className={styles.checkNote}> · {c.note}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Las 3 capas de un gancho (verbal siempre; texto y visual si existen). */
export function Layers({ verbal, text, visual }: { verbal: string; text?: string | null; visual?: string | null }) {
  return (
    <div className={styles.layers}>
      {text && (
        <p className={styles.layer}>
          <span className={styles.layerTag}>Pantalla</span>
          <strong>{text}</strong>
        </p>
      )}
      {visual && (
        <p className={styles.layer}>
          <span className={styles.layerTag}>Visual</span>
          {visual}
        </p>
      )}
      {verbal && (
        <p className={styles.layer}>
          <span className={styles.layerTag}>Dice</span>“{verbal}”
        </p>
      )}
    </div>
  );
}
