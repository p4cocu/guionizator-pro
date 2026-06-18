"use client";

import { useState } from "react";
import Link from "next/link";
import type { PromptStyle } from "../actions";
import s from "../prompts.module.css";

const PRESET_STYLES = [
  {
    id: "realistic",
    name: "Hiperrealista",
    description: "Fotografía hiperrealista con física de lente, iluminación natural y texturas auténticas",
    base_style: "realistic",
    style_tokens: null as string | null,
    icon: "📸",
  },
  {
    id: "pixar",
    name: "Pixar 3D",
    description: "Render 3D estilo Pixar con subsurface scattering, iluminación global y proporciones expresivas",
    base_style: "pixar",
    style_tokens: null as string | null,
    icon: "🎬",
  },
  {
    id: "cinematic",
    name: "Cinemático",
    description: "Fotografía cinematográfica con dirección de arte, color grade y tokens de directores referentes",
    base_style: "cinematic",
    style_tokens: null as string | null,
    icon: "🎞",
  },
];

type Result = { prompt_en: string; description_es: string };

export default function LibreClient({ customStyles }: { customStyles: PromptStyle[] }) {
  const allStyles = [
    ...PRESET_STYLES.map((st) => ({ ...st, isCustom: false })),
    ...customStyles.map((cs) => ({
      id: cs.id,
      name: cs.name,
      description: cs.description ?? "",
      base_style: cs.base_style ?? "custom",
      style_tokens: cs.style_tokens,
      icon: "✦",
      isCustom: true,
    })),
  ];

  const [selectedStyleId, setSelectedStyleId] = useState("realistic");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedStyle = allStyles.find((st) => st.id === selectedStyleId) ?? allStyles[0];

  async function handleGenerate() {
    if (!context.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/prompt-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medium: "",
          subject: context.trim(),
          action: "",
          environment: "",
          style_vibe: "",
          technical_specs: "9:16 vertical, Instagram",
          base_style: selectedStyle.base_style,
          style_tokens: selectedStyle.style_tokens ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error generando prompt");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.prompt_en);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={s.page}>
      {/* ── Header ── */}
      <div className={s.headerRow}>
        <div className={s.header}>
          <p className="eyebrow">Prompting</p>
          <h2 className={s.title}>Generación libre de prompts</h2>
          <p className={s.subtitle}>
            Describí lo que querés visualizar y elegí un estilo. Sin preguntas — el prompt aparece directo.
          </p>
        </div>
        <Link href="/prompts" className="btn btn-ghost" style={{ flexShrink: 0, marginTop: 8 }}>
          ← Desde guion
        </Link>
      </div>

      {/* ── Style selector ── */}
      <div className={`card ${s.formCard}`}>
        <p className={s.formSectionTitle}>Estilo visual</p>
        <div className={s.styleGrid}>
          {allStyles.map((st) => (
            <button
              key={st.id}
              className={`${s.styleCard} ${st.isCustom ? s.styleCardCustom : ""} ${selectedStyleId === st.id ? s.styleCardActive : ""}`}
              onClick={() => setSelectedStyleId(st.id)}
            >
              <span className={s.styleIcon}>{st.icon}</span>
              <span className={s.styleName}>{st.name}</span>
            </button>
          ))}
        </div>
        {selectedStyle.description && (
          <p className={s.styleDesc}>{selectedStyle.description}</p>
        )}
      </div>

      {/* ── Context input ── */}
      <div className={`card ${s.formCard}`}>
        <p className={s.formSectionTitle}>Contexto</p>
        <div className="field">
          <label className="field-label">Describí lo que querés visualizar</label>
          <textarea
            className="textarea"
            rows={5}
            placeholder="Personaje, escenario, acción, ambiente, mood… Todo el contexto que puedas dar, mejor."
            value={context}
            onChange={(e) => setContext(e.target.value)}
            disabled={loading}
          />
        </div>
        {error && <p className={s.formError}>{error}</p>}
        <button
          className="btn btn-primary"
          style={{ alignSelf: "flex-start", padding: "12px 28px" }}
          onClick={handleGenerate}
          disabled={loading || !context.trim()}
        >
          {loading ? "Generando…" : result ? "↺ Regenerar" : "✦ Generar prompt"}
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className={`card ${s.resultEmpty}`}>
          <div className={s.loadingSpinner} />
          <p className={s.resultEmptyText}>Generando tu prompt…</p>
        </div>
      )}

      {/* ── Result ── */}
      {result && !loading && (
        <div className={`card ${s.formCard}`}>
          <p className={s.formSectionTitle}>Prompt generado</p>
          <p className={s.promptText}>{result.prompt_en}</p>
          <div className={s.libreActions}>
            <button
              className={`btn btn-primary ${copied ? s.copiedBtn : ""}`}
              style={{ padding: "10px 20px" }}
              onClick={handleCopy}
            >
              {copied ? "¡Copiado!" : "Copiar prompt"}
            </button>
            <button
              className="btn btn-ghost"
              style={{ padding: "10px 20px" }}
              onClick={handleGenerate}
              disabled={loading}
            >
              ↺ Regenerar
            </button>
          </div>
          <p className={s.descText}>{result.description_es}</p>
        </div>
      )}
    </div>
  );
}
