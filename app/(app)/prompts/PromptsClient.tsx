"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PromptStyle } from "./actions";
import { savePromptStyle, deletePromptStyle } from "./actions";
import s from "./prompts.module.css";

// ── Estilos preset (built-in) ──────────────────────────────────────────────

const PRESET_STYLES = [
  {
    id: "realistic",
    name: "Realista",
    description: "Fotografía hiperrealista con física de lente, iluminación natural y texturas auténticas",
    base_style: "realistic",
    icon: "📸",
  },
  {
    id: "pixar",
    name: "Pixar 3D",
    description: "Render 3D estilo Pixar con subsurface scattering, iluminación global y proporciones expresivas",
    base_style: "pixar",
    icon: "🎬",
  },
  {
    id: "cinematic",
    name: "Cinemático",
    description: "Fotografía cinematográfica con dirección de arte, color grade y tokens de directores referentes",
    base_style: "cinematic",
    icon: "🎞",
  },
];

const EMPTY_FORM = {
  medium: "",
  subject: "",
  action: "",
  environment: "",
  style_vibe: "",
  technical_specs: "",
};

const EMPTY_STYLE_FORM = {
  name: "",
  description: "",
  base_style: "custom",
  style_tokens: "",
};

type Props = {
  customStyles: PromptStyle[];
};

