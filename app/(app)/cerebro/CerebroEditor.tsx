"use client";

import { useState, useTransition, useRef } from "react";
import { saveBrainVersion, restoreBrainVersion } from "./actions";
import styles from "./cerebro.module.css";

interface BrainVersion {
  id: string;
  version: number;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

interface CerebroEditorProps {
  initialContent: string;
  versions: BrainVersion[];
  isDefault: boolean;
}

export default function CerebroEditor({
  initialContent,
  versions,
  isDefault,
}: CerebroEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [label, setLabel] = useState("");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = content !== initialContent;
  const charCount = content.length;

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveBrainVersion(content, label.trim() || undefined);
        setLabel("");
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  function handleRestore(versionId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await restoreBrainVersion(versionId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al restaurar");
      }
    });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className={styles.layout}>
      {/* ── Editor principal ── */}
      <div className={styles.editorCol}>
        <div className={`card ${styles.editorCard}`}>
          <div className={styles.editorHeader}>
            <div>
              <span className="eyebrow">System Prompt</span>
              {isDefault && (
                <span className={styles.defaultBadge}>archivo base</span>
              )}
            </div>
            <span className={styles.charCount}>{charCount.toLocaleString()} chars</span>
          </div>

          <textarea
            ref={textareaRef}
            className={styles.editor}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            placeholder="El cerebro del guionista..."
          />

          <div className={styles.editorFooter}>
            <input
              className={`input ${styles.labelInput}`}
              placeholder="Etiqueta de versión (opcional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
            />
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isPending || !isDirty}
            >
              {isPending ? "Guardando…" : saved ? "¡Guardado!" : "Guardar versión"}
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>

      {/* ── Historial de versiones ── */}
      <div className={styles.historyCol}>
        <div className={`card ${styles.historyCard}`}>
          <span className="eyebrow">Historial</span>

          {versions.length === 0 ? (
            <p className={styles.emptyHistory}>
              Aún no hay versiones guardadas. El cerebro activo es el archivo base.
            </p>
          ) : (
            <ul className={styles.versionList}>
              {versions.map((v) => (
                <li
                  key={v.id}
                  className={`${styles.versionItem} ${v.is_active ? styles.versionActive : ""}`}
                >
                  <div className={styles.versionMeta}>
                    <span className={styles.versionNum}>v{v.version}</span>
                    {v.is_active && (
                      <span className={styles.activeBadge}>activa</span>
                    )}
                  </div>
                  <p className={styles.versionLabel}>
                    {v.label || <em>Sin etiqueta</em>}
                  </p>
                  <p className={styles.versionDate}>{formatDate(v.created_at)}</p>
                  {!v.is_active && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => handleRestore(v.id)}
                      disabled={isPending}
                    >
                      Restaurar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
