"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ScriptRow,
  ScriptVersion,
  ScriptStatus,
  ScriptCopy,
  saveScriptVersion,
  deleteScript,
  updateScriptStatus,
  updateScriptTitle,
  addScriptToCalendar,
} from "../actions";
import { ReelEditor, CarouselEditor } from "./ScriptEditors";
import CopyExpertPanel from "./CopyExpertPanel";
import styles from "../guiones.module.css";

// ── Types ────────────────────────────────────────────────────────────────────

type ReelLine = { tag: string; text: string };
type ReelBlock = { name: string; duration: string; lines: ReelLine[] };
type MusicRec = { name: string; why: string; prompt: string };
export type ReelContent = {
  voice_off: string;
  blocks: ReelBlock[];
  music_a: MusicRec;
  music_b: MusicRec;
};
export type CarouselSlide = {
  number: number;
  text: string;
  body?: string;
  visual: string;
  micro_anchor: string | null;
};
export type CarouselContent = { slides: CarouselSlide[] };

type Mode = "view" | "edit-manual";

const STATUS_OPTIONS: { value: ScriptStatus; label: string; color: string }[] = [
  { value: "idea", label: "Idea", color: "var(--text-dim)" },
  { value: "produccion", label: "En producción", color: "var(--signal)" },
  { value: "publicado", label: "Publicado", color: "var(--emerald)" },
];

// ── Markdown renderer (bold / underline / highlight) ─────────────────────────

