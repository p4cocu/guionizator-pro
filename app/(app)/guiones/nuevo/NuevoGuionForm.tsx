"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveScriptSilent, linkScriptToCalendar, saveScriptWithNewIdea } from "../actions";
import { suggestProductIdeas, suggestProductQuestions } from "./productActions";
import { saveProductField } from "../../clientes/productActions";
import {
  IDEA_STAGES,
  appendProductAnswers,
  type ProductIdea,
  type ProductQuestion,
} from "@/lib/ai/productPrompts";
import type { ProductOption } from "@/lib/products/fields";
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

type MicroStory = { id: number; title: string; text: string };

type ReelLine = { tag: string; text: string };
type ReelBlock = { name: string; duration: string; lines: ReelLine[] };
type MusicRec = { name: string; why: string; prompt: string };
type ScriptSource = { title: string; type: string; description: string };
type ReelContent = {
  voice_off: string;
  blocks: ReelBlock[];
  music_a: MusicRec;
  music_b: MusicRec;
  source?: ScriptSource;
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

function isAlborna(name: string) {
  return name.toLowerCase().includes("alborna");
}

type InlineAiOption = { label: string; content: ScriptContent };
type InlineAiState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "picking"; original: ScriptContent; options: InlineAiOption[] };

type GeneratedScript = {
  structure: Structure;
  content: ScriptContent;
  brainVersionId: string | null;
  savedId: string | null;
  regenerating: boolean;
  inlineAi: InlineAiState;
  customTitle: string;
};

