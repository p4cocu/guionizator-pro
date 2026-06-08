"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveScriptSilent } from "../actions";
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

type GeneratedScript = {
  structure: Structure;
  content: ScriptContent;
  brainVersionId: string | null;
  savedId: string | null;
  regenerating: boolean;
};

type Step = 1 | 2 | 3;
const STEP_LABELS = ["Brief", "Estructuras", "Guiones"];

// ── Step indicator ──────────────────────────────────────────────────────────

function Steps({ current }: { current: Step }) {
  return (
    <div className={styles.steps}>
      {STEP_LABELS.map((label, i) => {
        const num = (i + 1) as Step;
        const cls = num === current ? "active" : num < current ? "done" : "";
        return (
          <>
            <div key={num} className={`${styles.step} ${cls ? styles[cls] : ""}`}>
              <div className={styles.stepNum}>{num < current ? "✓" : num}</div>
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

// ── Viewers ─────────────────────────────────────────────────────────────────

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

// ── Main form ────────────────────────────────────────────────────────────────

export default function NuevoGuionForm({ clientes }: { clientes: Cliente[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [clientId, setClientId] = useState(clientes[0]?.id ?? "");
  const [type, setType] = useState<"reel" | "carousel">("reel");
  const [brief, setBrief] = useState("");
  const [structuresData, setStructuresData] = useState<StructuresResponse | null>(null);
  const [selectedStructures, setSelectedStructures] = useState<Structure[]>([]);
  const [generatedScripts, setGeneratedScripts] = useState<GeneratedScript[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // ── Helpers ─────────────────────────────────────────────────────────────

  function isSelected(s: Structure) {
    return selectedStructures.some((x) => x.name === s.name);
  }

  function toggleStructure(s: Structure) {
    setSelectedStructures((prev) =>
      isSelected(s) ? prev.filter((x) => x.name !== s.name) : [...prev, s]
    );
  }

  async function fetchScript(
    structureName: string
  ): Promise<{ content: ScriptContent; brain_version_id: string | null }> {
    const res = await fetch("/api/ai/script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        brief,
        type,
        structure_name: structureName,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Error al generar guion");
    return data;
  }

  // ── Step 1 → 2 ──────────────────────────────────────────────────────────

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
      setSelectedStructures(data.structures ?? []);
      setStep(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2 → 3 ──────────────────────────────────────────────────────────

  async function handleGenerateScripts() {
    if (!selectedStructures.length) return;
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        selectedStructures.map((s) => fetchScript(s.name))
      );
      setGeneratedScripts(
        selectedStructures.map((s, i) => ({
          structure: s,
          content: results[i].content,
          brainVersionId: results[i].brain_version_id ?? null,
          savedId: null,
          regenerating: false,
        }))
      );
      setActiveTab(0);
      setStep(3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── Regenerate one tab ───────────────────────────────────────────────────

  async function handleRegenerate(idx: number) {
    setGeneratedScripts((prev) =>
      prev.map((g, i) => (i === idx ? { ...g, regenerating: true } : g))
    );
    setError(null);
    try {
      const data = await fetchScript(generatedScripts[idx].structure.name);
      setGeneratedScripts((prev) =>
        prev.map((g, i) =>
          i === idx
            ? {
                ...g,
                content: data.content,
                brainVersionId: data.brain_version_id ?? null,
                savedId: null,
                regenerating: false,
              }
            : g
        )
      );
    } catch (e) {
      setError((e as Error).message);
      setGeneratedScripts((prev) =>
        prev.map((g, i) => (i === idx ? { ...g, regenerating: false } : g))
      );
    }
  }

  // ── Save one ─────────────────────────────────────────────────────────────

  function handleSave(idx: number) {
    const g = generatedScripts[idx];
    startTransition(async () => {
      try {
        const id = await saveScriptSilent({
          client_id: clientId,
          type,
          brief,
          structure_name: g.structure.name,
          content: g.content as Record<string, unknown>,
          brain_version_id: g.brainVersionId,
        });
        setGeneratedScripts((prev) =>
          prev.map((x, i) => (i === idx ? { ...x, savedId: id } : x))
        );
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const allSaved =
    generatedScripts.length > 0 && generatedScripts.every((g) => g.savedId);
  const anySaved = generatedScripts.some((g) => g.savedId);

  // ── Render ───────────────────────────────────────────────────────────────

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
                  {c.nombre}
                  {c.marca ? ` — ${c.marca}` : ""}
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

      {/* ── PASO 2: Estructuras (multi-select) ── */}
      {step === 2 && structuresData && (
        <div>
          <p className={styles.multiSelectHint}>
            Selecciona una o más estructuras para desarrollar en detalle.
          </p>

          <div className={styles.structuresGrid}>
            {structuresData.structures.map((s) => {
              const selected = isSelected(s);
              return (
                <div
                  key={s.name}
                  className={`${styles.structureCard} ${selected ? styles.selected : ""}`}
                  onClick={() => toggleStructure(s)}
                >
                  <div
                    className={`${styles.structureRadio} ${selected ? styles.structureCheck : ""}`}
                  >
                    {selected && <span className={styles.checkMark}>✓</span>}
                  </div>
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
              );
            })}
          </div>

          <p className={styles.discarded}>
            Descartada: <strong>{structuresData.discarded.name}</strong> —{" "}
            {structuresData.discarded.reason}
          </p>

          {error && (
            <p className={styles.formError} style={{ marginTop: 12 }}>
              {error}
            </p>
          )}

          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p className={styles.loadingText}>
                Generando {selectedStructures.length}{" "}
                {selectedStructures.length === 1 ? "guion" : "guiones"}…
              </p>
            </div>
          ) : (
            <div className={styles.formActions}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
              >
                ← Cambiar brief
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerateScripts}
                disabled={!selectedStructures.length}
              >
                Generar {selectedStructures.length || ""}{" "}
                {selectedStructures.length === 1 ? "guion" : "guiones"} →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PASO 3: Guiones con tabs ── */}
      {step === 3 && generatedScripts.length > 0 && (
        <div>
          {/* Tabs */}
          {generatedScripts.length > 1 && (
            <div className={styles.scriptTabs}>
              {generatedScripts.map((g, i) => (
                <button
                  key={i}
                  className={`${styles.scriptTab} ${activeTab === i ? styles.scriptTabActive : ""} ${g.savedId ? styles.scriptTabSaved : ""}`}
                  onClick={() => setActiveTab(i)}
                >
                  <span className={styles.scriptTabIdx}>Idea {i + 1}</span>
                  <span className={styles.scriptTabName}>{g.structure.name}</span>
                  {g.savedId && <span className={styles.scriptTabDot}>✓</span>}
                </button>
              ))}
            </div>
          )}

          {/* Contenido del tab activo */}
          {(() => {
            const g = generatedScripts[activeTab];
            if (!g) return null;
            return (
              <div>
                {g.regenerating ? (
                  <div className={styles.loadingState}>
                    <div className={styles.spinner} />
                    <p className={styles.loadingText}>Regenerando {g.structure.name}…</p>
                  </div>
                ) : isReel(g.content) ? (
                  <ReelViewer content={g.content} />
                ) : (
                  <CarouselViewer content={g.content as CarouselContent} />
                )}

                {error && (
                  <p className={styles.formError} style={{ marginTop: 16 }}>
                    {error}
                  </p>
                )}

                <div className={styles.formActions}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setStep(2);
                      setError(null);
                    }}
                  >
                    ← Cambiar estructuras
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleRegenerate(activeTab)}
                    disabled={g.regenerating}
                  >
                    Regenerar
                  </button>
                  {g.savedId ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ color: "var(--emerald)" }}
                      onClick={() => router.push(`/guiones/${g.savedId}`)}
                    >
                      ✓ Ver guion →
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleSave(activeTab)}
                      disabled={g.regenerating}
                    >
                      Guardar guion
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Ir a biblioteca cuando ya guardó algo */}
          {anySaved && (
            <div className={styles.savedBanner}>
              {allSaved
                ? `${generatedScripts.length} guion${generatedScripts.length > 1 ? "es guardados" : " guardado"}`
                : `${generatedScripts.filter((g) => g.savedId).length} de ${generatedScripts.length} guardados`}
              <button
                className="btn btn-ghost"
                onClick={() => router.push("/guiones")}
              >
                Ver en biblioteca →
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