function renderMarkdown(text: string) {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|_(.+?)_|==(.+?)==)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));

    if (match[2] !== undefined) parts.push(<strong key={match.index}>{match[2]}</strong>);
    else if (match[3] !== undefined) parts.push(<u key={match.index}>{match[3]}</u>);
    else if (match[4] !== undefined) parts.push(<mark key={match.index}>{match[4]}</mark>);

    last = match.index + match[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ── Viewers (read-only) ──────────────────────────────────────────────────────

type ReelViewerProps = {
  content: ReelContent;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
};

function ReelViewer({ content, onRegenerate, isRegenerating }: ReelViewerProps) {
  const hasBlocks = (content.blocks?.length ?? 0) > 0;

  return (
    <div className={styles.scriptContainer}>
      <div className={styles.voiceOff}>
        <p className={styles.voiceOffLabel}>Voz en off (teleprompter)</p>
        <p className={styles.voiceOffText}>{renderMarkdown(content.voice_off)}</p>
      </div>

      <div className={styles.sectionTitleRow} style={{ marginTop: 8 }}>
        <p className={styles.sectionTitle}>Guion de producción</p>
        {onRegenerate && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "4px 14px" }}
            onClick={onRegenerate}
            disabled={isRegenerating}
          >
            {isRegenerating
              ? "Generando…"
              : hasBlocks
              ? "↺ Regenerar desde voz en off"
              : "✦ Generar guión de producción"}
          </button>
        )}
      </div>

      {!hasBlocks && !isRegenerating && (
        <p className={styles.emptyBlocks}>
          El guión de producción se genera una vez que la voz en off esté pulida.
        </p>
      )}

      {content.blocks?.map((block, i) => (
        <div key={i} className={styles.scriptBlock}>
          <div className={styles.scriptBlockHeader}>
            <span className={styles.scriptBlockName}>{block.name}</span>
            <span className={styles.scriptBlockDuration}>{block.duration}</span>
          </div>
          <div className={styles.scriptLines}>
            {block.lines?.map((line, j) => (
              <div key={j} className={styles.scriptLine}>
                <span className={styles.scriptLineTag}>[{line.tag}]</span>
                <span className={styles.scriptLineText}>&ldquo;{line.text}&rdquo;</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {(content.music_a || content.music_b) && (
        <>
          <p className={styles.sectionTitle}>Música</p>
          <div className={styles.musicRow}>
            {[content.music_a, content.music_b].map((m, i) =>
              m ? (
                <div key={i} className={styles.musicCard}>
                  <p className={styles.musicCardLabel}>
                    {i === 0 ? "Estilo A (0–30s)" : "Estilo B (30–60s)"}
                  </p>
                  <p className={styles.musicCardName}>{m.name}</p>
                  <p className={styles.musicCardWhy}>{m.why}</p>
                  <p className={styles.musicCardPrompt}>{m.prompt}</p>
                </div>
              ) : null
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CarouselViewer({ content }: { content: CarouselContent }) {
  const [hideVisuals, setHideVisuals] = useState(false);

  return (
    <div className={styles.scriptContainer}>
      <div className={styles.carouselToolbar}>
        <button
          className={`btn btn-ghost ${styles.hideVisualsBtn}`}
          onClick={() => setHideVisuals((v) => !v)}
        >
          {hideVisuals ? "👁 Mostrar visuales" : "🙈 Ocultar visuales"}
        </button>
      </div>
      <div className={styles.slidesGrid}>
        {content.slides?.map((slide) => (
          <div key={slide.number} className={styles.slide}>
            <span className={styles.slideNum}>Slide {slide.number}</span>
            <p className={styles.slideText}>{slide.text}</p>
            {slide.body && (
              <p className={styles.slideBody}>{slide.body}</p>
            )}
            {slide.micro_anchor && (
              <p className={styles.slideAnchor}>↳ {slide.micro_anchor}</p>
            )}
            {!hideVisuals && (
              <p className={styles.slideVisual}>{slide.visual}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Fullscreen Reel Editor ────────────────────────────────────────────────────

type FullscreenReelEditorProps = {
  content: ReelContent;
  onChange: (c: Record<string, unknown>) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  saveError: string | null;
  title: string;
};

function FullscreenReelEditor({
  content,
  onChange,
  onSave,
  onClose,
  saving,
  saveError,
  title,
}: FullscreenReelEditorProps) {
  const lastFocusedTextarea = useRef<HTMLTextAreaElement | null>(null);

  function insertFormat(token: string) {
    const el = lastFocusedTextarea.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;
    const newVal =
      val.slice(0, start) + token + val.slice(start, end) + token + val.slice(end);

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    nativeSetter?.call(el, newVal);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, end + token.length);
    });
  }

  return (
    <div className={styles.fullscreenOverlay}>
      {/* Header fijo */}
      <div className={styles.fullscreenHeader}>
        <div className={styles.fullscreenHeaderLeft}>
          <span className={styles.fullscreenTitle}>{title}</span>
          <div className={styles.formatToolbar}>
            <button
              className={styles.formatBtn}
              title="Negrita (**texto**)"
              onMouseDown={(e) => { e.preventDefault(); insertFormat("**"); }}
            >
              <strong>B</strong>
            </button>
            <button
              className={styles.formatBtn}
              title="Subrayado (_texto_)"
              onMouseDown={(e) => { e.preventDefault(); insertFormat("_"); }}
            >
              <u>U</u>
            </button>
            <button
              className={styles.formatBtn}
              title="Resaltar (==texto==)"
              onMouseDown={(e) => { e.preventDefault(); insertFormat("=="); }}
            >
              <mark style={{ padding: "0 2px", borderRadius: 3 }}>HL</mark>
            </button>
          </div>
        </div>
        <div className={styles.fullscreenHeaderRight}>
          {saveError && <span className={styles.saveError}>{saveError}</span>}
          <button
            className="btn btn-primary"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar versión"}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            ✕ Salir
          </button>
        </div>
      </div>

      {/* Contenido scrollable */}
      <div className={styles.fullscreenBody}>
        {/* Voice off — sección principal */}
        <div className={styles.fullscreenVoiceOff}>
          <label className={styles.editorLabel}>Voz en off (teleprompter)</label>
          <textarea
            className={`textarea ${styles.fullscreenTextarea}`}
            value={content.voice_off ?? ""}
            rows={16}
            onFocus={(e) => { lastFocusedTextarea.current = e.currentTarget; }}
            onChange={(e) =>
              onChange({ ...content, voice_off: e.target.value })
            }
          />
        </div>

        {/* Bloques de producción */}
        {content.blocks?.length > 0 && (
          <div className={styles.fullscreenBlocks}>
            <p className={styles.editorSectionTitle}>Bloques de producción</p>
            {content.blocks.map((block, bi) => (
              <div key={bi} className={styles.editorBlock}>
                <div className={styles.editorBlockMeta}>
                  <div className={styles.editorField}>
                    <label className={styles.editorLabel}>Bloque</label>
                    <input
                      className="input"
                      value={block.name}
                      onChange={(e) => {
                        const blocks = content.blocks.map((b, i) =>
                          i === bi ? { ...b, name: e.target.value } : b
                        );
                        onChange({ ...content, blocks });
                      }}
                    />
                  </div>
                  <div className={styles.editorField} style={{ maxWidth: 120 }}>
                    <label className={styles.editorLabel}>Duración</label>
                    <input
                      className="input"
                      value={block.duration}
                      onChange={(e) => {
                        const blocks = content.blocks.map((b, i) =>
                          i === bi ? { ...b, duration: e.target.value } : b
                        );
                        onChange({ ...content, blocks });
                      }}
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
                        onFocus={(e) => { lastFocusedTextarea.current = null; }}
                        onChange={(e) => {
                          const blocks = content.blocks.map((b, i) => {
                            if (i !== bi) return b;
                            const lines = b.lines.map((l, j) =>
                              j === li ? { ...l, tag: e.target.value } : l
                            );
                            return { ...b, lines };
                          });
                          onChange({ ...content, blocks });
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className={styles.editorLabel}>Texto</label>
                      <input
                        className="input"
                        value={line.text}
                        onChange={(e) => {
                          const blocks = content.blocks.map((b, i) => {
                            if (i !== bi) return b;
                            const lines = b.lines.map((l, j) =>
                              j === li ? { ...l, text: e.target.value } : l
                            );
                            return { ...b, lines };
                          });
                          onChange({ ...content, blocks });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Export helpers ───────────────────────────────────────────────────────────

function buildTxt(script: ScriptRow, content: ReelContent | CarouselContent): string {
  const clientName = script.clients?.nombre ?? "—";
  const marca = script.clients?.marca ? ` — ${script.clients.marca}` : "";
  const lines: string[] = [
    `GUION: ${script.structure_name}`,
    `CLIENTE: ${clientName}${marca}`,
    `TIPO: ${script.type === "reel" ? "Reel" : "Carrusel"}`,
    `VERSION: v${script.version_number}`,
    `BRIEF: ${script.brief}`,
    "─".repeat(60), "",
  ];

  if (script.type === "reel") {
    const c = content as ReelContent;
    lines.push("VOZ EN OFF (TELEPROMPTER)", c.voice_off, "", "─".repeat(60), "");
    lines.push("GUION DE PRODUCCIÓN", "");
    for (const block of c.blocks ?? []) {
      lines.push(`[${block.name}] ${block.duration}`);
      for (const line of block.lines ?? []) lines.push(`  [${line.tag}] "${line.text}"`);
      lines.push("");
    }
    if (c.music_a || c.music_b) {
      lines.push("─".repeat(60), "", "MÚSICA", "");
      if (c.music_a) lines.push(`Estilo A: ${c.music_a.name}`, `  ${c.music_a.why}`, `  Prompt: ${c.music_a.prompt}`, "");
      if (c.music_b) lines.push(`Estilo B: ${c.music_b.name}`, `  ${c.music_b.why}`, `  Prompt: ${c.music_b.prompt}`, "");
    }
  } else {
    const c = content as CarouselContent;
    lines.push("SLIDES", "");
    for (const slide of c.slides ?? []) {
      lines.push(`Slide ${slide.number}:`);
      lines.push(`  Texto: ${slide.text}`);
      if (slide.micro_anchor) lines.push(`  Micro-anchor: ${slide.micro_anchor}`);
      lines.push(`  Visual: ${slide.visual}`, "");
    }
  }
  return lines.join("\n");
}

function buildMd(script: ScriptRow, content: ReelContent | CarouselContent): string {
  const clientName = script.clients?.nombre ?? "—";
  const marca = script.clients?.marca ? ` — ${script.clients.marca}` : "";
  const lines: string[] = [
    `# ${script.structure_name}`,
    `**Cliente:** ${clientName}${marca} | **Tipo:** ${script.type === "reel" ? "Reel" : "Carrusel"} | **Versión:** v${script.version_number}`,
    "", `> ${script.brief}`, "", "---", "",
  ];

  if (script.type === "reel") {
    const c = content as ReelContent;
    lines.push("## Voz en off (teleprompter)", "", c.voice_off, "", "---", "");
    lines.push("## Guion de producción", "");
    for (const block of c.blocks ?? []) {
      lines.push(`### ${block.name} — ${block.duration}`, "");
      for (const line of block.lines ?? []) lines.push(`- **[${line.tag}]** "${line.text}"`);
      lines.push("");
    }
    if (c.music_a || c.music_b) {
      lines.push("---", "", "## Música", "");
      if (c.music_a) lines.push(`### Estilo A: ${c.music_a.name}`, `_${c.music_a.why}_`, "", `\`${c.music_a.prompt}\``, "");
      if (c.music_b) lines.push(`### Estilo B: ${c.music_b.name}`, `_${c.music_b.why}_`, "", `\`${c.music_b.prompt}\``, "");
    }
  } else {
    const c = content as CarouselContent;
    lines.push("## Slides", "");
    for (const slide of c.slides ?? []) {
      lines.push(`### Slide ${slide.number}`, "", `**${slide.text}**`, "");
      if (slide.micro_anchor) lines.push(`↳ ${slide.micro_anchor}`, "");
      lines.push(`_Visual:_ ${slide.visual}`, "");
    }
  }
  return lines.join("\n");
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60);
}

// ── Main component ───────────────────────────────────────────────────────────

type Props = {
  script: ScriptRow;
  versions: ScriptVersion[];
  initialCopies: ScriptCopy[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function ScriptDetailClient({ script, versions, initialCopies }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editContent, setEditContent] = useState<Record<string, unknown>>(script.content);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isUpdatingStatus, startStatusTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [notebookCopied, setNotebookCopied] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<ScriptStatus>(script.status ?? "idea");
  const [showCopyPanel, setShowCopyPanel] = useState(false);
  const [showCalModal, setShowCalModal] = useState(false);

  // Title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(script.title ?? "");
  const [isSavingTitle, startTitleTransition] = useTransition();
  const [calForm, setCalForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    week_number: 1,
    position_preference: "fin" as "inicio" | "fin",
  });
  const [calPending, startCalTransition] = useTransition();
  const [calSuccess, setCalSuccess] = useState(false);
  const [isRegeneratingBlocks, setIsRegeneratingBlocks] = useState(false);
  const [regenBlocksError, setRegenBlocksError] = useState<string | null>(null);
  const downloadRef = useRef<HTMLDivElement>(null);

  const isReel = script.type === "reel";
  const content = script.content as ReelContent | CarouselContent;
  const showVersions = versions.length > 1;

  useEffect(() => {
    if (!downloadMenuOpen) return;
    function handler(e: MouseEvent) {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setDownloadMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [downloadMenuOpen]);

  function handleCancelEdit() {
    setMode("view");
    setIsFullscreen(false);
    setEditContent(script.content);
    setSaveError(null);
  }

  async function handleCopy() {
    if (!isReel) return;
    const voiceOff = (content as ReelContent).voice_off;
    await navigator.clipboard.writeText(voiceOff);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload(format: "txt" | "md") {
    const text = format === "txt" ? buildTxt(script, content) : buildMd(script, content);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(script.structure_name)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloadMenuOpen(false);
  }

  function handleSaveManual() {
    setSaveError(null);
    startTransition(async () => {
      try {
        const newId = await saveScriptVersion(script.id, editContent);
        setIsFullscreen(false);
        router.push(`/guiones/${newId}`);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  async function handleOpenNotebook() {
    const REEL_URL = "https://notebooklm.google.com/notebook/f9274dff-9a3d-4f77-8bf6-de2d0d16f06d/preview";
    const CAROUSEL_URL = "https://notebooklm.google.com/notebook/ed49a5bf-a023-4f00-a621-5fa1b179bf3d/preview";

    let textToCopy = "";
    if (isReel) {
      textToCopy = (content as ReelContent).voice_off ?? "";
    } else {
      const slides = (content as CarouselContent).slides ?? [];
      textToCopy = slides.map((s) => `Slide ${s.number}: ${s.text}${s.micro_anchor ? `\n↳ ${s.micro_anchor}` : ""}`).join("\n\n");
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setNotebookCopied(true);
      setTimeout(() => setNotebookCopied(false), 3000);
    } catch {
      // clipboard not available — open anyway
    }
    window.open(isReel ? REEL_URL : CAROUSEL_URL, "_blank");
  }

  function handleDelete() {
    if (!confirm("¿Eliminar este guion y todas sus versiones? Esta acción no se puede deshacer.")) return;
    startDeleteTransition(async () => { await deleteScript(script.id); });
  }

  function handleStatusChange(newStatus: ScriptStatus) {
    setCurrentStatus(newStatus);
    startStatusTransition(async () => { await updateScriptStatus(script.id, newStatus); });
  }

  function handleSaveTitle() {
    startTitleTransition(async () => {
      await updateScriptTitle(script.id, titleDraft);
      setEditingTitle(false);
      router.refresh();
    });
  }

  function handleAddToCalendar() {
    setCalSuccess(false);
    startCalTransition(async () => {
      try {
        await addScriptToCalendar(script.id, {
          client_id: script.client_id ?? null,
          title: script.title || script.structure_name,
          format: script.type === "reel" ? "reel" : "carrusel",
          month: calForm.month,
          year: calForm.year,
          week_number: calForm.week_number,
          position_preference: calForm.position_preference,
        });
        setCalSuccess(true);
        setTimeout(() => { setShowCalModal(false); setCalSuccess(false); }, 1500);
      } catch (e) {
        console.error(e);
      }
    });
  }

  async function handleGenerateBlocks() {
    if (!isReel) return;
    const reelContent = content as ReelContent;
    setIsRegeneratingBlocks(true);
    setRegenBlocksError(null);
    try {
      const res = await fetch("/api/ai/production-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script_id: script.id, voice_off: reelContent.voice_off }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al generar bloques");
      const newContent: ReelContent = {
        ...reelContent,
        blocks: data.blocks ?? [],
        music_a: data.music_a ?? null,
        music_b: data.music_b ?? null,
      };
      const newId = await saveScriptVersion(script.id, newContent as Record<string, unknown>);
      router.push(`/guiones/${newId}`);
    } catch (e) {
      setRegenBlocksError(e instanceof Error ? e.message : "Error al generar bloques");
      setIsRegeneratingBlocks(false);
    }
  }

  // ── Fullscreen overlay (Reel editor) ─────────────────────────────────────
  // Rendered via portal so it escapes the .inner stacking context (z-index:1)
  // that would otherwise put the topbar (z-index:299) above the overlay.

  if (isFullscreen && isReel && mode === "edit-manual") {
    if (typeof document === "undefined") return null;
    return createPortal(
      <FullscreenReelEditor
        content={editContent as ReelContent}
        onChange={setEditContent}
        onSave={handleSaveManual}
        onClose={handleCancelEdit}
        saving={isPending}
        saveError={saveError}
        title={script.structure_name}
      />,
      document.body
    );
  }

  return (
    <div className={styles.detailPage}>
      {/* ── Header ── */}
      <div className={styles.detailHeader}>
        <div className={styles.detailMeta}>
          <Link href="/guiones" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
            ← Guiones
          </Link>
          <p className={styles.detailClientName}>
            {script.clients?.nombre ?? "—"}
            {script.clients?.marca ? ` — ${script.clients.marca}` : ""}
          </p>

          {/* Title: editable inline */}
          {editingTitle ? (
            <div className={styles.titleEditRow}>
              <input
                className={`input ${styles.titleInput}`}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                placeholder="Título de la publicación…"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
              />
              <button className="btn btn-primary" onClick={handleSaveTitle} disabled={isSavingTitle} style={{ padding: "8px 16px", fontSize: 12 }}>
                {isSavingTitle ? "…" : "Guardar"}
              </button>
              <button className="btn btn-ghost" onClick={() => { setEditingTitle(false); setTitleDraft(script.title ?? ""); }} style={{ padding: "8px 12px", fontSize: 12 }}>
                ✕
              </button>
            </div>
          ) : (
            <div className={styles.titleRow}>
              <h1 className={styles.detailTitle}>{script.title || script.structure_name}</h1>
              <button
                className={`btn btn-ghost ${styles.editTitleBtn}`}
                onClick={() => { setTitleDraft(script.title ?? ""); setEditingTitle(true); }}
                title="Editar título"
              >
                ✎
              </button>
            </div>
          )}

          <p className={styles.detailSubtitle}>
            <span className={`${styles.typeBadge} ${styles[script.type]}`} style={{ display: "inline-flex", marginRight: 8 }}>
              {isReel ? "Reel" : "Carrusel"}
            </span>
            <span style={{ marginRight: 8 }}>{script.structure_name}</span>
            {formatDate(script.created_at)}
          </p>
        </div>

        <div className={styles.detailActions}>
          <div className={styles.statusSelector}>
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`${styles.statusBtn} ${currentStatus === opt.value ? styles.statusBtnActive : ""}`}
                style={currentStatus === opt.value ? { color: opt.color, borderColor: opt.color } : {}}
                onClick={() => handleStatusChange(opt.value)}
                disabled={isUpdatingStatus}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Link href="/guiones/nuevo" className="btn btn-primary">+ Nuevo guion</Link>
          <button onClick={handleDelete} disabled={isDeleting} className="btn btn-ghost" style={{ color: "var(--flare)" }}>
            {isDeleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>

      {/* ── Versiones ── */}
      {showVersions && (
        <div className={styles.versionBar}>
          <span className={styles.versionBarLabel}>Versiones:</span>
          {versions.map((v) => (
            <Link key={v.id} href={`/guiones/${v.id}`} className={`${styles.versionPill} ${v.id === script.id ? styles.versionPillActive : ""}`}>
              v{v.version_number}
              {v.is_latest && <span className={styles.versionLatestDot} />}
            </Link>
          ))}
        </div>
      )}

      {/* ── Barra de acciones ── */}
      <div className={styles.actionBar}>
        <div className={styles.actionBarLeft}>
          <button
            onClick={() => {
              if (mode === "edit-manual") {
                handleCancelEdit();
              } else {
                setMode("edit-manual");
                setEditContent(script.content);
                if (isReel) setIsFullscreen(true);
              }
            }}
            className={`btn ${mode === "edit-manual" ? "btn-secondary" : "btn-ghost"}`}
          >
            {mode === "edit-manual" ? "✕ Cancelar" : "Editar manualmente"}
          </button>
          <button
            onClick={handleOpenNotebook}
            className={`btn btn-ghost ${notebookCopied ? styles.copiedState : ""}`}
            title={isReel ? "Copia la voz en off y abre NotebookLM" : "Copia los slides y abre NotebookLM"}
          >
            {notebookCopied ? "✓ Copiado — abre NotebookLM" : "✦ Editar con IA"}
          </button>
        </div>

        <div className={styles.actionBarRight}>
          <Link
            href={`/prompts?script_id=${script.id}`}
            className="btn btn-ghost"
          >
            ✦ Prompting
          </Link>

          <button
            className={`btn btn-ghost ${showCopyPanel ? "btn-secondary" : ""}`}
            onClick={() => setShowCopyPanel((v) => !v)}
          >
            ✍ Copy Expert
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => setShowCalModal(true)}
          >
            📅 Calendario
          </button>

          {isReel && (
            <button onClick={handleCopy} className={`btn btn-ghost ${copied ? styles.copiedState : ""}`}>
              {copied ? "¡Copiado!" : "Copiar voz en off"}
            </button>
          )}

          <div ref={downloadRef} style={{ position: "relative" }}>
            <button onClick={() => setDownloadMenuOpen((o) => !o)} className="btn btn-ghost">
              Descargar ↓
            </button>
            {downloadMenuOpen && (
              <div className={styles.downloadMenu}>
                <button className={styles.downloadMenuItem} onClick={() => handleDownload("txt")}>
                  <span className={styles.downloadExt}>.txt</span>
                  <span className={styles.downloadDesc}>Texto plano</span>
                </button>
                <button className={styles.downloadMenuItem} onClick={() => handleDownload("md")}>
                  <span className={styles.downloadExt}>.md</span>
                  <span className={styles.downloadDesc}>Markdown</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Brief ── */}
      <div className={styles.briefBox}>
        <p className={styles.briefLabel}>Brief</p>
        <p className={styles.briefText}>{script.brief}</p>
      </div>

      {/* ── Contenido ── */}
      {mode === "edit-manual" ? (
        isReel ? (
          <ReelEditor content={editContent as ReelContent} onChange={setEditContent} />
        ) : (
          <CarouselEditor content={editContent as CarouselContent} onChange={setEditContent} />
        )
      ) : isReel ? (
        <ReelViewer
          content={content as ReelContent}
          onRegenerate={handleGenerateBlocks}
          isRegenerating={isRegeneratingBlocks}
        />
      ) : (
        <CarouselViewer content={content as CarouselContent} />
      )}

      {regenBlocksError && (
        <p style={{ color: "var(--flare)", fontSize: 13, marginTop: 8 }}>{regenBlocksError}</p>
      )}

      {/* ── Guardar edición manual (sticky footer) ── */}
      {mode === "edit-manual" && !isFullscreen && (
        <div className={styles.saveBar}>
          {saveError && <span className={styles.saveError}>{saveError}</span>}
          <button className="btn btn-ghost" onClick={handleCancelEdit}>
            Cancelar
          </button>
          <button onClick={handleSaveManual} disabled={isPending} className="btn btn-primary">
            {isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      )}

      {/* ── Copy Expert Panel ── */}
      {showCopyPanel && (
        <CopyExpertPanel
          scriptId={script.id}
          scriptContent={script.content}
          scriptType={script.type}
          initialCopies={initialCopies}
        />
      )}

      {/* ── Modal: Agregar al calendario ── */}
      {showCalModal && (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowCalModal(false)}>
          <div className={styles.calModal}>
            <div className={styles.calModalHeader}>
              <h3 className={styles.calModalTitle}>📅 Agregar al calendario</h3>
              <button className={styles.calModalClose} onClick={() => setShowCalModal(false)}>✕</button>
            </div>
            <div className={styles.calModalBody}>
              <p className={styles.calModalDesc}>
                Este guion se añadirá al Dashboard de publicaciones como una pieza de tipo <strong>{isReel ? "Reel" : "Carrusel"}</strong>.
              </p>
              <div className={styles.calFormRow}>
                <div className="field">
                  <label className="field-label">Mes</label>
                  <select
                    className="select"
                    value={calForm.month}
                    onChange={(e) => setCalForm((p) => ({ ...p, month: parseInt(e.target.value) }))}
                  >
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Año</label>
                  <input
                    className="input"
                    type="number"
                    value={calForm.year}
                    onChange={(e) => setCalForm((p) => ({ ...p, year: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
              <div className={styles.calFormRow}>
                <div className="field">
                  <label className="field-label">Semana</label>
                  <select
                    className="select"
                    value={calForm.week_number}
                    onChange={(e) => setCalForm((p) => ({ ...p, week_number: parseInt(e.target.value) }))}
                  >
                    <option value={1}>Semana 1</option>
                    <option value={2}>Semana 2</option>
                    <option value={3}>Semana 3</option>
                    <option value={4}>Semana 4</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Posición</label>
                  <select
                    className="select"
                    value={calForm.position_preference}
                    onChange={(e) => setCalForm((p) => ({ ...p, position_preference: e.target.value as "inicio" | "fin" }))}
                  >
                    <option value="fin">Al final de la semana</option>
                    <option value="inicio">Al inicio de la semana</option>
                  </select>
                </div>
              </div>
              {calSuccess ? (
                <p style={{ color: "var(--emerald)", fontWeight: 600, textAlign: "center", marginTop: 8 }}>
                  ✓ Añadido al calendario
                </p>
              ) : (
                <div className={styles.calModalActions}>
                  <button className="btn btn-ghost" onClick={() => setShowCalModal(false)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={handleAddToCalendar} disabled={calPending}>
                    {calPending ? "Agregando…" : "Agregar al calendario"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
