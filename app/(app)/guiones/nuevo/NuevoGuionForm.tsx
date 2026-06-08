"use client";

import { useState, useTransition } from "react";
import { saveScript } from "../actions";
import styles from "../guiones.module.css";

type Cliente = { id: string; nombre: string; marca: string | null };

type Structure = {
  name: string;
  hook: string;
  arc: string;
  close: string;
};

type StructuresResponse = {
  discarded: { name: string; reason: string };
  structures: Structure[];
};

type ReelLine = { tag: string; text: string };
type ReelBlock = { name: string; duration: string; lines: ReelLine[] };
type MusicRec = { name: string; why: string; prompt: string };

type ReelContent = {
  voice_off: string;
  blocks: ReelBlock[];
  music_a: MusicRec;
  music_b: MusicRec;
};

type CarouselSlide = {
  number: number;
  text: string;
  visual: string;
  micro_anchor: string | null;
};

type CarouselContent = { slides: CarouselSlide[] };

type ScriptContent = ReelContent | CarouselContent;

function isReel(c: ScriptContent): c is ReelContent {
  return "blocks" in c;
}

type Step = 1 | 2 | 3;

const STEP_LABELS = ["Brief", "Estructura", "Guion"];

// ── Step indicator ──
function Steps({ current }: { current: Step }) {
  return (
    <div className={styles.steps}>
      {STEP_LABELS.map((label, i) => {
        const num = (i + 1) as Step;
        const cls =
          num === current ? "active" : num < current ? "done" : "";
        return (
          <>
            <div key={num} className={`${styles.step} ${cls ? styles[cls] : ""}`}>
              <div className={styles.stepNum}>
                {num < current ? "✓" : num}
              </div>
              <span>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div key={`line-${i}`} className={styles.stepLine} />
            )}
          </>
        );
      })}
    </div>
  );
}

// ── Reel viewer ──
function ReelViewer({ content }: { content: ReelContent }) {
  return (
    <div className={styles.scriptContainer}>
      <div className={styles.voiceOff}>
        <p className={styles.voiceOffLabel}>Voz en off (teleprompter)</p>
        <p className={styles.voiceOffText}>{content.voice_off}</p>
      </div>

      <p className={styles.sectionTitle}>Guion de producción</p>
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

// ── Carousel viewer ──
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

// ── Main form ──
export default function NuevoGuionForm({ clientes }: { clientes: Cliente[] }) {
  const [step, setStep] = useState<Step>(1);
  const [clientId, setClientId] = useState(clientes[0]?.id ?? "");
  const [type, setType] = useState<"reel" | "carousel">("reel");
  const [brief, setBrief] = useState("");
  const [structuresData, setStructuresData] = useState<StructuresResponse | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<Structure | null>(null);
  const [scriptContent, setScriptContent] = useState<ScriptContent | null>(null);
  const [brainVersionId, setBrainVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleProposeStructures() {
    if (!clientId || !brief.trim()) {
      setError("Selecciona un cliente y escribe el brief.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, brief, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al proponer estructuras");
      setStructuresData(data);
      setSelectedStructure(data.structures?.[0] ?? null);
      setStep(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateScript() {
    if (!selectedStructure) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          brief,
          type,
          structure_name: selectedStructure.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al generar guion");
      setScriptContent(data.content);
      setBrainVersionId(data.brain_version_id ?? null);
      setStep(3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
    if (!scriptContent || !selectedStructure) return;
    startTransition(async () => {
      await saveScript({
        client_id: clientId,
        type,
        brief,
        structure_name: selectedStructure.name,
        content: scriptContent as Record<string, unknown>,
        brain_version_id: brainVersionId,
      });
    });
  }

  return (
    <>
      <Steps current={step} />

      {/* ── PASO 1: Brief ── */}
      {step === 1 && (
        <div className="card" style={{ padding: 28 }}>
          <div className="field">
            <label className="field-label">Cliente</label>
            <select
              className="input"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}{c.marca ? ` — ${c.marca}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label className="field-label">Tipo de contenido</label>
            <div className={styles.typeToggle}>
              <button
                type="button"
                className={`${styles.typeBtn} ${type === "reel" ? styles.active : ""}`}
                onClick={() => setType("reel")}
              >
                Reel
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${type === "carousel" ? styles.active : ""}`}
                onClick={() => setType("carousel")}
              >
                Carrusel
              </button>
            </div>
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label className="field-label">Brief</label>
            <textarea
              className="textarea"
              rows={5}
              placeholder="Describe el tema, el objetivo y cualquier ángulo o dato relevante para este guion..."
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>

          {error && <p className={styles.formError}>{error}</p>}

          <div className={styles.formActions}>
            {loading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner} />
                <p className={styles.loadingText}>Analizando brief y proponiendo estructuras…</p>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleProposeStructures}
                disabled={!clientId || !brief.trim()}
              >
                Proponer estructuras →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── PASO 2: Estructuras ── */}
      {step === 2 && structuresData && (
        <div>
          <div className={styles.structuresGrid}>
            {structuresData.structures.map((s) => (
              <div
                key={s.name}
                className={`${styles.structureCard} ${selectedStructure?.name === s.name ? styles.selected : ""}`}
                onClick={() => setSelectedStructure(s)}
              >
                <div className={styles.structureRadio} />
                <div className={styles.structureBody}>
                  <p className={styles.structureName}>{s.name}</p>
                  <div className={styles.structureRows}>
                    <div className={styles.structureRow}>
                      <span className={styles.structureRowLabel}>Hook</span>
                      <span className={styles.structureRowText}>{s.hook}</span>
                    </div>
                    <div className={styles.structureRow}>
                      <span className={styles.structureRowLabel}>Arco</span>
                      <span className={styles.structureRowText}>{s.arc}</span>
                    </div>
                    <div className={styles.structureRow}>
                      <span className={styles.structureRowLabel}>Cierre</span>
                      <span className={styles.structureRowText}>{s.close}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className={styles.discarded}>
            Descartada: <strong>{structuresData.discarded.name}</strong> —{" "}
            {structuresData.discarded.reason}
          </p>

          {error && <p className={styles.formError} style={{ marginTop: 12 }}>{error}</p>}

          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p className={styles.loadingText}>Generando guion completo…</p>
            </div>
          ) : (
            <div className={styles.formActions}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setStep(1); setError(null); }}
              >
                ← Cambiar brief
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerateScript}
                disabled={!selectedStructure}
              >
                Generar guion →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PASO 3: Guion ── */}
      {step === 3 && scriptContent && (
        <div>
          {isReel(scriptContent) ? (
            <ReelViewer content={scriptContent} />
          ) : (
            <CarouselViewer content={scriptContent as CarouselContent} />
          )}

          {error && <p className={styles.formError} style={{ marginTop: 16 }}>{error}</p>}

          <div className={styles.formActions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setStep(2); setError(null); }}
            >
              ← Cambiar estructura
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleGenerateScript}
              disabled={loading}
            >
              Regenerar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? "Guardando…" : "Guardar guion"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
