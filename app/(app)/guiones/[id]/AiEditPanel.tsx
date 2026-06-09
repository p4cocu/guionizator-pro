"use client";

import { useState } from "react";
import styles from "../guiones.module.css";

type Option = { label: string; text: string };
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

function deepReplaceString(obj: unknown, from: string, to: string): unknown {
  if (typeof obj === "string") return obj.includes(from) ? obj.replace(from, to) : obj;
  if (Array.isArray(obj)) return obj.map((item) => deepReplaceString(item, from, to));
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, deepReplaceString(v, from, to)])
    );
  }
  return obj;
}

export default function AiEditPanel({
  content,
  type,
  clientId,
  brief,
  onApply,
  onClose,
  saving,
}: Props) {
  const [fragment, setFragment] = useState("");
  const [instruction, setInstruction] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [options, setOptions] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!fragment.trim() || phase === "loading") return;
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
          fragment: fragment.trim(),
          instruction: instruction.trim() || undefined,
        }),
      });
      const text = await res.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Error del servidor (${res.status})`);
      }
      if (!res.ok) throw new Error((data.error as string) ?? "Error al generar");
      const opts: Option[] = (data.options as Option[]) ?? [];
      if (opts.length === 0) throw new Error("La IA no devolvió alternativas");
      setOptions(opts);
      setPhase("picking");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setPhase("idle");
    }
  }

  function handlePick(opt: Option) {
    const updated = deepReplaceString(content, fragment.trim(), opt.text) as Record<string, unknown>;
    onApply(updated);
    // reset for next edit
    setFragment("");
    setInstruction("");
    setOptions([]);
    setPhase("idle");
  }

  const busy = phase === "loading" || saving;

  return (
    <div className={styles.aiPanel}>
      <div className={styles.aiPanelHeader}>
        <span className={styles.aiPanelTitle}>✦ Editar con IA</span>
        <button onClick={onClose} className={styles.aiPanelClose} disabled={busy}>
          ✕
        </button>
      </div>

      {phase === "picking" ? (
        <div className={styles.aiPanelBody}>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            Elige la versión que prefieres:
          </p>
          <div className={styles.inlineAiOptionsList} style={{ marginTop: 4 }}>
            {options.map((opt, i) => (
              <button
                key={i}
                className={styles.inlineAiOption}
                onClick={() => handlePick(opt)}
                disabled={saving}
              >
                <div style={{ flex: 1, textAlign: "left" }}>
                  <span className={styles.inlineAiOptionLabel}>{opt.label}</span>
                  <p style={{ fontSize: 13, margin: "4px 0 0", color: "var(--text-muted)", lineHeight: 1.4 }}>
                    {opt.text}
                  </p>
                </div>
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
      ) : (
        <div className={styles.aiPanelBody}>
          <div>
            <label className="field-label">Fragmento a cambiar</label>
            <textarea
              className="textarea"
              value={fragment}
              onChange={(e) => setFragment(e.target.value)}
              placeholder="Pega aquí el texto exacto que quieres reemplazar"
              rows={3}
              disabled={busy}
            />
          </div>
          <div>
            <label className="field-label">Instrucción (opcional)</label>
            <textarea
              className="textarea"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Ej: más directo, con más urgencia, tono más conversacional…"
              rows={2}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
              }}
            />
          </div>
          {error && <p className={styles.aiPanelError}>{error}</p>}
        </div>
      )}

      {phase !== "picking" && (
        <div className={styles.aiPanelFooter}>
          <button onClick={onClose} className="btn btn-ghost" disabled={busy}>
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            className="btn btn-primary"
            disabled={busy || !fragment.trim()}
          >
            {phase === "loading" ? "Generando…" : saving ? "Guardando…" : "Generar 2 opciones →"}
          </button>
        </div>
      )}
    </div>
  );
}
