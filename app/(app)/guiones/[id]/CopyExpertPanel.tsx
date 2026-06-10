"use client";

import { useState, useTransition } from "react";
import { saveScriptCopy, type ScriptCopy } from "../actions";
import styles from "../guiones.module.css";

type Props = {
  scriptId: string;
  scriptContent: Record<string, unknown>;
  scriptType: string;
  initialCopies: ScriptCopy[];
};

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "youtube", label: "YouTube", disabled: true },
];

export default function CopyExpertPanel({
  scriptId,
  scriptContent,
  scriptType,
  initialCopies,
}: Props) {
  const [activePlatform, setActivePlatform] = useState("instagram");
  const [copies, setCopies] = useState<Record<string, { copy: string; hashtags: string }>>(() => {
    const map: Record<string, { copy: string; hashtags: string }> = {};
    for (const c of initialCopies) {
      map[c.platform] = { copy: c.copy_text, hashtags: c.hashtags ?? "" };
    }
    return map;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [savedPlatform, setSavedPlatform] = useState<string | null>(null);

  const current = copies[activePlatform];

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script_content: scriptContent,
          script_type: scriptType,
          platform: activePlatform,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error generando copy");
      }
      const data = await res.json();
      setCopies((prev) => ({
        ...prev,
        [activePlatform]: { copy: data.copy, hashtags: data.hashtags },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleSave() {
    if (!current) return;
    setSavedPlatform(null);
    startTransition(async () => {
      try {
        await saveScriptCopy(scriptId, activePlatform, current.copy, current.hashtags);
        setSavedPlatform(activePlatform);
        setTimeout(() => setSavedPlatform(null), 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <div className={styles.copyPanel}>
      <div className={styles.copyPanelHeader}>
        <p className={styles.copyPanelTitle}>
          <span>✍</span> Copy Expert
        </p>
        <div className={styles.copyTabs}>
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              className={`${styles.copyTab} ${activePlatform === p.id ? styles.copyTabActive : ""} ${p.disabled ? styles.copyTabDisabled : ""}`}
              onClick={() => !p.disabled && setActivePlatform(p.id)}
              disabled={p.disabled}
              title={p.disabled ? "Próximamente" : undefined}
            >
              {p.label}
              {p.disabled && <span className={styles.copyTabSoon}>Pronto</span>}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.copyPanelBody}>
        {!current ? (
          <div className={styles.copyEmpty}>
            <p>Genera el copy para {PLATFORMS.find((p) => p.id === activePlatform)?.label} con IA.</p>
            <button
              className="btn btn-primary"
              onClick={generate}
              disabled={loading}
            >
              {loading ? "Generando…" : "✦ Generar copy"}
            </button>
          </div>
        ) : (
          <div className={styles.copyResult}>
            <div className={styles.copySection}>
              <div className={styles.copySectionHeader}>
                <label className="field-label">Copy</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className={`btn btn-ghost ${styles.copySmallBtn}`}
                    onClick={() => copyToClipboard(current.copy, "copy")}
                  >
                    {copied === "copy" ? "¡Copiado!" : "Copiar"}
                  </button>
                  <button
                    className={`btn btn-ghost ${styles.copySmallBtn}`}
                    onClick={generate}
                    disabled={loading}
                  >
                    {loading ? "…" : "↺ Regenerar"}
                  </button>
                </div>
              </div>
              <div className={styles.copyText}>{current.copy}</div>
            </div>

            {current.hashtags && (
              <div className={styles.copySection}>
                <div className={styles.copySectionHeader}>
                  <label className="field-label">Hashtags</label>
                  <button
                    className={`btn btn-ghost ${styles.copySmallBtn}`}
                    onClick={() => copyToClipboard(current.hashtags, "hashtags")}
                  >
                    {copied === "hashtags" ? "¡Copiado!" : "Copiar"}
                  </button>
                </div>
                <div className={styles.copyHashtags}>{current.hashtags}</div>
              </div>
            )}

            <div className={styles.copySaveRow}>
              {error && <span className={styles.copyError}>{error}</span>}
              {savedPlatform && (
                <span className={styles.copySaved}>
                  ✓ Copy guardado para {savedPlatform}
                </span>
              )}
              <button
                className="btn btn-secondary"
                onClick={handleSave}
                disabled={isPending}
              >
                {isPending ? "Guardando…" : "Guardar copy"}
              </button>
            </div>
          </div>
        )}

        {error && !current && (
          <p className={styles.copyError} style={{ marginTop: 8 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
