"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScriptRow, ScriptVersion, ScriptStatus, saveScriptVersion, deleteScript, updateScriptStatus } from "../actions";
import { ReelEditor, CarouselEditor } from "./ScriptEditors";
import AiEditPanel from "./AiEditPanel";
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
  visual: string;
  micro_anchor: string | null;
};
export type CarouselContent = { slides: CarouselSlide[] };

type Mode = "view" | "edit-manual" | "edit-ai";

const STATUS_OPTIONS: { value: ScriptStatus; label: string; color: string }[] = [
  { value: "idea", label: "Idea", color: "var(--text-dim)" },
  { value: "produccion", label: "En producción", color: "var(--signal)" },
  { value: "publicado", label: "Publicado", color: "var(--emerald)" },
];

// ── Viewers (read-only) ──────────────────────────────────────────────────────

function ReelViewer({ content }: { content: ReelContent }) {
  return (
    <div className={styles.scriptContainer}>
      <div className={styles.voiceOff}>
        <p className={styles.voiceOffLabel}>Voz en off (teleprompter)</p>
        <p className={styles.voiceOffText}>{content.voice_off}</p>
      </div>

      <p className={styles.sectionTitle} style={{ marginTop: 8 }}>
        Guion de producción
      </p>
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
  return (
    <div className={styles.slidesGrid}>
      {content.slides?.map((slide) => (
        <div key={slide.number} className={styles.slide}>
          <span className={styles.slideNum}>Slide {slide.number}</span>
          <p className={styles.slideText}>{slide.text}</p>
          <p className={styles.slideVisual}>{slide.visual}</p>
          {slide.micro_anchor && (
            <p className={styles.slideAnchor}>↳ {slide.micro_anchor}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Export helpers ───────────────────────────────────────────────────────────

function buildTxt(
  script: ScriptRow,
  content: ReelContent | CarouselContent
): string {
  const clientName = script.clients?.nombre ?? "—";
  const marca = script.clients?.marca ? ` — ${script.clients.marca}` : "";
  const lines: string[] = [
    `GUION: ${script.structure_name}`,
    `CLIENTE: ${clientName}${marca}`,
    `TIPO: ${script.type === "reel" ? "Reel" : "Carrusel"}`,
    `VERSION: v${script.version_number}`,
    `BRIEF: ${script.brief}`,
    "─".repeat(60),
    "",
  ];

  if (script.type === "reel") {
    const c = content as ReelContent;
    lines.push("VOZ EN OFF (TELEPROMPTER)", c.voice_off, "", "─".repeat(60), "");
    lines.push("GUION DE PRODUCCIÓN", "");
    for (const block of c.blocks ?? []) {
      lines.push(`[${block.name}] ${block.duration}`);
      for (const line of block.lines ?? []) {
        lines.push(`  [${line.tag}] "${line.text}"`);
      }
      lines.push("");
    }
    if (c.music_a || c.music_b) {
      lines.push("─".repeat(60), "", "MÚSICA", "");
      if (c.music_a) {
        lines.push(
          `Estilo A (0–30s): ${c.music_a.name}`,
          `  ${c.music_a.why}`,
          `  Prompt: ${c.music_a.prompt}`,
          ""
        );
      }
      if (c.music_b) {
        lines.push(
          `Estilo B (30–60s): ${c.music_b.name}`,
          `  ${c.music_b.why}`,
          `  Prompt: ${c.music_b.prompt}`,
          ""
        );
      }
    }
  } else {
    const c = content as CarouselContent;
    lines.push("SLIDES", "");
    for (const slide of c.slides ?? []) {
      lines.push(`Slide ${slide.number}:`);
      lines.push(`  Texto: ${slide.text}`);
      lines.push(`  Visual: ${slide.visual}`);
      if (slide.micro_anchor) lines.push(`  Micro-anchor: ${slide.micro_anchor}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function buildMd(
  script: ScriptRow,
  content: ReelContent | CarouselContent
): string {
  const clientName = script.clients?.nombre ?? "—";
  const marca = script.clients?.marca ? ` — ${script.clients.marca}` : "";
  const lines: string[] = [
    `# ${script.structure_name}`,
    `**Cliente:** ${clientName}${marca} | **Tipo:** ${script.type === "reel" ? "Reel" : "Carrusel"} | **Versión:** v${script.version_number}`,
    "",
    `> ${script.brief}`,
    "",
    "---",
    "",
  ];

  if (script.type === "reel") {
    const c = content as ReelContent;
    lines.push("## Voz en off (teleprompter)", "", c.voice_off, "", "---", "");
    lines.push("## Guion de producción", "");
    for (const block of c.blocks ?? []) {
      lines.push(`### ${block.name} — ${block.duration}`, "");
      for (const line of block.lines ?? []) {
        lines.push(`- **[${line.tag}]** "${line.text}"`);
      }
      lines.push("");
    }
    if (c.music_a || c.music_b) {
      lines.push("---", "", "## Música", "");
      if (c.music_a) {
        lines.push(
          `### Estilo A (0–30s): ${c.music_a.name}`,
          `_${c.music_a.why}_`,
          "",
          `\`${c.music_a.prompt}\``,
          ""
        );
      }
      if (c.music_b) {
        lines.push(
          `### Estilo B (30–60s): ${c.music_b.name}`,
          `_${c.music_b.why}_`,
          "",
          `\`${c.music_b.prompt}\``,
          ""
        );
      }
    }
  } else {
    const c = content as CarouselContent;
    lines.push("## Slides", "");
    for (const slide of c.slides ?? []) {
      lines.push(`### Slide ${slide.number}`, "");
      lines.push(`**${slide.text}**`, "");
      lines.push(`_Visual:_ ${slide.visual}`, "");
      if (slide.micro_anchor) lines.push(`↳ ${slide.micro_anchor}`, "");
    }
  }

  return lines.join("\n");
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

// ── Main component ───────────────────────────────────────────────────────────

type Props = {
  script: ScriptRow;
  versions: ScriptVersion[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ScriptDetailClient({ script, versions }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [editContent, setEditContent] = useState<Record<string, unknown>>(
    script.content
  );
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isUpdatingStatus, startStatusTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<ScriptStatus>(script.status ?? "idea");
  const downloadRef = useRef<HTMLDivElement>(null);

  const isReel = script.type === "reel";
  const content = script.content as ReelContent | CarouselContent;
  const showVersions = versions.length > 1;

  // Cierra el menú de descarga al hacer click fuera
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
    const text =
      format === "txt"
        ? buildTxt(script, content)
        : buildMd(script, content);
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
        router.push(`/guiones/${newId}`);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  function handleAiApply(newContent: Record<string, unknown>) {
    startTransition(async () => {
      try {
        const newId = await saveScriptVersion(script.id, newContent);
        router.push(`/guiones/${newId}`);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  function handleDelete() {
    if (!confirm("¿Eliminar este guion y todas sus versiones? Esta acción no se puede deshacer.")) return;
    startDeleteTransition(async () => {
      await deleteScript(script.id);
    });
  }

  function handleStatusChange(newStatus: ScriptStatus) {
    setCurrentStatus(newStatus);
    startStatusTransition(async () => {
      await updateScriptStatus(script.id, newStatus);
    });
  }

  return (
    <div className={styles.detailPage}>
      {/* ── Header ── */}
      <div className={styles.detailHeader}>
        <div className={styles.detailMeta}>
          <Link
            href="/guiones"
            style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
          >
            ← Guiones
          </Link>
          <p className={styles.detailClientName}>
            {script.clients?.nombre ?? "—"}
            {script.clients?.marca ? ` — ${script.clients.marca}` : ""}
          </p>
          <h1 className={styles.detailTitle}>{script.structure_name}</h1>
          <p className={styles.detailSubtitle}>
            <span
              className={`${styles.typeBadge} ${styles[script.type]}`}
              style={{ display: "inline-flex", marginRight: 8 }}
            >
              {isReel ? "Reel" : "Carrusel"}
            </span>
            {formatDate(script.created_at)}
          </p>
        </div>

        <div className={styles.detailActions}>
          {/* Status selector */}
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
          <Link href="/guiones/nuevo" className="btn btn-primary">
            + Nuevo guion
          </Link>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="btn btn-ghost"
            style={{ color: "var(--flare)" }}
          >
            {isDeleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>

      {/* ── Selector de versiones ── */}
      {showVersions && (
        <div className={styles.versionBar}>
          <span className={styles.versionBarLabel}>Versiones:</span>
          {versions.map((v) => (
            <Link
              key={v.id}
              href={`/guiones/${v.id}`}
              className={`${styles.versionPill} ${v.id === script.id ? styles.versionPillActive : ""}`}
            >
              v{v.version_number}
              {v.is_latest && <span className={styles.versionLatestDot} />}
            </Link>
          ))}
        </div>
      )}

      {/* ── Barra de acciones de edición ── */}
      <div className={styles.actionBar}>
        <div className={styles.actionBarLeft}>
          <button
            onClick={() => {
              if (mode === "edit-manual") {
                handleCancelEdit();
              } else {
                setMode("edit-manual");
                setEditContent(script.content);
              }
            }}
            className={`btn ${mode === "edit-manual" ? "btn-secondary" : "btn-ghost"}`}
          >
            {mode === "edit-manual" ? "✕ Cancelar" : "Editar manualmente"}
          </button>
          <button
            onClick={() => setMode(mode === "edit-ai" ? "view" : "edit-ai")}
            className={`btn ${mode === "edit-ai" ? "btn-secondary" : "btn-ghost"}`}
          >
            {mode === "edit-ai" ? "✕ Cerrar IA" : "✦ Editar con IA"}
          </button>
        </div>

        <div className={styles.actionBarRight}>
          {isReel && (
            <button
              onClick={handleCopy}
              className={`btn btn-ghost ${copied ? styles.copiedState : ""}`}
            >
              {copied ? "¡Copiado!" : "Copiar voz en off"}
            </button>
          )}

          <div ref={downloadRef} style={{ position: "relative" }}>
            <button
              onClick={() => setDownloadMenuOpen((o) => !o)}
              className="btn btn-ghost"
            >
              Descargar ↓
            </button>
            {downloadMenuOpen && (
              <div className={styles.downloadMenu}>
                <button
                  className={styles.downloadMenuItem}
                  onClick={() => handleDownload("txt")}
                >
                  <span className={styles.downloadExt}>.txt</span>
                  <span className={styles.downloadDesc}>Texto plano</span>
                </button>
                <button
                  className={styles.downloadMenuItem}
                  onClick={() => handleDownload("md")}
                >
                  <span className={styles.downloadExt}>.md</span>
                  <span className={styles.downloadDesc}>Markdown</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Guardar edición manual ── */}
      {mode === "edit-manual" && (
        <div className={styles.saveBar}>
          {saveError && <span className={styles.saveError}>{saveError}</span>}
          <button
            onClick={handleSaveManual}
            disabled={isPending}
            className="btn btn-primary"
          >
            {isPending ? "Guardando…" : "Guardar como nueva versión"}
          </button>
        </div>
      )}

      {/* ── Brief ── */}
      <div className={styles.briefBox}>
        <p className={styles.briefLabel}>Brief</p>
        <p className={styles.briefText}>{script.brief}</p>
      </div>

      {/* ── Panel IA ── */}
      {mode === "edit-ai" && (
        <AiEditPanel
          content={script.content}
          type={script.type}
          clientId={script.client_id}
          brief={script.brief}
          onApply={handleAiApply}
          onClose={() => setMode("view")}
          saving={isPending}
        />
      )}

      {/* ── Contenido ── */}
      {mode === "edit-manual" ? (
        isReel ? (
          <ReelEditor
            content={editContent as ReelContent}
            onChange={setEditContent}
          />
        ) : (
          <CarouselEditor
            content={editContent as CarouselContent}
            onChange={setEditContent}
          />
        )
      ) : isReel ? (
        <ReelViewer content={content as ReelContent} />
      ) : (
        <CarouselViewer content={content as CarouselContent} />
      )}
    </div>
  );
}
