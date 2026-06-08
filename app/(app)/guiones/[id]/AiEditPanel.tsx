"use client";

import { useState } from "react";
import styles from "../guiones.module.css";

type Props = {
  content: Record<string, unknown>;
  type: string;
  onApply: (newContent: Record<string, unknown>) => void;
  onClose: () => void;
  saving: boolean;
};

export default function AiEditPanel({
  content,
  type,
  onApply,
  onClose,
  saving,
}: Props) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    if (!instruction.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_script",
          content,
          instruction,
          type,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al editar");
      onApply(data.content as Record<string, unknown>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || saving;

  return (
    <div className={styles.aiPanel}>
      <div className={styles.aiPanelHeader}>
        <span className={styles.aiPanelTitle}>✦ Editar con IA</span>
        <button onClick={onClose} className={styles.aiPanelClose}>
          ✕
        </button>
      </div>

      <div className={styles.aiPanelBody}>
        <label className="field-label">¿Qué quieres cambiar?</label>
        <textarea
          className="textarea"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Ej: El hook es demasiado genérico. Hazlo más específico para coaches de vida que trabajan con mujeres de 35–50 años."
          rows={4}
          disabled={busy}
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
          {loading
            ? "Editando…"
            : saving
            ? "Guardando versión…"
            : "Aplicar cambio →"}
        </button>
      </div>
    </div>
  );
}
