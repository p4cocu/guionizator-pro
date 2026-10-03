import { HOOK_CRITERIA, HOOK_CRITERIA_PLAIN, scoreChecks, wordCount, type HookCheck } from "@/lib/hooks/criteria";
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

/** `plain`: etiquetas sin jerga para el portal (`HOOK_CRITERIA_PLAIN`). */
export function Checklist({ checks, plain = false }: { checks: HookCheck[]; plain?: boolean }) {
  return (
    <ul className={styles.checklist}>
      {checks.map((c) => {
        const def = HOOK_CRITERIA.find((x) => x.id === c.id);
        return (
          <li key={c.id} className={styles.checkItem} title={plain ? undefined : def?.hint}>
            <span className={c.status === "ok" ? styles.checkOk : c.status === "falla" ? styles.checkFail : styles.checkNa}>
              {c.status === "ok" ? "✓" : c.status === "falla" ? "✕" : "–"}
            </span>
            <span>
              {plain ? HOOK_CRITERIA_PLAIN[c.id] : def?.label}
              {c.note && <span className={styles.checkNote}> · {c.note}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Las 3 capas de un gancho (verbal siempre; texto y visual si existen). */
/**
 * El modelo cuenta mal las palabras (probado 2026-10-02: ~1 de cada 3 textos
 * en pantalla del generador de ideas salía con 5-7 pese a la regla), así que
 * el largo se mide acá y se avisa en vez de confiar en lo que dice la IA.
 */
function TextLengthWarning({ text }: { text: string }) {
  const words = wordCount(text);
  if (words >= 8 && words <= 12) return null;
  return (
    <span className={styles.lengthWarn} title="El texto en pantalla funciona mejor con 8 a 12 palabras">
      {words} palabras · {words < 8 ? "alárgalo" : "recórtalo"}
    </span>
  );
}

export function Layers({
  verbal,
  text,
  visual,
  measure = true,
  plain = false,
}: {
  verbal: string;
  text?: string | null;
  visual?: string | null;
  /** false para ganchos ajenos (Competencia): "alárgalo" no aplica. */
  measure?: boolean;
  /** Portal: "Se lee / Se ve / Dices" en vez de las etiquetas del taller. */
  plain?: boolean;
}) {
  const tags = plain ? { text: "Se lee", visual: "Se ve", verbal: "Dices" } : { text: "Pantalla", visual: "Visual", verbal: "Dice" };
  return (
    <div className={styles.layers}>
      {text && (
        <p className={styles.layer}>
          <span className={styles.layerTag}>{tags.text}</span>
          <strong>{text}</strong>
          {measure && <TextLengthWarning text={text} />}
        </p>
      )}
      {visual && (
        <p className={styles.layer}>
          <span className={styles.layerTag}>{tags.visual}</span>
          {visual}
        </p>
      )}
      {verbal && (
        <p className={styles.layer}>
          <span className={styles.layerTag}>{tags.verbal}</span>“{verbal}”
        </p>
      )}
    </div>
  );
}