// Step 1=Brief, 2=BigIdea, 3=Estructuras, 4=Guiones
type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ["Brief", "Big Idea", "Estructuras", "Guiones"];

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
  const hasBlocks = (content.blocks?.length ?? 0) > 0;
  return (
    <div className={styles.scriptContainer}>
      <div className={styles.voiceOff}>
        <p className={styles.voiceOffLabel}>Voz en off (teleprompter)</p>
        <p className={styles.voiceOffText}>{content.voice_off}</p>
      </div>
      <div className={styles.sectionTitleRow} style={{ marginTop: 8 }}>
        <p className={styles.sectionTitle}>Guion de producción</p>
      </div>
      {!hasBlocks && (
        <p className={styles.emptyBlocks}>
          El guión de producción se genera desde la vista del guion una vez pulida la voz en off.
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
      {content.source && (
        <div className={styles.sourceCard}>
          <p className={styles.sourceCardLabel}>Fuente / Inspiración</p>
          <p className={styles.sourceCardTitle}>{content.source.title}</p>
          <span className={styles.sourceCardType}>{content.source.type}</span>
          {content.source.description && (
            <p className={styles.sourceCardDesc}>{content.source.description}</p>
          )}
        </div>
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

// ── Inline AI chat (step 4) ─────────────────────────────────────────────────

type InlineAiChatProps = {
  state: InlineAiState;
  onSubmit: (instruction: string) => void;
  onSelect: (content: ScriptContent) => void;
  onKeepOriginal: () => void;
};

function InlineAiChat({ state, onSubmit, onSelect, onKeepOriginal }: InlineAiChatProps) {
  const [instruction, setInstruction] = useState("");

  function handleSubmit() {
    if (!instruction.trim() || state.phase === "loading") return;
    onSubmit(instruction.trim());
    setInstruction("");
  }

  return (
    <div className={styles.inlineAiPanel}>
      <div className={styles.inlineAiHeader}>
        <span className={styles.inlineAiTitle}>✦ Editar con IA</span>
      </div>

      {state.phase === "picking" && (
        <div className={styles.inlineAiOptions}>
          <p className={styles.inlineAiOptionsLabel}>
            Elige la versión que prefieres:
          </p>
          <div className={styles.inlineAiOptionsList}>
            {state.options.map((opt, i) => (
              <button
                key={i}
                className={styles.inlineAiOption}
                onClick={() => onSelect(opt.content)}
              >
                <span className={styles.inlineAiOptionLabel}>{opt.label}</span>
                <span className={styles.inlineAiOptionArrow}>→</span>
              </button>
            ))}
            <button
              className={`${styles.inlineAiOption} ${styles.inlineAiOptionOriginal}`}
              onClick={onKeepOriginal}
            >
              <span className={styles.inlineAiOptionLabel}>Mantener original</span>
              <span className={styles.inlineAiOptionArrow}>✕</span>
            </button>
          </div>
        </div>
      )}

      <div className={styles.inlineAiBody}>
        <textarea
          className="textarea"
          rows={2}
          placeholder="Ej: el hook no me convence, genera 3 alternativas · el cierre usa lenguaje más simple, dame 2 propuestas"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
          disabled={state.phase === "loading"}
        />
        <div className={styles.inlineAiFooter}>
          {state.phase === "loading" && (
            <div className={styles.inlineAiLoading}>
              <div className={styles.spinnerSm} />
              <span>Generando alternativas…</span>
            </div>
          )}
          <button
            className="btn btn-ghost"
            style={{ marginLeft: "auto" }}
            onClick={handleSubmit}
            disabled={!instruction.trim() || state.phase === "loading"}
          >
            Aplicar →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main form ────────────────────────────────────────────────────────────────

export default function NuevoGuionForm({
  clientes,
  products: initialProducts = [],
  initialProductId,
  initialBrief,
  initialClientId,
  initialCalendarId,
  initialType,
  initialSourcePostPermalink,
  initialSourcePostId,
}: {
  clientes: Cliente[];
  /** Servicios de todas las marcas del dueño; se filtran por la elegida (0016). */
  products?: ProductOption[];
  initialProductId?: string;
  initialBrief?: string;
  initialClientId?: string;
  initialCalendarId?: string;
  initialType?: "reel" | "carousel";
  initialSourcePostPermalink?: string;
  initialSourcePostId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [clientId, setClientId] = useState(
    initialClientId && clientes.some((c) => c.id === initialClientId)
      ? initialClientId
      : (clientes[0]?.id ?? "")
  );
  const [type, setType] = useState<"reel" | "carousel">(initialType ?? "reel");
  const [brief, setBrief] = useState(initialBrief ?? "");

  // Step 1 — servicio que promueve el guion (ficha de oferta, migración 0016).
  // Estado local: al guardar una respuesta en la ficha se actualiza `missing`
  // para no volver a preguntarla en esta misma sesión.
  const [products, setProducts] = useState<ProductOption[]>(initialProducts);
  const [productId, setProductId] = useState<string>(() => {
    const p = initialProducts.find((x) => x.id === initialProductId);
    return p && p.client_id === clientId ? p.id : "";
  });
  const clientProducts = products.filter((p) => p.client_id === clientId);
  const selectedProduct = clientProducts.find((p) => p.id === productId) ?? null;

  const [ideas, setIdeas] = useState<ProductIdea[] | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [pickedIdeaId, setPickedIdeaId] = useState<string | null>(null);

  // Preguntas de afinado: se piden UNA vez por servicio al generar la Big Idea.
  const [questions, setQuestions] = useState<ProductQuestion[] | null>(null);
  const [questionsFor, setQuestionsFor] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saveToFicha, setSaveToFicha] = useState<Record<string, boolean>>({});

  // Step 2 state — Big Idea
  const [bigIdea, setBigIdea] = useState("");
  const [editingBigIdea, setEditingBigIdea] = useState(false);

  // Step 3 state — Structures
  const [structuresData, setStructuresData] = useState<StructuresResponse | null>(null);
  const [selectedStructures, setSelectedStructures] = useState<Structure[]>([]);

  // Step 3 sub-state — Micro-historias (Julian Alborna)
  const [showMicroStories, setShowMicroStories] = useState(false);
  const [microStories, setMicroStories] = useState<MicroStory[]>([]);
  const [selectedMicroStory, setSelectedMicroStory] = useState<string>("");
  const [editingMicroStory, setEditingMicroStory] = useState(false);
  const [customMicroStory, setCustomMicroStory] = useState("");

  // Step 4 state — Generated scripts
  const [generatedScripts, setGeneratedScripts] = useState<GeneratedScript[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const hasAlbornaSelected = selectedStructures.some((s) => isAlborna(s.name));

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
    s: Structure
  ): Promise<{ content: ScriptContent; brain_version_id: string | null }> {
    const microStoryText = isAlborna(s.name)
      ? (editingMicroStory ? customMicroStory : selectedMicroStory)
      : undefined;

    const res = await fetch("/api/ai/script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        brief,
        type,
        structure_name: s.name,
        structure: { hook: s.hook, arc: s.arc, close: s.close },
        big_idea: bigIdea || undefined,
        micro_story: microStoryText || undefined,
        product_id: productId || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Error al generar guion");
    return data;
  }

  // ── Step 1: servicio, ideas y preguntas de afinado (0016) ────────────────

  function resetProductHelpers() {
    setIdeas(null);
    setIdeasError(null);
    setPickedIdeaId(null);
    setQuestions(null);
    setQuestionsFor(null);
    setAnswers({});
    setSaveToFicha({});
  }

  function handleClientChange(id: string) {
    setClientId(id);
    setProductId("");
    resetProductHelpers();
  }

  function handleProductChange(id: string) {
    setProductId(id);
    resetProductHelpers();
  }

  async function handleSuggestIdeas() {
    if (!selectedProduct) return;
    setIdeasLoading(true);
    setIdeasError(null);
    try {
      const list = await suggestProductIdeas({
        client_id: clientId,
        product_id: selectedProduct.id,
        // Mezcla de reels y carruseles: el formato se decide por idea, y
        // elegir una idea ya cambia el tipo arriba.
        type: null,
        // Un brief escrito a mano sirve para proponer ángulos distintos; uno
        // que salió de una idea elegida, no.
        brief: pickedIdeaId ? null : brief,
      });
      setIdeas(list);
      setPickedIdeaId(null);
    } catch (e) {
      setIdeasError(e instanceof Error ? e.message : "No se pudieron generar ideas");
    } finally {
      setIdeasLoading(false);
    }
  }

  function handlePickIdea(idea: ProductIdea) {
    setPickedIdeaId(idea.id);
    setType(idea.format);
    setBrief(`${idea.brief}\n\nGancho sugerido: "${idea.hook}"`);
  }

  // ── Step 1 → 2: Generate Big Idea ────────────────────────────────────────

  async function handleGenerateBigIdea() {
    if (!clientId || !brief.trim()) {
      setError("Selecciona un cliente y escribe el brief.");
      return;
    }

    // Si a la ficha le faltan campos clave, 1-2 preguntas antes (una vez por
    // servicio). Si la IA no devuelve ninguna, se sigue directo.
    if (selectedProduct && selectedProduct.missing.length > 0 && questionsFor !== selectedProduct.id) {
      setLoading(true);
      setError(null);
      try {
        const qs = await suggestProductQuestions({
          client_id: clientId,
          product_id: selectedProduct.id,
          brief,
        });
        setQuestionsFor(selectedProduct.id);
        if (qs.length > 0) {
          setQuestions(qs);
          setAnswers({});
          setSaveToFicha(Object.fromEntries(qs.map((q) => [q.id, true])));
          setLoading(false);
          return;
        }
      } catch {
        // Las preguntas son un plus: si fallan, no se frena el guion.
        setQuestionsFor(selectedProduct.id);
      }
    }

    await runBigIdea(brief);
  }

  async function handleContinueWithAnswers() {
    if (!questions) return;
    const finalBrief = appendProductAnswers(brief, questions, answers);

    // Guardar en la ficha lo marcado. Best effort: si falla, el guion sigue
    // (la respuesta ya viaja en el brief) y la pregunta volverá la próxima vez.
    const toSave = questions.filter((q) => saveToFicha[q.id] && (answers[q.id] ?? "").trim());
    if (selectedProduct && toSave.length > 0) {
      setLoading(true);
      const results = await Promise.allSettled(
        toSave.map((q) =>
          saveProductField({ productId: selectedProduct.id, field: q.field, value: answers[q.id] }),
        ),
      );
      const savedFields = toSave.filter((_, i) => results[i].status === "fulfilled").map((q) => q.field);
      if (savedFields.length > 0) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === selectedProduct.id
              ? { ...p, missing: p.missing.filter((k) => !savedFields.includes(k)) }
              : p,
          ),
        );
      }
    }

    setBrief(finalBrief);
    setQuestions(null);
    await runBigIdea(finalBrief);
  }

  async function handleSkipQuestions() {
    setQuestions(null);
    await runBigIdea(brief);
  }

  async function runBigIdea(briefText: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/big-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          brief: briefText,
          type,
          product_id: productId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al generar Big Idea");
      setBigIdea(data.big_idea ?? "");
      setEditingBigIdea(false);
      setStep(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2 → 3: Propose structures ───────────────────────────────────────

  async function handleProposeStructures() {
    if (!bigIdea.trim()) {
      setError("La Big Idea no puede estar vacía.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          brief,
          type,
          big_idea: bigIdea,
          product_id: productId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al proponer estructuras");
      setStructuresData(data);
      setSelectedStructures(data.structures ?? []);
      setShowMicroStories(false);
      setMicroStories([]);
      setSelectedMicroStory("");
      setEditingMicroStory(false);
      setCustomMicroStory("");
      setStep(3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: Fetch micro-stories for Alborna, then generate ───────────────

  async function handleGenerateOrMicroStories() {
    if (!selectedStructures.length) return;

    // If Alborna is selected and we haven't shown micro-stories yet, fetch them first
    if (hasAlbornaSelected && !showMicroStories) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ai/micro-stories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ big_idea: bigIdea, brief }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error al generar micro-historias");
        setMicroStories(data.stories ?? []);
        setSelectedMicroStory(data.stories?.[0]?.text ?? "");
        setShowMicroStories(true);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Generate all scripts
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        selectedStructures.map((s) => fetchScript(s))
      );
      setGeneratedScripts(
        selectedStructures.map((s, i) => ({
          structure: s,
          content: results[i].content,
          brainVersionId: results[i].brain_version_id ?? null,
          savedId: null,
          regenerating: false,
          inlineAi: { phase: "idle" },
          customTitle: "",
        }))
      );
      setActiveTab(0);
      setStep(4);
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
      const data = await fetchScript(generatedScripts[idx].structure);
      setGeneratedScripts((prev) =>
        prev.map((g, i) =>
          i === idx
            ? {
                ...g,
                content: data.content,
                brainVersionId: data.brain_version_id ?? null,
                savedId: null,
                regenerating: false,
                inlineAi: { phase: "idle" },
                customTitle: g.customTitle,
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

  // ── Inline AI (step 4) ───────────────────────────────────────────────────

  async function handleInlineAiSubmit(idx: number, instruction: string) {
    const g = generatedScripts[idx];
    setGeneratedScripts((prev) =>
      prev.map((x, i) =>
        i === idx ? { ...x, inlineAi: { phase: "loading" } } : x
      )
    );
    try {
      const res = await fetch("/api/ai/script-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          brief,
          type,
          content: g.content,
          instruction,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al editar");
      const options: InlineAiOption[] = data.options ?? [];
      if (options.length === 1) {
        setGeneratedScripts((prev) =>
          prev.map((x, i) =>
            i === idx
              ? { ...x, content: options[0].content, savedId: null, inlineAi: { phase: "idle" } }
              : x
          )
        );
      } else {
        setGeneratedScripts((prev) =>
          prev.map((x, i) =>
            i === idx
              ? { ...x, inlineAi: { phase: "picking", original: x.content, options } }
              : x
          )
        );
      }
    } catch (e) {
      setError((e as Error).message);
      setGeneratedScripts((prev) =>
        prev.map((x, i) =>
          i === idx ? { ...x, inlineAi: { phase: "idle" } } : x
        )
      );
    }
  }

  function handleInlineAiSelect(idx: number, content: ScriptContent) {
    setGeneratedScripts((prev) =>
      prev.map((x, i) =>
        i === idx
          ? { ...x, content, savedId: null, inlineAi: { phase: "idle" } }
          : x
      )
    );
  }

  function handleInlineAiKeepOriginal(idx: number) {
    setGeneratedScripts((prev) =>
      prev.map((x, i) =>
        i === idx ? { ...x, inlineAi: { phase: "idle" } } : x
      )
    );
  }

  // ── Save one ─────────────────────────────────────────────────────────────

  function handleSave(idx: number) {
    const g = generatedScripts[idx];
    startTransition(async () => {
      try {
        const payload = {
          client_id: clientId,
          type,
          brief,
          structure_name: g.structure.name,
          title: g.customTitle.trim() || null,
          content: g.content as Record<string, unknown>,
          brain_version_id: g.brainVersionId,
          source_post_permalink: initialSourcePostPermalink ?? null,
          source_post_id: initialSourcePostId ?? null,
          product_id: productId || null,
        };
        let id: string;
        if (initialCalendarId) {
          // Viene de una idea del dashboard: guarda el favorito y vincúlalo
          // a esa idea (solo se permite uno).
          id = await saveScriptSilent(payload);
          await linkScriptToCalendar(id, initialCalendarId);
        } else {
          // Nace en la pestaña Guiones: crea también la idea en el dashboard.
          id = await saveScriptWithNewIdea(payload);
        }
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
  // Desde una idea del dashboard solo se guarda 1 guion: una vez elegido uno,
  // las demás versiones quedan bloqueadas como comparación descartada.
  const fromIdea = !!initialCalendarId;
  const lockOthers = fromIdea && anySaved;

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
              onChange={(e) => handleClientChange(e.target.value)}
            >
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.marca ? ` — ${c.marca}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Servicio que promueve (ficha de oferta, migración 0016). */}
          <div className="field" style={{ marginTop: 16 }}>
            <label className="field-label">¿Sobre qué producto o servicio? (opcional)</label>
            {clientProducts.length > 0 ? (
              <select
                className="input"
                value={productId}
                onChange={(e) => handleProductChange(e.target.value)}
              >
                <option value="">— Ninguno: contenido de marca —</option>
                {clientProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.tipo === "producto" ? "Producto" : "Servicio"}: {p.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <p className={styles.productPickerMeta} style={{ marginTop: 0 }}>
                Esta marca no tiene servicios cargados.{" "}
                <a href={`/clientes/${clientId}`}>Agregar en el perfil del cliente →</a>
              </p>
            )}

            {selectedProduct && (
              <div className={styles.productPickerMeta}>
                <span>Ficha {selectedProduct.completeness}%</span>
                <a href={`/clientes/${clientId}`} target="_blank" rel="noreferrer">
                  Editar ficha ↗
                </a>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "5px 12px", marginLeft: "auto" }}
                  onClick={handleSuggestIdeas}
                  disabled={ideasLoading}
                >
                  {ideasLoading ? "Pensando ideas…" : ideas ? "↻ Otras ideas" : "✦ Dame ideas para este servicio"}
                </button>
              </div>
            )}

            {ideasError && <p className={styles.formError}>{ideasError}</p>}

            {selectedProduct && ideas && ideas.length > 0 && (
              <div className={styles.productIdeas}>
                <div className={styles.productIdeasHead}>
                  <p className={styles.productIdeasTitle}>
                    Ideas para {selectedProduct.nombre} — elige una y se llena el brief
                  </p>
                </div>
                <div className={styles.productIdeasStages}>
                  {IDEA_STAGES.map((stage) => {
                    const list = ideas.filter((i) => i.stage === stage.id);
                    if (list.length === 0) return null;
                    return (
                      <div key={stage.id} className={styles.productIdeasStage}>
                        <span className={styles.productIdeasStageLabel}>
                          {stage.label}
                          <span className={styles.productIdeasStageHint}>{stage.hint}</span>
                        </span>
                        {list.map((idea) => (
                          <button
                            key={idea.id}
                            type="button"
                            className={`${styles.productIdea} ${pickedIdeaId === idea.id ? styles.productIdeaActive : ""}`}
                            onClick={() => handlePickIdea(idea)}
                            title={idea.brief}
                          >
                            <span className={styles.productIdeaMeta}>
                              <span className={`${styles.typeBadge} ${styles[idea.format]}`}>
                                {idea.format === "carousel" ? "Carrusel" : "Reel"}
                              </span>
                              {idea.angle}
                            </span>
                            <span className={styles.productIdeaHook}>&ldquo;{idea.hook}&rdquo;</span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
              onChange={(e) => {
                setBrief(e.target.value);
                setPickedIdeaId(null);
              }}
              disabled={!!questions}
            />
          </div>

          {/* Preguntas de afinado: la ficha no tiene un dato clave (0016). */}
          {questions && selectedProduct && (
            <div className={styles.productQuestions}>
              <p className={styles.productQuestionsIntro}>
                A la ficha de <strong>{selectedProduct.nombre}</strong> le falta algo que cambia el guion.
                Responde si quieres (es opcional):
              </p>
              {questions.map((q) => (
                <div key={q.id} className={styles.productQuestion}>
                  <label className="field-label">{q.question}</label>
                  <textarea
                    className="textarea"
                    rows={2}
                    placeholder={q.placeholder}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    disabled={loading}
                  />
                  <label className={styles.productQuestionSave}>
                    <input
                      type="checkbox"
                      checked={saveToFicha[q.id] ?? false}
                      onChange={(e) => setSaveToFicha((prev) => ({ ...prev, [q.id]: e.target.checked }))}
                      disabled={loading}
                    />
                    Guardar en la ficha para no volver a preguntarlo
                  </label>
                </div>
              ))}
            </div>
          )}

          {error && <p className={styles.formError}>{error}</p>}

          <div className={styles.formActions}>
            {loading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner} />
                <p className={styles.loadingText}>
                  {selectedProduct && questionsFor !== selectedProduct.id
                    ? "Revisando la ficha del servicio…"
                    : "Definiendo Big Idea…"}
                </p>
              </div>
            ) : questions ? (
              <>
                <button type="button" className="btn btn-ghost" onClick={handleSkipQuestions}>
                  Saltar
                </button>
                <button type="button" className="btn btn-primary" onClick={handleContinueWithAnswers}>
                  Continuar con Big Idea →
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerateBigIdea}
                disabled={!clientId || !brief.trim()}
              >
                Generar Big Idea →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── PASO 2: Big Idea ── */}
      {step === 2 && (
        <div>
          <div className={styles.bigIdeaCard}>
            <div className={styles.bigIdeaHeader}>
              <span className={styles.bigIdeaEyebrow}>Big Idea</span>
              <span className={styles.bigIdeaHint}>El mensaje central de este guion</span>
            </div>

            {editingBigIdea ? (
              <textarea
                className="textarea"
                rows={3}
                value={bigIdea}
                onChange={(e) => setBigIdea(e.target.value)}
                style={{ marginTop: 12 }}
                autoFocus
              />
            ) : (
              <p className={styles.bigIdeaText}>&ldquo;{bigIdea}&rdquo;</p>
            )}

            <div className={styles.bigIdeaActions}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditingBigIdea((v) => !v)}
              >
                {editingBigIdea ? "Listo" : "Editar"}
              </button>
            </div>
          </div>

          {error && <p className={styles.formError}>{error}</p>}

          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p className={styles.loadingText}>Analizando brief y proponiendo estructuras…</p>
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
                onClick={handleProposeStructures}
                disabled={!bigIdea.trim()}
              >
                Proponer estructuras →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PASO 3: Estructuras + sub-paso micro-historias ── */}
      {step === 3 && structuresData && (
        <div>
          {!showMicroStories ? (
            <>
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
                      <div className={`${styles.structureRadio} ${selected ? styles.structureCheck : ""}`}>
                        {selected && <span className={styles.checkMark}>✓</span>}
                      </div>
                      <div className={styles.structureBody}>
                        <p className={styles.structureName}>{s.name}</p>
                        {isAlborna(s.name) && (
                          <span className={styles.albornaTag}>✦ Alborna</span>
                        )}
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
            </>
          ) : (
            /* ── Sub-paso: Micro-historias (Alborna) ── */
            <div className={styles.microStoriesSection}>
              <div className={styles.microStoriesHeader}>
                <p className={styles.microStoriesTitle}>Elige la micro-historia de apertura</p>
                <p className={styles.microStoriesHint}>
                  Esta situación cotidiana abrirá el guion al estilo Julian Alborna — elige la que conecte más naturalmente con tu historia.
                </p>
              </div>

              <div className={styles.microStoriesList}>
                {microStories.map((story) => {
                  const isChosen = !editingMicroStory && selectedMicroStory === story.text;
                  return (
                    <div
                      key={story.id}
                      className={`${styles.microStoryCard} ${isChosen ? styles.microStorySelected : ""}`}
                      onClick={() => {
                        setSelectedMicroStory(story.text);
                        setEditingMicroStory(false);
                        setCustomMicroStory("");
                      }}
                    >
                      <div className={`${styles.microStoryRadio} ${isChosen ? styles.microStoryCheck : ""}`}>
                        {isChosen && <span className={styles.checkMark}>✓</span>}
                      </div>
                      <div className={styles.microStoryBody}>
                        <p className={styles.microStoryName}>{story.title}</p>
                        <p className={styles.microStoryText}>{story.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Editar/escribir propia */}
              <div className={styles.microStoryEditSection}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 13 }}
                  onClick={() => {
                    setEditingMicroStory((v) => !v);
                    if (!editingMicroStory) {
                      setCustomMicroStory(selectedMicroStory);
                    }
                  }}
                >
                  {editingMicroStory ? "← Volver a opciones" : "✎ Escribir la mía"}
                </button>
                {editingMicroStory && (
                  <textarea
                    className="textarea"
                    rows={4}
                    style={{ marginTop: 12 }}
                    placeholder="Escribe tu propia micro-historia cotidiana de apertura…"
                    value={customMicroStory}
                    onChange={(e) => setCustomMicroStory(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
            </div>
          )}

          {error && (
            <p className={styles.formError} style={{ marginTop: 12 }}>
              {error}
            </p>
          )}

          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p className={styles.loadingText}>
                {showMicroStories
                  ? `Generando ${selectedStructures.length} ${selectedStructures.length === 1 ? "guion" : "guiones"}…`
                  : "Generando opciones de apertura…"}
              </p>
            </div>
          ) : (
            <div className={styles.formActions}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (showMicroStories) {
                    setShowMicroStories(false);
                  } else {
                    setStep(2);
                  }
                  setError(null);
                }}
              >
                ← {showMicroStories ? "Cambiar estructuras" : "Cambiar Big Idea"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerateOrMicroStories}
                disabled={
                  !selectedStructures.length ||
                  (showMicroStories && editingMicroStory && !customMicroStory.trim()) ||
                  (showMicroStories && !editingMicroStory && !selectedMicroStory.trim())
                }
              >
                {showMicroStories
                  ? `Generar ${selectedStructures.length} ${selectedStructures.length === 1 ? "guion" : "guiones"} →`
                  : hasAlbornaSelected
                  ? "Elegir apertura →"
                  : `Generar ${selectedStructures.length || ""} ${selectedStructures.length === 1 ? "guion" : "guiones"} →`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PASO 4: Guiones con tabs ── */}
      {step === 4 && generatedScripts.length > 0 && (
        <div>
          {fromIdea && generatedScripts.length > 1 && !anySaved && (
            <p className={styles.multiSelectHint}>
              Vienes de una idea del dashboard: compara las versiones y guarda
              solo la que más te guste. Esa se vinculará a la idea.
            </p>
          )}

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

                {!g.regenerating && !g.savedId && !lockOthers && (
                  <InlineAiChat
                    state={g.inlineAi}
                    onSubmit={(instr) => handleInlineAiSubmit(activeTab, instr)}
                    onSelect={(c) => handleInlineAiSelect(activeTab, c)}
                    onKeepOriginal={() => handleInlineAiKeepOriginal(activeTab)}
                  />
                )}

                {!g.regenerating && !g.savedId && !lockOthers && (
                  <div className="field" style={{ marginTop: 16 }}>
                    <label className="field-label">Título de publicación (opcional)</label>
                    <input
                      className="input"
                      placeholder={`ej. 3 errores que cometen los emprendedores al escalar`}
                      value={g.customTitle}
                      onChange={(e) => setGeneratedScripts((prev) =>
                        prev.map((x, i) => i === activeTab ? { ...x, customTitle: e.target.value } : x)
                      )}
                    />
                    <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
                      Si lo dejas vacío, se usará la fórmula: "{g.structure.name}"
                    </p>
                  </div>
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
                      setStep(3);
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
                  ) : lockOthers ? (
                    <span
                      style={{
                        marginLeft: "auto",
                        alignSelf: "center",
                        fontSize: 13,
                        color: "var(--text-dim)",
                      }}
                    >
                      Ya elegiste una versión para esta idea.
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleSave(activeTab)}
                      disabled={g.regenerating || g.inlineAi.phase === "loading"}
                    >
                      Guardar guion
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {anySaved && (
            <div className={styles.savedBanner}>
              {fromIdea
                ? "Guion guardado y vinculado a la idea del dashboard"
                : allSaved
                ? `${generatedScripts.length} guion${generatedScripts.length > 1 ? "es guardados" : " guardado"} · ${generatedScripts.length > 1 ? "ideas creadas" : "idea creada"} en el calendario`
                : `${generatedScripts.filter((g) => g.savedId).length} de ${generatedScripts.length} guardados · ideas creadas en el calendario`}
              <button
                className="btn btn-ghost"
                onClick={() => router.push(fromIdea ? "/calendario" : "/guiones")}
              >
                {fromIdea ? "Volver al calendario →" : "Ver en biblioteca →"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