export default function PromptsClient({ customStyles }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedStyleId, setSelectedStyleId] = useState("realistic");
  const [result, setResult] = useState<{ prompt_en: string; description_es: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [showNewStyleForm, setShowNewStyleForm] = useState(false);
  const [styleForm, setStyleForm] = useState(EMPTY_STYLE_FORM);
  const [isPending, startTransition] = useTransition();
  const [styleError, setStyleError] = useState<string | null>(null);

  function getSelectedStyle() {
    const preset = PRESET_STYLES.find((p) => p.id === selectedStyleId);
    if (preset) return { base_style: preset.base_style, style_tokens: undefined };
    const custom = customStyles.find((c) => c.id === selectedStyleId);
    if (custom) return { base_style: custom.base_style ?? "custom", style_tokens: custom.style_tokens ?? undefined };
    return { base_style: "realistic", style_tokens: undefined };
  }

  async function generate() {
    if (!form.subject.trim()) {
      setError("El campo 'Sujeto' es obligatorio.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { base_style, style_tokens } = getSelectedStyle();
      const res = await fetch("/api/ai/prompt-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, base_style, style_tokens }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error generando prompt");
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function copyPrompt() {
    if (!result) return;
    await navigator.clipboard.writeText(result.prompt_en);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSaveStyle(e: React.FormEvent) {
    e.preventDefault();
    if (!styleForm.name.trim()) { setStyleError("El nombre es obligatorio."); return; }
    setStyleError(null);
    startTransition(async () => {
      try {
        await savePromptStyle(styleForm);
        setStyleForm(EMPTY_STYLE_FORM);
        setShowNewStyleForm(false);
        router.refresh();
      } catch (err) {
        setStyleError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function handleDeleteStyle(id: string) {
    if (!confirm("¿Eliminar este estilo?")) return;
    startTransition(async () => {
      await deletePromptStyle(id);
      router.refresh();
    });
  }

  const selectedPreset = PRESET_STYLES.find((p) => p.id === selectedStyleId);
  const selectedCustom = customStyles.find((c) => c.id === selectedStyleId);

  return (
    <div className={s.page}>
      {/* ── Header ── */}
      <div className={s.header}>
        <p className="eyebrow">Fase 4</p>
        <h2 className={s.title}>Generador de prompts de imagen</h2>
        <p className={s.subtitle}>
          Crea prompts profesionales para Flux, Midjourney, GPT-Image y más.
          Estructura: [medium] · [subject] · [action/pose] · [environment] · [style/vibe] · [technical specs]
        </p>
      </div>

      <div className={s.layout}>
        {/* ── Columna izquierda: formulario ── */}
        <div className={s.formCol}>
          <div className={`card ${s.formCard}`}>
            <p className={s.formSectionTitle}>Selector de estilo</p>
            <div className={s.styleGrid}>
              {PRESET_STYLES.map((st) => (
                <button
                  key={st.id}
                  className={`${s.styleCard} ${selectedStyleId === st.id ? s.styleCardActive : ""}`}
                  onClick={() => setSelectedStyleId(st.id)}
                >
                  <span className={s.styleIcon}>{st.icon}</span>
                  <span className={s.styleName}>{st.name}</span>
                </button>
              ))}
              {customStyles.map((st) => (
                <button
                  key={st.id}
                  className={`${s.styleCard} ${s.styleCardCustom} ${selectedStyleId === st.id ? s.styleCardActive : ""}`}
                  onClick={() => setSelectedStyleId(st.id)}
                >
                  <span className={s.styleIcon}>✦</span>
                  <span className={s.styleName}>{st.name}</span>
                </button>
              ))}
            </div>

            {(selectedPreset || selectedCustom) && (
              <p className={s.styleDesc}>
                {selectedPreset?.description ?? selectedCustom?.description ?? ""}
              </p>
            )}
          </div>

          <div className={`card ${s.formCard}`}>
            <p className={s.formSectionTitle}>Parámetros del prompt</p>
            <div className={s.fields}>
              <div className="field">
                <label className="field-label">Medio / tipo de imagen</label>
                <input
                  className="input"
                  placeholder="ej. fotografía editorial, render 3D, ilustración digital"
                  value={form.medium}
                  onChange={(e) => setForm((p) => ({ ...p, medium: e.target.value }))}
                />
              </div>
              <div className="field">
                <label className="field-label">Sujeto *</label>
                <input
                  className="input"
                  placeholder="ej. mujer latina 30 años, producto cosmético, ciudad nocturna"
                  value={form.subject}
                  onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label">Acción / pose</label>
                <input
                  className="input"
                  placeholder="ej. caminando de frente, sosteniendo el producto, mirando a cámara"
                  value={form.action}
                  onChange={(e) => setForm((p) => ({ ...p, action: e.target.value }))}
                />
              </div>
              <div className="field">
                <label className="field-label">Entorno</label>
                <input
                  className="input"
                  placeholder="ej. café minimalista con luz natural, estudio neutro, ciudad al atardecer"
                  value={form.environment}
                  onChange={(e) => setForm((p) => ({ ...p, environment: e.target.value }))}
                />
              </div>
              <div className="field">
                <label className="field-label">Estilo / vibe adicional</label>
                <input
                  className="input"
                  placeholder="ej. editorial de lujo, lifestyle cálido, dark academia"
                  value={form.style_vibe}
                  onChange={(e) => setForm((p) => ({ ...p, style_vibe: e.target.value }))}
                />
              </div>
              <div className="field">
                <label className="field-label">Specs técnicos (opcional)</label>
                <input
                  className="input"
                  placeholder="ej. --ar 4:5, 85mm lens, f/1.8 bokeh, --v 6"
                  value={form.technical_specs}
                  onChange={(e) => setForm((p) => ({ ...p, technical_specs: e.target.value }))}
                />
              </div>
            </div>

            {error && <p className={s.formError}>{error}</p>}

            <button
              className={`btn btn-primary ${s.generateBtn}`}
              onClick={generate}
              disabled={loading}
            >
              {loading ? "Generando…" : "✦ Generar prompt"}
            </button>
          </div>
        </div>

        {/* ── Columna derecha: resultado ── */}
        <div className={s.resultCol}>
          {!result && !loading ? (
            <div className={`card ${s.resultEmpty}`}>
              <span className={s.resultEmptyIcon}>✦</span>
              <p className={s.resultEmptyText}>
                Llena el formulario, elige un estilo y genera tu prompt profesional.
              </p>
            </div>
          ) : loading ? (
            <div className={`card ${s.resultEmpty}`}>
              <div className={s.loadingSpinner} />
              <p className={s.resultEmptyText}>Generando prompt…</p>
            </div>
          ) : result ? (
            <div className={s.resultCard}>
              <div className={`card ${s.promptBox}`}>
                <div className={s.promptBoxHeader}>
                  <label className="field-label">Prompt (inglés)</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }} onClick={generate} disabled={loading}>
                      ↺ Regenerar
                    </button>
                    <button
                      className={`btn ${copied ? "btn-secondary" : "btn-ghost"}`}
                      style={{ fontSize: 12, padding: "6px 14px" }}
                      onClick={copyPrompt}
                    >
                      {copied ? "¡Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>
                <p className={s.promptText}>{result.prompt_en}</p>
              </div>

              <div className={`card ${s.descBox}`}>
                <label className="field-label" style={{ marginBottom: 8, display: "block" }}>
                  Descripción del resultado (español)
                </label>
                <p className={s.descText}>{result.description_es}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Sección mis estilos ── */}
      <div className={s.stylesSection}>
        <div className={s.stylesSectionHeader}>
          <div>
            <p className="eyebrow">Estilos personalizados</p>
            <h3 className={s.stylesSectionTitle}>Mis estilos</h3>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => setShowNewStyleForm((v) => !v)}
          >
            {showNewStyleForm ? "✕ Cancelar" : "+ Crear estilo"}
          </button>
        </div>

        {showNewStyleForm && (
          <form onSubmit={handleSaveStyle} className={`card ${s.newStyleForm}`}>
            <p className={s.formSectionTitle}>Nuevo estilo personalizado</p>
            <div className={s.styleFormGrid}>
              <div className="field">
                <label className="field-label">Nombre del estilo *</label>
                <input
                  className="input"
                  placeholder="ej. Anime moderno, Bauhaus editorial, UGC cálido"
                  value={styleForm.name}
                  onChange={(e) => setStyleForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label">Estilo base</label>
                <select
                  className="select"
                  value={styleForm.base_style}
                  onChange={(e) => setStyleForm((p) => ({ ...p, base_style: e.target.value }))}
                >
                  <option value="custom">Personalizado</option>
                  <option value="realistic">Basado en Realista</option>
                  <option value="pixar">Basado en Pixar 3D</option>
                  <option value="cinematic">Basado en Cinemático</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label className="field-label">Descripción del estilo</label>
              <input
                className="input"
                placeholder="ej. Estilo UGC con tonos cálidos y luz de ventana"
                value={styleForm.description}
                onChange={(e) => setStyleForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="field">
              <label className="field-label">Tokens y características del estilo</label>
              <textarea
                className="textarea"
                rows={4}
                placeholder="Describe cómo debe verse: iluminación, colores, técnica, referencias, tokens de prompt específicos…"
                value={styleForm.style_tokens}
                onChange={(e) => setStyleForm((p) => ({ ...p, style_tokens: e.target.value }))}
              />
            </div>
            {styleError && <p className={s.formError}>{styleError}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowNewStyleForm(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? "Guardando…" : "Guardar estilo"}
              </button>
            </div>
          </form>
        )}

        {customStyles.length === 0 && !showNewStyleForm ? (
          <div className={s.stylesEmpty}>
            <p>Aún no tienes estilos personalizados. Crea uno para guardar tu estética visual preferida.</p>
          </div>
        ) : (
          <div className={s.stylesGrid}>
            {customStyles.map((st) => (
              <div key={st.id} className={`card ${s.customStyleCard}`}>
                <div className={s.customStyleHeader}>
                  <span className={s.customStyleName}>✦ {st.name}</span>
                  <button
                    className={s.customStyleDelete}
                    onClick={() => handleDeleteStyle(st.id)}
                    title="Eliminar estilo"
                  >
                    ✕
                  </button>
                </div>
                {st.description && (
                  <p className={s.customStyleDesc}>{st.description}</p>
                )}
                {st.base_style && st.base_style !== "custom" && (
                  <span className={s.customStyleBase}>
                    Base: {st.base_style}
                  </span>
                )}
                <button
                  className={`btn btn-ghost ${s.useStyleBtn}`}
                  onClick={() => setSelectedStyleId(st.id)}
                >
                  {selectedStyleId === st.id ? "✓ Seleccionado" : "Usar este estilo"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
