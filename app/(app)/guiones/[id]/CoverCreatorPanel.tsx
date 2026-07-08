"use client";

import { useState, useTransition } from "react";
import { saveScriptCovers, type ScriptCoverIdea } from "../actions";
import styles from "../guiones.module.css";

type Props = {
  scriptId: string;
  scriptBrief: string;
  scriptContent: Record<string, unknown>;
  scriptType: string;
  structureName: string;
  initialCovers: ScriptCoverIdea[] | null;
};

export default function CoverCreatorPanel({
  scriptId,
  scriptBrief,
  scriptContent,
  scriptType,
  structureName,
  initialCovers,
}: Props) {
  const [covers, setCovers] = useState<ScriptCoverIdea[] | null>(initialCovers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/ai/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script_type: scriptType,
          brief: scriptBrief,
          structure_name: structureName,
          content: scriptContent,
        }),
      });

      // Si el middleware de auth nos rebotó a /login, fetch sigue la
      // redirección y devuelve el HTML de login. Lo detectamos antes de
      // intentar parsear JSON para dar un mensaje claro.
      if (res.redirected || !res.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Tu sesión expiró o el sitio se está actualizando. Recarga la página (Cmd+Shift+R) e intenta de nuevo.");
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error generando portadas");
      }
      const data = await res.json();
      const newCovers = data.covers as ScriptCoverIdea[];
      setCovers(newCovers);

      // Autoguardar de inmediato para que nunca se pierdan.
      startSaveTransition(async () => {
        try {
          await saveScriptCovers(scriptId, newCovers);
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error al guardar las portadas");
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string, idx: number) {
    await navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className={styles.copyPanel}>
      <div className={styles.copyPanelHeader}>
        <p className={styles.copyPanelTitle}>
          <span>🎨</span> Creador de Portadas
        </p>
        {covers && (
          <button className="btn btn-ghost" onClick={generate} disabled={loading}>
            {loading ? "Generando…" : "↺ Regenerar"}
          </button>
        )}
      </div>

      <div className={styles.copyPanelBody}>
        {!covers ? (
          <div className={styles.copyEmpty}>
            <p>Genera 3 conceptos de portada de alto CTR relacionados con este contenido.</p>
            <button className="btn btn-primary" onClick={generate} disabled={loading}>
              {loading ? "Generando…" : "✦ Generar 3 portadas"}
            </button>
          </div>
        ) : (
          <div className={styles.coverGrid}>
            {covers.map((c, i) => (
              <div key={i} className={styles.coverCard}>
                <div className={styles.coverCardHeader}>
                  <span className={styles.coverCardNum}>Portada {i + 1}</span>
                  {c.has_character && (
                    <span className={styles.coverBadge}>👤 Con personaje</span>
                  )}
                </div>

                <p className={styles.coverText}>&ldquo;{c.cover_text}&rdquo;</p>

                <div className={styles.promptBox}>
                  <p className={styles.promptEn}>{c.prompt_en}</p>
                  <div className={styles.promptActions}>
                    <button
                      className={`btn btn-ghost ${styles.copySmallBtn}`}
                      onClick={() => copyToClipboard(c.prompt_en, i)}
                    >
                      {copied === i ? "¡Copiado!" : "Copiar prompt"}
                    </button>
                  </div>
                </div>

                <p className={styles.promptDesc}>{c.rationale_es}</p>
              </div>
            ))}
          </div>
        )}

        {error && <p className={styles.copyError} style={{ marginTop: 8 }}>{error}</p>}

        {covers && (
          <div className={styles.copySaveRow}>
            {isSaving && <span className={styles.copyError} style={{ color: "var(--text-muted)" }}>Guardando…</span>}
            {saved && <span className={styles.copySaved}>✓ Portadas guardadas</span>}
          </div>
        )}
      </div>
    </div>
  );
}
