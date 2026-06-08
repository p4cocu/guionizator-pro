"use client";

import styles from "../guiones.module.css";
import type { ReelContent, CarouselContent } from "./ScriptDetailClient";

// ── Reel Editor ──────────────────────────────────────────────────────────────

type ReelEditorProps = {
  content: ReelContent;
  onChange: (c: Record<string, unknown>) => void;
};

export function ReelEditor({ content, onChange }: ReelEditorProps) {
  function setVoiceOff(voice_off: string) {
    onChange({ ...content, voice_off });
  }

  function setBlock(
    idx: number,
    field: "name" | "duration",
    value: string
  ) {
    const blocks = content.blocks.map((b, i) =>
      i === idx ? { ...b, [field]: value } : b
    );
    onChange({ ...content, blocks });
  }

  function setLine(
    blockIdx: number,
    lineIdx: number,
    field: "tag" | "text",
    value: string
  ) {
    const blocks = content.blocks.map((b, i) => {
      if (i !== blockIdx) return b;
      const lines = b.lines.map((l, j) =>
        j === lineIdx ? { ...l, [field]: value } : l
      );
      return { ...b, lines };
    });
    onChange({ ...content, blocks });
  }

  function setMusic(
    key: "music_a" | "music_b",
    field: "name" | "why" | "prompt",
    value: string
  ) {
    onChange({ ...content, [key]: { ...content[key], [field]: value } });
  }

  return (
    <div className={styles.editorContainer}>
      {/* Voz en off */}
      <div className={styles.editorSection}>
        <label className={styles.editorLabel}>Voz en off (teleprompter)</label>
        <textarea
          className={`textarea ${styles.editorTextareaLg}`}
          value={content.voice_off ?? ""}
          onChange={(e) => setVoiceOff(e.target.value)}
          rows={6}
        />
      </div>

      {/* Bloques */}
      <div className={styles.editorSection}>
        <p className={styles.editorSectionTitle}>Bloques de producción</p>
        {content.blocks?.map((block, bi) => (
          <div key={bi} className={styles.editorBlock}>
            <div className={styles.editorBlockMeta}>
              <div className={styles.editorField}>
                <label className={styles.editorLabel}>Bloque</label>
                <input
                  className="input"
                  value={block.name}
                  onChange={(e) => setBlock(bi, "name", e.target.value)}
                />
              </div>
              <div className={styles.editorField} style={{ maxWidth: 120 }}>
                <label className={styles.editorLabel}>Duración</label>
                <input
                  className="input"
                  value={block.duration}
                  onChange={(e) => setBlock(bi, "duration", e.target.value)}
                />
              </div>
            </div>

            {block.lines?.map((line, li) => (
              <div key={li} className={styles.editorLineRow}>
                <div style={{ width: 90, flexShrink: 0 }}>
                  <label className={styles.editorLabel}>Tag</label>
                  <input
                    className="input"
                    value={line.tag}
                    onChange={(e) => setLine(bi, li, "tag", e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className={styles.editorLabel}>Texto</label>
                  <input
                    className="input"
                    value={line.text}
                    onChange={(e) => setLine(bi, li, "text", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Música */}
      {(content.music_a || content.music_b) && (
        <div className={styles.editorSection}>
          <p className={styles.editorSectionTitle}>Música</p>
          <div className={styles.musicRow}>
            {(["music_a", "music_b"] as const).map((key, i) => {
              const m = content[key];
              if (!m) return null;
              return (
                <div key={key} className={styles.editorMusicCard}>
                  <p className={styles.editorMusicLabel}>
                    {i === 0 ? "Estilo A (0–30s)" : "Estilo B (30–60s)"}
                  </p>
                  <div className={styles.editorField}>
                    <label className={styles.editorLabel}>Nombre</label>
                    <input
                      className="input"
                      value={m.name}
                      onChange={(e) => setMusic(key, "name", e.target.value)}
                    />
                  </div>
                  <div className={styles.editorField}>
                    <label className={styles.editorLabel}>Por qué</label>
                    <input
                      className="input"
                      value={m.why}
                      onChange={(e) => setMusic(key, "why", e.target.value)}
                    />
                  </div>
                  <div className={styles.editorField}>
                    <label className={styles.editorLabel}>Prompt</label>
                    <input
                      className="input"
                      value={m.prompt}
                      onChange={(e) => setMusic(key, "prompt", e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Carousel Editor ──────────────────────────────────────────────────────────

type CarouselEditorProps = {
  content: CarouselContent;
  onChange: (c: Record<string, unknown>) => void;
};

export function CarouselEditor({ content, onChange }: CarouselEditorProps) {
  function setSlide(
    idx: number,
    field: "text" | "visual" | "micro_anchor",
    value: string
  ) {
    const slides = content.slides.map((s, i) =>
      i === idx ? { ...s, [field]: value || null } : s
    );
    onChange({ ...content, slides });
  }

  return (
    <div className={styles.editorContainer}>
      <div className={styles.slidesGrid}>
        {content.slides?.map((slide, i) => (
          <div key={i} className={styles.editorSlideCard}>
            <span className={styles.slideNum}>Slide {slide.number}</span>
            <div className={styles.editorField}>
              <label className={styles.editorLabel}>Texto</label>
              <textarea
                className="textarea"
                value={slide.text}
                onChange={(e) => setSlide(i, "text", e.target.value)}
                rows={3}
              />
            </div>
            <div className={styles.editorField}>
              <label className={styles.editorLabel}>Visual</label>
              <textarea
                className="textarea"
                value={slide.visual}
                onChange={(e) => setSlide(i, "visual", e.target.value)}
                rows={2}
              />
            </div>
            <div className={styles.editorField}>
              <label className={styles.editorLabel}>Micro-anchor</label>
              <input
                className="input"
                value={slide.micro_anchor ?? ""}
                onChange={(e) => setSlide(i, "micro_anchor", e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
