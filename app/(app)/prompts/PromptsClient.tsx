"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PromptStyle, RecentReel, SceneIdea, GeneratedPrompt, SavedScriptPrompts } from "./actions";
import { savePromptStyle, deletePromptStyle, getScriptPrompts, saveScriptPrompts } from "./actions";
import s from "./prompts.module.css";

// ── Preset styles ──────────────────────────────────────────────────────────────

const PRESET_STYLES = [
  {
    id: "realistic",
    name: "Hiperrealista",
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

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  customStyles: PromptStyle[];
  recentReels: RecentReel[];
  preloadedScript: RecentReel | null;
  preloadedPrompts: SavedScriptPrompts | null;
};

const EMPTY_STYLE_FORM = {
  name: "",
  description: "",
  base_style: "custom",
  style_tokens: "",
};

export default function PromptsClient({ customStyles, recentReels, preloadedScript, preloadedPrompts }: Props) {
  const router = useRouter();

  // ── Style selection ─────────────────────────────────────────────────────────
  const [selectedStyleId, setSelectedStyleId] = useState(preloadedPrompts?.style_id ?? "realistic");

  // ── Script selection ────────────────────────────────────────────────────────
  const [selectedScript, setSelectedScript] = useState<RecentReel | null>(preloadedScript);

  // ── Scene ideas ─────────────────────────────────────────────────────────────
  const [scenes, setScenes] = useState<SceneIdea[]>(preloadedPrompts?.scenes ?? []);
  const [loadingScenes, setLoadingScenes] = useState(false);
  const [scenesError, setScenesError] = useState<string | null>(null);
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  // ── Prompts ──────────────────────────────────────────────────────────────────
  const [prompts, setPrompts] = useState<GeneratedPrompt[]>(preloadedPrompts?.prompts ?? []);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [promptsError, setPromptsError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(preloadedPrompts?.updated_at ?? null);

  // ── Custom styles ────────────────────────────────────────────────────────────
  const [showNewStyleForm, setShowNewStyleForm] = useState(false);
  const [styleForm, setStyleForm] = useState(EMPTY_STYLE_FORM);
  const [isPending, startTransition] = useTransition();
  const [styleError, setStyleError] = useState<string | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getVoiceOff(script: RecentReel): string {
    const c = script.content as Record<string, unknown>;
    return (c.voice_off as string) ?? "";
  }

  function getSelectedStyleInfo() {
    const preset = PRESET_STYLES.find((p) => p.id === selectedStyleId);
    if (preset) return { base_style: preset.base_style, style_tokens: undefined, name: preset.name };
    const custom = customStyles.find((c) => c.id === selectedStyleId);
    if (custom) return { base_style: custom.base_style ?? "custom", style_tokens: custom.style_tokens ?? undefined, name: custom.name };
    return { base_style: "realistic", style_tokens: undefined, name: "Hiperrealista" };
  }

  async function persistPrompts(script: RecentReel, newScenes: SceneIdea[], newPrompts: GeneratedPrompt[]) {
    try {
      const styleInfo = getSelectedStyleInfo();
      await saveScriptPrompts({
        script_id: script.id,
        style_id: selectedStyleId,
        style_name: styleInfo.name,
        scenes: newScenes,
        prompts: newPrompts,
      });
      setSavedAt(new Date().toISOString());
    } catch {
      // silently fail — UI state is still correct
    }
  }

  async function handleSelectScript(reel: RecentReel) {
    setSelectedScript(reel);
    setScenes([]);
    setPrompts([]);
    setScenesError(null);
    setSavedAt(null);
    try {
      const saved = await getScriptPrompts(reel.id);
      if (saved) {
        setScenes(saved.scenes);
        setPrompts(saved.prompts);
        setSelectedStyleId(saved.style_id);
        setSavedAt(saved.updated_at);
      }
    } catch {
      // no saved state — that's fine
    }
  }

  // ── Scene analysis ────────────────────────────────────────────────────────────

  async function handleAnalyzeScript() {
    if (!selectedScript) return;
    setLoadingScenes(true);
    setScenesError(null);
    setScenes([]);
    setPrompts([]);

    try {
      const res = await fetch("/api/ai/scene-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_off: getVoiceOff(selectedScript),
          script_title: selectedScript.structure_name,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error analizando el guion");
      }
      const data = await res.json();
      const newScenes: SceneIdea[] = data.scenes ?? [];
      setScenes(newScenes);
      await persistPrompts(selectedScript, newScenes, []);
    } catch (err) {
      setScenesError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoadingScenes(false);
    }
  }

  async function handleRegenerateScene(idx: number) {
    setRegeneratingIdx(idx);
    try {
      const res = await fetch("/api/ai/scene-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_off: getVoiceOff(selectedScript!),
          regenerate_index: idx,
          existing_scenes: scenes,
        }),
      });
      if (!res.ok) throw new Error("Error regenerando");
      const data = await res.json();
      setScenes((prev) =>
        prev.map((sc, i) =>
          i === idx
            ? { ...sc, scene_idea: data.scene_idea, scene_description: data.scene_description }
            : sc,
        ),
      );
    } catch {
      // silently fail — scene stays as is
    } finally {
      setRegeneratingIdx(null);
    }
  }

  function handleDeleteScene(idx: number) {
    setScenes((prev) => prev.filter((_, i) => i !== idx));
  }

  function startEditing(idx: number) {
    setEditingIdx(idx);
    setEditDraft(scenes[idx].scene_description);
  }

  function saveEdit(idx: number) {
    setScenes((prev) =>
      prev.map((sc, i) => (i === idx ? { ...sc, scene_description: editDraft } : sc)),
    );
    setEditingIdx(null);
  }

  // ── Prompt generation ─────────────────────────────────────────────────────────

  async function handleGenerateAllPrompts() {
    if (scenes.length === 0) return;
    setLoadingPrompts(true);
    setPromptsError(null);
    setPrompts([]);

    const { base_style, style_tokens } = getSelectedStyleInfo();

    try {
      const results: GeneratedPrompt[] = [];
      for (const scene of scenes) {
        const res = await fetch("/api/ai/prompt-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            medium: "",
            subject: scene.scene_idea,
            action: "",
            environment: "",
            style_vibe: scene.scene_description,
            technical_specs: "--ar 9:16",
            base_style,
            style_tokens,
          }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        results.push({
          voice_segment: scene.voice_segment,
          scene_idea: scene.scene_idea,
          prompt_en: data.prompt_en,
          description_es: data.description_es,
        });
      }
      setPrompts(results);
      if (selectedScript) {
        await persistPrompts(selectedScript, scenes, results);
      }
    } catch (err) {
      setPromptsError(err instanceof Error ? err.message : "Error generando prompts");
    } finally {
      setLoadingPrompts(false);
    }
  }

  async function copyPrompt(idx: number) {
    await navigator.clipboard.writeText(prompts[idx].prompt_en);
    setPrompts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, copied: true } : p)),
    );
    setTimeout(() => {
      setPrompts((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, copied: false } : p)),
      );
    }, 2000);
  }

  async function copyAllPrompts() {
    const text = prompts.map((p, i) => `Escena ${i + 1} — ${p.scene_idea}\n${p.prompt_en}`).join("\n\n---\n\n");
    await navigator.clipboard.writeText(text);
  }

  // ── Custom style handlers ─────────────────────────────────────────────────────

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
  const hasScenes = scenes.length > 0;
  const hasPrompts = prompts.length > 0;

  return (
    <div className={s.page}>
      {/* ── Header ── */}
      <div className={s.headerRow}>
        <div className={s.header}>
          <p className="eyebrow">Prompting</p>
          <h2 className={s.title}>Generador de prompts de imagen</h2>
          <p className={s.subtitle}>
            Selecciona uno de tus guiones recientes, analiza las escenas y genera prompts profesionales para Flux, Midjourney o GPT-Image.
          </p>
        </div>
        <Link href="/prompts/libre" className="btn btn-ghost" style={{ flexShrink: 0, marginTop: 8 }}>
          → Generación libre
        </Link>
      </div>

      {/* ── Style selector (top, compact) ── */}
      <div className={`card ${s.formCard}`} style={{ padding: "20px 24px" }}>
        <p className={s.formSectionTitle}>Estilo visual</p>
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

      {/* ── Script selector ── */}
      <div className={s.scriptSection}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p className={s.sectionLabel} style={{ margin: 0 }}>Selecciona un guion (Reel)</p>
          {savedAt && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              ✓ Guardado · {new Date(savedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        {recentReels.length === 0 ? (
          <div className={s.emptyReels}>
            <span>No tienes guiones de reel generados aún.</span>
          </div>
        ) : (
          <div className={s.reelGrid}>
            {recentReels.map((reel) => (
              <button
                key={reel.id}
                className={`card ${s.reelCard} ${selectedScript?.id === reel.id ? s.reelCardActive : ""}`}
                onClick={() => handleSelectScript(reel)}
              >
                <div className={s.reelCardTop}>
                  <span className={s.reelBadge}>Reel</span>
                  <span className={s.reelClient}>
                    {reel.clients?.marca ?? reel.clients?.nombre ?? ""}
                  </span>
                </div>
                <p className={s.reelTitle}>{reel.structure_name}</p>
                <p className={s.reelBrief}>{reel.brief}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Voice off preview + analyze button ── */}
      {selectedScript && !hasScenes && !loadingScenes && (
        <div className={s.analyzeSection}>
          <div className={`card ${s.voicePreview}`}>
            <p className={s.formSectionTitle}>Voz en off — {selectedScript.structure_name}</p>
            <p className={s.voicePreviewText}>
              {getVoiceOff(selectedScript).slice(0, 400)}
              {getVoiceOff(selectedScript).length > 400 ? "…" : ""}
            </p>
          </div>
          {scenesError && <p className={s.formError}>{scenesError}</p>}
          <button
            className="btn btn-primary"
            style={{ alignSelf: "flex-start", padding: "12px 28px" }}
            onClick={handleAnalyzeScript}
            disabled={loadingScenes}
          >
            ✦ Analizar guion y generar ideas de escena
          </button>
        </div>
      )}

      {/* ── Loading scenes ── */}
      {loadingScenes && (
        <div className={`card ${s.resultEmpty}`}>
          <div className={s.loadingSpinner} />
          <p className={s.resultEmptyText}>Analizando guion y generando ideas visuales…</p>
        </div>
      )}

      {/* ── Scene ideas list ── */}
      {hasScenes && (
        <div className={s.scenesSection}>
          <div className={s.scenesSectionHeader}>
            <div>
              <p className={s.formSectionTitle}>Ideas de escena</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>
                {scenes.length} escenas · {selectedScript?.structure_name}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: "6px 14px" }}
                onClick={() => { setScenes([]); setPrompts([]); }}
              >
                ← Cambiar guion
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: "6px 14px" }}
                onClick={handleAnalyzeScript}
                disabled={loadingScenes}
              >
                ↺ Re-analizar
              </button>
            </div>
          </div>

          <div className={s.scenesList}>
            {scenes.map((scene, idx) => (
              <div key={idx} className={`card ${s.sceneCard}`}>
                <div className={s.sceneTop}>
                  <span className={s.sceneNum}>Escena {idx + 1}</span>
                  <div className={s.sceneActions}>
                    <button
                      className={`${s.sceneActionBtn} ${s.sceneGuionBtn}`}
                      title="Generar guion a partir de esta idea"
                      onClick={() => {
                        const brief = `${scene.scene_idea}. ${scene.scene_description}`;
                        const params = new URLSearchParams({ brief });
                        if (selectedScript?.client_id) params.set("client_id", selectedScript.client_id);
                        router.push(`/guiones/nuevo?${params.toString()}`);
                      }}
                    >
                      ✦ Guionar
                    </button>
                    <button
                      className={s.sceneActionBtn}
                      title="Editar descripción"
                      onClick={() => editingIdx === idx ? saveEdit(idx) : startEditing(idx)}
                    >
                      {editingIdx === idx ? "✓ Guardar" : "✎ Editar"}
                    </button>
                    <button
                      className={s.sceneActionBtn}
                      title="Regenerar idea"
                      disabled={regeneratingIdx === idx}
                      onClick={() => handleRegenerateScene(idx)}
                    >
                      {regeneratingIdx === idx ? "…" : "↺ Regen"}
                    </button>
                    <button
                      className={`${s.sceneActionBtn} ${s.sceneDeleteBtn}`}
                      title="Eliminar escena"
                      onClick={() => handleDeleteScene(idx)}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <p className={s.sceneVoice}>"{scene.voice_segment}"</p>
                <div className={s.sceneIdeaBox}>
                  <span className={s.sceneIdeaLabel}>Idea visual:</span>
                  <span className={s.sceneIdeaText}>{scene.scene_idea}</span>
                </div>

                {editingIdx === idx ? (
                  <textarea
                    className="textarea"
                    rows={3}
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    style={{ fontSize: 13 }}
                    autoFocus
                  />
                ) : (
                  <p className={s.sceneDesc}>{scene.scene_description}</p>
                )}
              </div>
            ))}
          </div>

          {/* Generate all prompts button */}
          {scenesError && <p className={s.formError}>{scenesError}</p>}
          {promptsError && <p className={s.formError}>{promptsError}</p>}
          <div className={s.generateBar}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Estilo: <strong style={{ color: "var(--text)" }}>{getSelectedStyleInfo().name}</strong>
            </span>
            <button
              className="btn btn-primary"
              style={{ padding: "12px 28px" }}
              onClick={handleGenerateAllPrompts}
              disabled={loadingPrompts || scenes.length === 0}
            >
              {loadingPrompts ? "Generando prompts…" : `✦ Generar ${scenes.length} prompts`}
            </button>
          </div>

          {loadingPrompts && (
            <div className={`card ${s.resultEmpty}`} style={{ minHeight: 100 }}>
              <div className={s.loadingSpinner} />
              <p className={s.resultEmptyText}>Generando prompts para cada escena…</p>
            </div>
          )}
        </div>
      )}

      {/* ── Generated prompts ── */}
      {hasPrompts && (
        <div className={s.promptsSection}>
          <div className={s.promptsSectionHeader}>
            <p className={s.formSectionTitle}>Prompts generados — {prompts.length} escenas</p>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: "6px 14px" }}
              onClick={copyAllPrompts}
            >
              Copiar todos
            </button>
          </div>

          <div className={s.promptsList}>
            {prompts.map((p, idx) => (
              <div key={idx} className={`card ${s.promptCard}`}>
                <div className={s.promptCardHeader}>
                  <div>
                    <span className={s.promptCardNum}>Escena {idx + 1}</span>
                    <span className={s.promptCardIdea}>{p.scene_idea}</span>
                  </div>
                  <button
                    className={`btn btn-ghost ${p.copied ? s.copiedBtn : ""}`}
                    style={{ fontSize: 12, padding: "6px 14px", flexShrink: 0 }}
                    onClick={() => copyPrompt(idx)}
                  >
                    {p.copied ? "¡Copiado!" : "Copiar"}
                  </button>
                </div>
                <p className={s.promptVoice}>"{p.voice_segment.slice(0, 120)}{p.voice_segment.length > 120 ? "…" : ""}"</p>
                <p className={s.promptText}>{p.prompt_en}</p>
                <p className={s.descText} style={{ marginTop: 8 }}>{p.description_es}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Mis estilos ── */}
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
                  <option value="realistic">Basado en Hiperrealista</option>
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
