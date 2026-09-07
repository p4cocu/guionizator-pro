"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveScriptCopy, type ScriptCopy } from "../actions";
import { COPY_PLATFORMS, copyPlatformLabel, isCopyPlatform } from "@/lib/ai/copyPrompt";
import styles from "../guiones.module.css";

/**
 * Copy Expert — dos versiones por plataforma desde la migración `0014`:
 * una corta (la que se lee sin abrir el "…más") y una desarrollada.
 *
 * Ver la nota de `CoverCreatorPanel`: el contenido lo lee la ruta (etapa 8), acá
 * solo viaja el `script_id`.
 */
type Props = {
  scriptId: string;
  initialCopies: ScriptCopy[];
  /** Llega en `?autogen=1` desde el registro de una publicación externa. */
  autoGenerate?: boolean;
  /** La plataforma elegida en ese formulario (`?platform=`). */
  initialPlatform?: string;
};

type CopyPair = { short: string; long: string; hashtags: string };

export default function CopyExpertPanel({
  scriptId,
  initialCopies,
  autoGenerate = false,
  initialPlatform,
}: Props) {
  const [activePlatform, setActivePlatform] = useState<string>(
    initialPlatform && isCopyPlatform(initialPlatform) ? initialPlatform : "instagram",
  );
  const [copies, setCopies] = useState<Record<string, CopyPair>>(() => {
    const map: Record<string, CopyPair> = {};
    for (const c of initialCopies) {
      map[c.platform] = {
        long: c.copy_text,
        // Las filas anteriores a `0014` no tienen versión corta: se muestra
        // solo la larga en vez de inventar una.
        short: c.copy_short ?? "",
        hashtags: c.hashtags ?? "",
      };
    }
    return map;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [usedReference, setUsedReference] = useState(false);
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
        // Solo el id + la plataforma: el contenido lo lee la ruta (etapa 8).
        body: JSON.stringify({ script_id: scriptId, platform: activePlatform }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error generando copy");
      }
      const data = await res.json();
      setUsedReference(data.used_reference === true);
      setCopies((prev) => ({
        ...prev,
        [activePlatform]: {
          short: data.copy_short ?? "",
          long: data.copy_long ?? data.copy ?? "",
          hashtags: data.hashtags ?? "",
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  // Autogeneración al llegar desde el formulario de publicación externa. El ref
  // es lo que evita que el StrictMode de dev dispare DOS llamadas a Claude.
  const autoFired = useRef(false);
  useEffect(() => {
    if (!autoGenerate || autoFired.current || current) return;
    autoFired.current = true;
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate]);

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
        await saveScriptCopy(scriptId, activePlatform, current.long, current.short, current.hashtags);
        setSavedPlatform(activePlatform);
        setTimeout(() => setSavedPlatform(null), 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  function renderVersion(label: string, hint: string, text: string, key: string) {
    if (!text) return null;
    return (
      <div className={styles.copySection}>
        <div className={styles.copySectionHeader}>
          <label className="field-label">
            {label} <span className={styles.copyVersionHint}>{hint}</span>
          </label>
          <button
            className={`btn btn-ghost ${styles.copySmallBtn}`}
            onClick={() => copyToClipboard(text, key)}
          >
            {copied === key ? "¡Copiado!" : "Copiar"}
          </button>
        </div>
        <div className={styles.copyText}>{text}</div>
      </div>
    );
  }

  return (
    <div className={styles.copyPanel}>
      <div className={styles.copyPanelHeader}>
        <p className={styles.copyPanelTitle}>
          <span>✍</span> Copy Expert
        </p>
        <div className={styles.copyTabs}>
          {COPY_PLATFORMS.map((p) => (
            <button
              key={p.id}
              className={`${styles.copyTab} ${activePlatform === p.id ? styles.copyTabActive : ""} ${p.soon ? styles.copyTabDisabled : ""}`}
              onClick={() => !p.soon && setActivePlatform(p.id)}
              disabled={p.soon}
              title={p.soon ? "Próximamente" : undefined}
            >
              {p.label}
              {p.soon && <span className={styles.copyTabSoon}>Pronto</span>}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.copyPanelBody}>
        {!current ? (
          <div className={styles.copyEmpty}>
            <p>Genera el copy para {copyPlatformLabel(activePlatform)} con IA.</p>
            <button className="btn btn-primary" onClick={generate} disabled={loading}>
              {loading ? "Generando…" : "✦ Generar copy"}
            </button>
          </div>
        ) : (
          <div className={styles.copyResult}>
            <div className={styles.copySectionHeader} style={{ marginBottom: 4 }}>
              <span className={styles.copyVersionHint}>
                {usedReference
                  ? "Generado con el contexto de la marca y la referencia de competencia"
                  : "Generado con el contexto de la marca"}
              </span>
              <button
                className={`btn btn-ghost ${styles.copySmallBtn}`}
                onClick={generate}
                disabled={loading}
              >
                {loading ? "…" : "↺ Regenerar"}
              </button>
            </div>

            {renderVersion("Copy corto", "directo, sin abrir el “…más”", current.short, "short")}
            {renderVersion("Copy detallado", "para desarrollar la idea", current.long, "long")}

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
                  ✓ Copy guardado para {copyPlatformLabel(savedPlatform)}
                </span>
              )}
              <button className="btn btn-secondary" onClick={handleSave} disabled={isPending}>
                {isPending ? "Guardando…" : "Guardar copy"}
              </button>
            </div>
          </div>
        )}

        {error && !current && (
          <p className={styles.copyError} style={{ marginTop: 8 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
