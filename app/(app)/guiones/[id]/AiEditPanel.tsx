"use client";

import { useState } from "react";
import styles from "../guiones.module.css";

type Option = { label: string; content: Record<string, unknown> };

type Phase = "idle" | "loading" | "picking";

type Props = {
  content: Record<string, unknown>;
  type: string;
  clientId: string;
  brief: string;
  onApply: (newContent: Record<string, unknown>) => void;
  onClose: () => void;
  saving: boolean;
};

export default function AiEditPanel({
  content,
  type,
  clientId,
  brief,
  onApply,
  onClose,
  saving,
}: Props) {
  const [instruction, setInstruction] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [options, setOptions] = useState<Option[]>([]);
  const [original] = useState(content);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    if (!instruction.trim() || phase === "loading") return;
    setError(null);
    setPhase("loading");
    try {
      const res = await fetch("/api/ai/inline-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          brief,
          type,
          content,
          instruction: instruction.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al editar");
      const opts: Option[] = data.options ?? [];
      if (opts.length === 1) {
        onApply(opts[0].content);
      } else {
        setOptions(opts);
        setPhase("picking");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setPhase("idle");
    }
  }

  const busy = phase === "loading" || saving;

  return (
    <div className={styles.aiPanel}>
      <div className={styles.aiPanelHeader}>
        <span className={styles.aiPanelTitle}>✦ Editar con IA</span>
        <button onClick={onClose} className={styles.aiPanelClose}>
          ✕
        </button>
      </div>

      {/* Picker de opciones */}
      {phase === "picking" && (
        <div className={styles.inlineAiOptions} style={{ borderBottom: "1px solid rgba(0,159,125,0.15)" }}>
          <p className={styles.inlineAiOptionsLabel}>Elige la versión que prefieres:</p>
          <div className={styles.inlineAiOptionsList}>
            {options.map((opt, i) => (
              <button
                key={i}
                className={styles.inlineAiOption}
                onClick={() => onApply(opt.content)}
              >
                <span className={styles.inlineAiOptionLabel}>{opt.label}</span>
                <span className={styles.inlineAiOptionArrow}>→</span>
              </button>
            ))}
            <button
              className={`${styles.inlineAiOption} ${styles.inlineAiOptionOriginal}`}
              onClick={() => { setPhase("idle"); setOptions([]); }}
            >
              <span className={styles.inlineAiOptionLabel}>Mantener original</span>
              <span className={styles.inlineAiOptionArrow}>✕</span>
            </button>
          </div>
        </div>
      )}

      <div className={styles.aiPanelBody}>
        <label className="field-label">¿Qué quieres cambiar?</label>
        <textarea
          className="textarea"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Ej: el hook + giro no convencen, dame 3 propuestas distintas · simplifica el cierre con 2 opciones"
          rows={3}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleApply();
          }}
        />
        {error && <p className={styles.aiPanelError}>{error}</p>}
      </div>

      <div className={styles.aiPanelFooter}>
        <button onClick={onClose} className="btn btn-ghost" disabled={busy}>
          Cancelar
        </button>
        <button
          onClick={handleApply}
          className="btn btn-primary"
          disabled={busy || !instruction.trim()}
        >
          {phase === "loading"
            ? "Generando…"
            : saving
            ? "Guardando versión…"
            : "Aplicar →"}
        </button>
      </div>
    </div>
  );
}
