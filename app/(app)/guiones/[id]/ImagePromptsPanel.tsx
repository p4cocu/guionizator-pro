"use client";

import { useState } from "react";
import type { PromptStyle } from "../../prompts/actions";
import type { CarouselSlide } from "./ScriptDetailClient";
import styles from "../guiones.module.css";

const PRESET_STYLES = [
  { id: "realistic", name: "Hiperrealista", base_style: "realistic", style_tokens: null as string | null, icon: "📸" },
  { id: "pixar",     name: "Pixar 3D",      base_style: "pixar",     style_tokens: null as string | null, icon: "🎬" },
  { id: "cinematic", name: "Cinemático",     base_style: "cinematic", style_tokens: null as string | null, icon: "🎞" },
];

type SlideState = {
  loading: boolean;
  result: { prompt_en: string; description_es: string } | null;
  error: string | null;
  copied: boolean;
};

type Props = {
  slides: CarouselSlide[];
  customStyles: PromptStyle[];
  onClose: () => void;
};

export default function ImagePromptsPanel({ slides, customStyles, onClose }: Props) {
  const allStyles = [
    ...PRESET_STYLES.map((st) => ({ ...st, isCustom: false })),
    ...customStyles.map((cs) => ({
      id: cs.id,
      name: cs.name,
      base_style: cs.base_style ?? "custom",
      style_tokens: cs.style_tokens,
      icon: "✦",
      isCustom: true,
    })),
  ];

  const [selectedStyleId, setSelectedStyleId] = useState("realistic");
  const [slideStates, setSlideStates] = useState<Record<number, SlideState>>({});

  function getSlideState(num: number): SlideState {
    return slideStates[num] ?? { loading: false, result: null, error: null, copied: false };
  }

  function patchSlideState(num: number, patch: Partial<SlideState>) {
    setSlideStates((prev) => ({
      ...prev,
      [num]: { ...getSlideState(num), ...patch },
    }));
  }

  async function handleGenerate(slide: CarouselSlide) {
    const selected = allStyles.find((s) => s.id === selectedStyleId);
    if (!selected) return;

    patchSlideState(slide.number, { loading: true, error: null, result: null });

    try {
      const res = await fetch("/api/ai/prompt-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medium: "photography",
          subject: slide.text,
          action: "",
          environment: "relevant to the content",
          style_vibe: slide.visual,
          technical_specs: "9:16 vertical, Instagram carousel",
          base_style: selected.base_style,
          style_tokens: selected.style_tokens ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error generando prompt");
      patchSlideState(slide.number, { loading: false, result: data });
    } catch (e) {
      patchSlideState(slide.number, {
        loading: false,
        error: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  }

  async function handleCopy(num: number, text: string) {
    await navigator.clipboard.writeText(text);
    patchSlideState(num, { copied: true });
    setTimeout(() => patchSlideState(num, { copied: false }), 2000);
  }

  return (
    <div className={styles.imagePanel}>
      {/* Header */}
      <div className={styles.imagePanelHeader}>
        <p className={styles.imagePanelTitle}>✦ Prompts de imagen</p>
        <button className="btn btn-ghost" onClick={onClose} style={{ padding: "4px 10px", fontSize: 12 }}>
          ✕ Cerrar
        </button>
      </div>

      {/* Style selector */}
      <div className={styles.styleSelector}>
        {allStyles.map((st) => (
          <button
            key={st.id}
            className={`${styles.stylePill} ${selectedStyleId === st.id ? styles.stylePillActive : ""}`}
            onClick={() => setSelectedStyleId(st.id)}
          >
            {st.icon} {st.name}
          </button>
        ))}
      </div>

      {/* Slide list */}
      {slides.map((slide) => {
        const state = getSlideState(slide.number);
        return (
          <div key={slide.number} className={styles.slidePromptRow}>
            <div className={styles.slidePromptMeta}>
              <p className={styles.slidePromptNum}>Slide {slide.number}</p>
              <p className={styles.slidePromptTitle}>{slide.text}</p>
              {slide.visual && (
                <p className={styles.slidePromptVisual}>{slide.visual}</p>
              )}
            </div>

            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: "5px 14px" }}
              onClick={() => handleGenerate(slide)}
              disabled={state.loading}
            >
              {state.loading ? "Generando…" : state.result ? "↺ Regenerar" : "✦ Generar prompt"}
            </button>

            {state.error && (
              <p className={styles.promptError}>{state.error}</p>
            )}

            {state.result && (
              <div className={styles.promptBox}>
                <p className={styles.promptEn}>{state.result.prompt_en}</p>
                <div className={styles.promptActions}>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: "4px 12px" }}
                    onClick={() => handleCopy(slide.number, state.result!.prompt_en)}
                  >
                    {state.copied ? "✓ Copiado" : "Copiar prompt"}
                  </button>
                </div>
                <p className={styles.promptDesc}>{state.result.description_es}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
