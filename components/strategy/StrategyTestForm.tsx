"use client";

/**
 * El test de estrategia (migración `0019`), compartido por el portal
 * (`/portal/[id]/estrategia`) y el estudio (`/estrategia`). Las preguntas
 * viven en `lib/strategy/test.ts`; este componente solo las dibuja y junta
 * las respuestas. Qué se hace con ellas lo decide quien lo monta (`onSubmit`).
 */

import { useState } from "react";
import { TEST_BLOCKS, TEST_TEXT_MAX, missingTestAnswers, type TestAnswers } from "@/lib/strategy/test";
import s from "./strategyTest.module.css";

export default function StrategyTestForm({
  initial,
  submitLabel,
  busyLabel,
  warning,
  onSubmit,
  onCancel,
}: {
  initial?: TestAnswers | null;
  submitLabel: string;
  busyLabel: string;
  /** Aviso arriba del botón (ej. "reemplaza la estrategia actual"). */
  warning?: string | null;
  /** Devuelve un mensaje de error, o `null` si salió bien. */
  onSubmit: (answers: TestAnswers) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [answers, setAnswers] = useState<TestAnswers>(initial ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);

  const missing = missingTestAnswers(answers);
  const missingKeys = new Set(missing.map((q) => q.key));
  const set = (key: string, value: string) => setAnswers((a) => ({ ...a, [key]: value }));

  async function submit() {
    if (missing.length > 0) {
      setShowMissing(true);
      setError(`Te ${missing.length === 1 ? "falta 1 respuesta" : `faltan ${missing.length} respuestas`} obligatoria${missing.length === 1 ? "" : "s"}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const err = await onSubmit(answers);
      if (err) setError(err);
    } catch {
      setError("No se pudo enviar el test. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.form}>
      {TEST_BLOCKS.map((block, bi) => (
        <section key={block.title} className={s.block}>
          <h3 className={s.blockTitle}>
            <span className={s.step}>{bi + 1}</span>
            {block.title}
          </h3>
          <p className={s.intro}>{block.intro}</p>

          {block.questions.map((q) => {
            const flagged = showMissing && missingKeys.has(q.key);
            if (q.kind === "text") {
              return (
                <label key={q.key} className={`${s.question} ${flagged ? s.flagged : ""}`}>
                  <span className={s.label}>
                    {q.label}
                    {!q.required && <span className={s.optional}> (opcional)</span>}
                  </span>
                  <span className={s.hint}>{q.hint}</span>
                  <textarea
                    className="textarea"
                    rows={3}
                    maxLength={TEST_TEXT_MAX}
                    value={answers[q.key] ?? ""}
                    onChange={(e) => set(q.key, e.target.value)}
                    disabled={busy}
                  />
                </label>
              );
            }
            return (
              <fieldset key={q.key} className={`${s.question} ${flagged ? s.flagged : ""}`}>
                <legend className={s.label}>{q.label}</legend>
                <div className={s.options}>
                  {q.options.map((o) => (
                    <label key={o.id} className={`${s.option} ${answers[q.key] === o.id ? s.optionOn : ""}`}>
                      <input
                        type="radio"
                        name={q.key}
                        value={o.id}
                        checked={answers[q.key] === o.id}
                        onChange={() => set(q.key, o.id)}
                        disabled={busy}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </section>
      ))}

      {warning && <p className={s.warning}>{warning}</p>}
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}

      <div className={s.actions}>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
