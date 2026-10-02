"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ACCOUNT_PHASES,
  ANDREA_PILLARS,
  AWARENESS_LEVELS,
  FORMAT_STYLES,
  IDEA_SOURCES,
  MAX_PILLARS,
  PURPOSES,
  STRATEGY_FIELDS,
  WEEK_DAYS,
  formatStyleLabel,
  type AccountPhase,
  type AndreaPillar,
  type AwarenessLevel,
  type ContentIdea,
  type IdeaSource,
  type Pillar,
  type Strategy,
  type StrategyFieldKey,
} from "@/lib/strategy/pillars";
import { Layers } from "@/components/hooks/HookParts";
import StrategyTestForm from "@/components/strategy/StrategyTestForm";
import { testAnswersToText, type TestAnswers } from "@/lib/strategy/test";
import { MIN_RESEARCH_POSTS, type ResearchOption } from "@/lib/competencia/research";
import {
  HOOK_TYPES,
  SCRIPT_STRUCTURES,
  VALUE_PILLARS,
  colorFor,
  labelFor,
} from "@/lib/competencia/taxonomy";
import {
  deleteIdea,
  draftStrategy,
  draftStrategyFromTest,
  generateIdeas,
  getResearchOptions,
  saveIdea,
  saveStrategy,
  scheduleWeek,
  setIdeaUsed,
  type WeekIdea,
} from "./actions";
import styles from "./estrategia.module.css";

type Cliente = { id: string; nombre: string; marca: string | null };
type Tab = "estrategia" | "generar" | "banco";

type Props = {
  clientes: Cliente[];
  clientId: string;
  initialStrategy: Strategy;
  initialIdeas: ContentIdea[];
  /** Último test de estrategia (0019), del cliente desde el portal o tuyo. */
  initialTest: { answers: TestAnswers; completedAt: string | null } | null;
};

const LEVEL_LABEL: Record<AwarenessLevel, string> = Object.fromEntries(
  AWARENESS_LEVELS.map((l) => [l.id, l.label]),
) as Record<AwarenessLevel, string>;
const ANDREA_LABEL: Record<AndreaPillar, string> = Object.fromEntries(
  ANDREA_PILLARS.map((a) => [a.id, a.label]),
) as Record<AndreaPillar, string>;
const PURPOSE_LABEL: Record<string, string> = Object.fromEntries(PURPOSES.map((p) => [p.id, p.label]));

/** El próximo lunes (o hoy si es lunes), en YYYY-MM-DD local. */
function nextMonday(): string {
  const d = new Date();
  const add = (8 - d.getDay()) % 7;
  d.setDate(d.getDate() + add);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function newPillar(): Pillar {
  return {
    key: `pilar_${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    objective: "",
    andrea_pillar: "problema",
    share: 20,
    topics: "",
    formats: "",
  };
}

/** El brief que recibe `/guiones/nuevo`: la idea + la taxonomía elegida. */
function briefFor(idea: ContentIdea, pillars: Pillar[]): string {
  const pillar = pillars.find((p) => p.key === idea.pillar_key);
  const meta = [
    pillar && `Pilar: ${pillar.name}`,
    `Nivel de consciencia: ${LEVEL_LABEL[idea.stage] ?? idea.stage}`,
    idea.purpose && `Propósito: ${PURPOSE_LABEL[idea.purpose]}`,
    idea.format_style && `Formato: ${formatStyleLabel(idea.format_style)}`,
    idea.hook_type && `Gancho: ${labelFor("hook_type", idea.hook_type)}`,
    idea.script_structure && `Estructura sugerida: ${labelFor("script_structure", idea.script_structure)}`,
    idea.value_pillar && `Valor: ${labelFor("value_pillar", idea.value_pillar)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const hook = [
    `Gancho (dice): "${idea.hook}"`,
    idea.hook_text && `Texto en pantalla: "${idea.hook_text}"`,
    idea.hook_visual && `Primer segundo: ${idea.hook_visual}`,
  ]
    .filter(Boolean)
    .join("\n");
  return `${hook}\n\n${idea.brief}\n\n(${meta})`;
}

function scriptHref(clientId: string, idea: ContentIdea, pillars: Pillar[]) {
  const params = new URLSearchParams({
    client_id: clientId,
    brief: briefFor(idea, pillars),
    type: idea.format === "carousel" ? "carousel" : "reel",
  });
  return `/guiones/nuevo?${params.toString()}`;
}

export default function EstrategiaClient({ clientes, clientId, initialStrategy, initialIdeas, initialTest }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialStrategy.pillars.length ? "generar" : "estrategia");

  // ── Estrategia ──
  const [fields, setFields] = useState<Record<StrategyFieldKey, string>>(
    () =>
      Object.fromEntries(STRATEGY_FIELDS.map((f) => [f.key, initialStrategy[f.key] ?? ""])) as Record<
        StrategyFieldKey,
        string
      >,
  );
  const [pillars, setPillars] = useState<Pillar[]>(initialStrategy.pillars);
  const [phase, setPhase] = useState<AccountPhase | "">(initialStrategy.account_phase ?? "");
  const [savedPillars, setSavedPillars] = useState<Pillar[]>(initialStrategy.pillars);
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [drafting, startDrafting] = useTransition();
  const [draftPillars, setDraftPillars] = useState<Pillar[] | null>(null);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  // Test de estrategia (0019): las respuestas viajan con el próximo "Guardar".
  const [testOpen, setTestOpen] = useState(false);
  const [pendingTest, setPendingTest] = useState<TestAnswers | null>(null);

  // ── Generador ──
  const [source, setSource] = useState<IdeaSource>("matriz");
  const [sourceText, setSourceText] = useState("");
  // Fuente "Post de investigación" (0020): nichos y temas con su conteo real.
  const [researchOpts, setResearchOpts] = useState<ResearchOption[] | null>(null);
  const [researchNiche, setResearchNiche] = useState("");
  const [researchTopic, setResearchTopic] = useState("");
  const [pillarKey, setPillarKey] = useState("");
  const [level, setLevel] = useState("");
  const [purpose, setPurpose] = useState("");
  const [formatStyle, setFormatStyle] = useState("");
  const [format, setFormat] = useState("");
  const [mode, setMode] = useState<"sueltas" | "semana">("sueltas");
  const [weekPosts, setWeekPosts] = useState(3);
  const [weekStart, setWeekStart] = useState(nextMonday);
  const [scheduling, startScheduling] = useTransition();
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);
  const [valuePillar, setValuePillar] = useState("");
  const [hookType, setHookType] = useState("");
  const [structure, setStructure] = useState("");
  const [generating, startGenerating] = useTransition();
  const [genError, setGenError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<WeekIdea[]>([]);

  // ── Banco ──
  const [ideas, setIdeas] = useState<ContentIdea[]>(initialIdeas);
  const [bankPillar, setBankPillar] = useState("");
  const [showUsed, setShowUsed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const shareTotal = pillars.reduce((acc, p) => acc + (Number(p.share) || 0), 0);
  const sourceDef = IDEA_SOURCES.find((s) => s.id === source)!;

  const visibleIdeas = useMemo(
    () =>
      ideas.filter(
        (i) => (showUsed ? !!i.used_at : !i.used_at) && (!bankPillar || i.pillar_key === bankPillar),
      ),
    [ideas, showUsed, bankPillar],
  );
  const pendingCount = ideas.filter((i) => !i.used_at).length;

  // ── Handlers: estrategia ──
  function updateField(key: StrategyFieldKey, value: string) {
    setFields((p) => ({ ...p, [key]: value }));
    setDirty(true);
    setSaveMsg(null);
  }
  function updatePillar(idx: number, patch: Partial<Pillar>) {
    setPillars((list) => list.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
    setDirty(true);
    setSaveMsg(null);
  }
  function removePillar(idx: number) {
    setPillars((list) => list.filter((_, i) => i !== idx));
    setDirty(true);
  }
  function movePillar(idx: number, dir: -1 | 1) {
    setPillars((list) => {
      const next = [...list];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return list;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
    setDirty(true);
  }

  function handleSave() {
    setStrategyError(null);
    startSaving(async () => {
      const res = await saveStrategy({
        client_id: clientId,
        fields,
        account_phase: phase || null,
        pillars,
        test_answers: pendingTest,
      });
      if (!res.ok) {
        setStrategyError(res.error);
        return;
      }
      setPendingTest(null);
      setSavedPillars(pillars.filter((p) => p.name.trim()));
      setDirty(false);
      setSaveMsg("Guardado");
    });
  }

  function handleDraft() {
    setStrategyError(null);
    startDrafting(async () => {
      const res = await draftStrategy(clientId);
      if (!res.ok) {
        setStrategyError(res.error);
        return;
      }
      // Solo llena lo vacío: lo que ya escribiste no se pisa.
      setFields((prev) => {
        const next = { ...prev };
        for (const f of STRATEGY_FIELDS) {
          if (!next[f.key].trim() && res.fields[f.key]) next[f.key] = res.fields[f.key]!;
        }
        return next;
      });
      if (pillars.length === 0) setPillars(res.pillars);
      else setDraftPillars(res.pillars);
      setDirty(true);
      setSaveMsg(null);
    });
  }

  /** El test REEMPLAZA todo el formulario (no solo lo vacío) y no guarda. */
  async function handleTest(answers: TestAnswers): Promise<string | null> {
    const res = await draftStrategyFromTest(clientId, answers);
    if (!res.ok) return res.error;
    setFields(
      Object.fromEntries(STRATEGY_FIELDS.map((f) => [f.key, res.fields[f.key] ?? ""])) as Record<StrategyFieldKey, string>,
    );
    setPillars(res.pillars);
    setPhase(res.account_phase);
    setDraftPillars(null);
    setPendingTest(answers);
    setTestOpen(false);
    setDirty(true);
    setSaveMsg(null);
    return null;
  }

  // ── Handlers: generador ──
  function handleGenerate() {
    setGenError(null);
    startGenerating(async () => {
      const res = await generateIdeas({
        client_id: clientId,
        source,
        source_text: sourceDef.needsText ? sourceText : null,
        pillar_key: pillarKey || null,
        level: mode === "semana" ? null : level || null,
        purpose: purpose || null,
        format: format === "reel" || format === "carousel" ? format : null,
        format_style: formatStyle || null,
        week_posts: mode === "semana" ? weekPosts : null,
        value_pillar: valuePillar || null,
        hook_type: hookType || null,
        script_structure: structure || null,
        research_niche: source === "investigacion" ? researchNiche || null : null,
        research_topic: source === "investigacion" ? researchTopic || null : null,
      });
      if (!res.ok) {
        setGenError(res.error);
        return;
      }
      setFresh(res.ideas);
      setScheduleMsg(null);
    });
  }

  function handleSchedule() {
    setGenError(null);
    startScheduling(async () => {
      const res = await scheduleWeek({ client_id: clientId, start_date: weekStart, ideas: fresh });
      if (!res.ok) {
        setGenError(res.error);
        return;
      }
      setScheduleMsg(`✓ ${res.created} piezas agendadas en el calendario como "Idea".`);
    });
  }

  async function persistFresh(idea: ContentIdea): Promise<ContentIdea | null> {
    const res = await saveIdea(clientId, idea);
    if (!res.ok) {
      setGenError(res.error);
      return null;
    }
    setIdeas((list) => [res.idea, ...list]);
    setFresh((list) => list.filter((i) => i.id !== idea.id));
    return res.idea;
  }

  async function makeScript(idea: ContentIdea, alreadySaved: boolean) {
    setRowError(null);
    const saved = alreadySaved ? idea : await persistFresh(idea);
    if (!saved) return;
    const res = await setIdeaUsed(saved.id, true);
    if (!res.ok) {
      setRowError(res.error ?? "No se pudo marcar la idea.");
      return;
    }
    router.push(scriptHref(clientId, saved, savedPillars));
  }

  async function toggleUsed(idea: ContentIdea) {
    setRowError(null);
    const prev = idea.used_at ?? null;
    const used = !prev;
    setIdeas((list) => list.map((i) => (i.id === idea.id ? { ...i, used_at: used ? new Date().toISOString() : null } : i)));
    const res = await setIdeaUsed(idea.id, used);
    if (!res.ok) {
      setIdeas((list) => list.map((i) => (i.id === idea.id ? { ...i, used_at: prev } : i)));
      setRowError(res.error ?? "No se pudo actualizar.");
    }
  }

  async function handleDelete(idea: ContentIdea) {
    if (confirmDelete !== idea.id) {
      setConfirmDelete(idea.id);
      setTimeout(() => setConfirmDelete((c) => (c === idea.id ? null : c)), 4000);
      return;
    }
    setRowError(null);
    const snapshot = ideas;
    setIdeas((list) => list.filter((i) => i.id !== idea.id));
    const res = await deleteIdea(idea.id);
    if (!res.ok) {
      setIdeas(snapshot);
      setRowError(res.error ?? "No se pudo borrar.");
    }
  }

  // ── Render ──
  function renderIdea(idea: ContentIdea, saved: boolean) {
    const pillar = savedPillars.find((p) => p.key === idea.pillar_key);
    return (
      <article key={idea.id} className={`card ${styles.idea}`}>
        <div className={styles.ideaTags}>
          {pillar && (
            <span className="badge badge--emerald" title={`Pilar de Andrea: ${ANDREA_LABEL[pillar.andrea_pillar]}`}>
              {pillar.name} · {ANDREA_LABEL[pillar.andrea_pillar]}
            </span>
          )}
          <span className={`badge ${styles.tagMuted}`}>{LEVEL_LABEL[idea.stage] ?? idea.stage}</span>
          {idea.purpose && <span className={`badge ${styles.tagMuted}`}>{PURPOSE_LABEL[idea.purpose]}</span>}
          <span className={`badge ${styles.tagMuted}`}>
            {idea.format === "carousel" ? "Carrusel" : "Reel"}
            {idea.format_style && ` · ${formatStyleLabel(idea.format_style)}`}
          </span>
          {(["hook_type", "script_structure", "value_pillar"] as const).map((dim) =>
            idea[dim] ? (
              <span
                key={dim}
                className={`badge ${styles.tagTax}`}
                style={{ borderColor: colorFor(dim, idea[dim]), color: colorFor(dim, idea[dim]) }}
              >
                {labelFor(dim, idea[dim])}
              </span>
            ) : null,
          )}
        </div>
        <Layers verbal={idea.hook} text={idea.hook_text} visual={idea.hook_visual} />
        {idea.angle && <p className={styles.ideaAngle}>{idea.angle}</p>}
        <p className={styles.ideaBrief}>{idea.brief}</p>
        {idea.why && <p className={styles.ideaWhy}>Por qué funciona: {idea.why}</p>}
        <div className={styles.ideaActions}>
          <button type="button" className="btn btn-primary" onClick={() => makeScript(idea, saved)}>
            Hacer guion →
          </button>
          {!saved && (
            <button type="button" className="btn btn-secondary" onClick={() => persistFresh(idea)}>
              Guardar en banco
            </button>
          )}
          {saved && (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => toggleUsed(idea)}>
                {idea.used_at ? "Volver a pendientes" : "Marcar usada"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => handleDelete(idea)}>
                {confirmDelete === idea.id ? "¿Seguro? Clic otra vez" : "Borrar"}
              </button>
            </>
          )}
          {!saved && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setFresh((list) => list.filter((i) => i.id !== idea.id))}
            >
              Descartar
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className="eyebrow">Estrategia</span>
          <h1 className={styles.title}>Estrategia de contenido</h1>
          <p className={styles.subtitle}>
            Cliente ideal, pilares e ideas desde cero — no solo lo que publica la competencia.
          </p>
        </div>
        <label className={styles.brandPicker}>
          <span className="field-label">Marca</span>
          <select
            className="select"
            value={clientId}
            onChange={(e) => {
              if (dirty && !window.confirm("Tienes cambios sin guardar en la estrategia. ¿Cambiar de marca igual?")) return;
              router.push(`/estrategia?cliente=${e.target.value}`);
            }}
          >
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      </header>

      <nav className={styles.tabs}>
        {(
          [
            ["estrategia", "Cliente ideal y pilares"],
            ["generar", "Generar ideas"],
            ["banco", `Banco de ideas (${pendingCount})`],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`${styles.tab} ${tab === id ? styles.tabActive : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "estrategia" && (
        <section className={styles.section}>
          <div className={styles.toolbar}>
            <button type="button" className="btn btn-secondary" onClick={handleDraft} disabled={drafting}>
              {drafting ? "Pensando…" : "✦ Proponer con IA"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setTestOpen((v) => !v)} disabled={drafting}>
              {testOpen ? "Cerrar el test" : "🧭 Hacer el test"}
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !dirty}>
              {saving ? "Guardando…" : "Guardar estrategia"}
            </button>
            {saveMsg && <span className={styles.ok}>✓ {saveMsg}</span>}
            {dirty && !saving && <span className={styles.muted}>Cambios sin guardar</span>}
          </div>
          {strategyError && <p className={styles.error}>{strategyError}</p>}
          <p className={styles.muted}>
            La propuesta de la IA solo llena los campos vacíos y no se guarda hasta que tú guardas.
          </p>
          {initialTest && !pendingTest && (
            <details className={`card ${styles.testBox}`}>
              <summary>
                🧭 Test de estrategia respondido
                {initialTest.completedAt &&
                  ` el ${new Date(initialTest.completedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}`}{" "}
                — ver respuestas
              </summary>
              <p className={styles.testAnswers}>{testAnswersToText(initialTest.answers).replace(/\*\*/g, "")}</p>
            </details>
          )}
          {pendingTest && (
            <p className={styles.muted}>Armado desde el test: revisa y guarda para aplicarlo.</p>
          )}
          {testOpen && (
            <StrategyTestForm
              initial={pendingTest ?? initialTest?.answers}
              submitLabel="✦ Armar estrategia"
              busyLabel="Armando… (unos 20 segundos)"
              warning="Reemplaza el cliente ideal, los pilares y la etapa del formulario. No se guarda hasta que guardes."
              onSubmit={handleTest}
              onCancel={() => setTestOpen(false)}
            />
          )}

          <div className={`card ${styles.phaseBox}`}>
            <label className="field">
              <span className="field-label">Etapa de la cuenta</span>
              <select
                className="select"
                value={phase}
                onChange={(e) => {
                  setPhase(e.target.value as AccountPhase | "");
                  setDirty(true);
                  setSaveMsg(null);
                }}
              >
                <option value="">Sin definir</option>
                {ACCOUNT_PHASES.map((ph) => (
                  <option key={ph.id} value={ph.id}>
                    {ph.label}
                  </option>
                ))}
              </select>
            </label>
            {phase && (
              <p className={styles.muted}>
                {ACCOUNT_PHASES.find((ph) => ph.id === phase)?.hint}{" "}
                <strong>Reparto:</strong> {ACCOUNT_PHASES.find((ph) => ph.id === phase)?.mix}
              </p>
            )}
          </div>

          <div className={styles.fieldsGrid}>
            {STRATEGY_FIELDS.map((f) => (
              <label key={f.key} className={`field ${f.key === "avatar" ? styles.fieldWide : ""}`}>
                <span className="field-label">{f.label}</span>
                <textarea
                  className="textarea"
                  rows={f.key === "avatar" ? 4 : 5}
                  placeholder={f.placeholder}
                  value={fields[f.key]}
                  onChange={(e) => updateField(f.key, e.target.value)}
                />
              </label>
            ))}
          </div>

          <div className={styles.pillarsHead}>
            <h2 className={styles.h2}>Pilares de contenido</h2>
            <span className={styles.muted}>
              {ANDREA_PILLARS.map((a) => `${a.label}: ${pillars.filter((p) => p.andrea_pillar === a.id).length}`).join(" · ")}
            </span>
            <span className={shareTotal === 100 ? styles.ok : styles.warn}>
              Reparto del mes: {shareTotal}%{shareTotal !== 100 && " (debería sumar 100)"}
            </span>
          </div>

          {draftPillars && (
            <div className={`card ${styles.draftBox}`}>
              <p style={{ margin: 0 }}>
                La IA propuso {draftPillars.length} pilares:{" "}
                <strong>{draftPillars.map((p) => p.name).join(" · ")}</strong>
              </p>
              <div className={styles.ideaActions}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setPillars(draftPillars);
                    setDraftPillars(null);
                    setDirty(true);
                  }}
                >
                  Reemplazar mis pilares
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setDraftPillars(null)}>
                  Descartar
                </button>
              </div>
            </div>
          )}

          <div className={styles.pillars}>
            {pillars.map((p, idx) => (
              <div key={p.key} className={`card ${styles.pillar}`}>
                <div className={styles.pillarTop}>
                  <span className={styles.pillarNum}>{idx + 1}</span>
                  <input
                    className="input"
                    placeholder="Nombre del pilar"
                    value={p.name}
                    onChange={(e) => updatePillar(idx, { name: e.target.value })}
                  />
                  <select
                    className="select"
                    value={p.andrea_pillar}
                    onChange={(e) => updatePillar(idx, { andrea_pillar: e.target.value as AndreaPillar })}
                    aria-label="Pilar de Andrea"
                    title={ANDREA_PILLARS.find((a) => a.id === p.andrea_pillar)?.hint}
                  >
                    {ANDREA_PILLARS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <label className={styles.share}>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={100}
                      value={p.share}
                      onChange={(e) => updatePillar(idx, { share: Number(e.target.value) })}
                      aria-label="Porcentaje del mes"
                    />
                    %
                  </label>
                </div>
                <input
                  className="input"
                  placeholder="Objetivo: qué hace este pilar por la marca"
                  value={p.objective}
                  onChange={(e) => updatePillar(idx, { objective: e.target.value })}
                />
                <textarea
                  className="textarea"
                  rows={4}
                  placeholder="Líneas narrativas (subtemas, objeciones), una por línea"
                  value={p.topics}
                  onChange={(e) => updatePillar(idx, { topics: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Formatos (ej. cámara + pantalla, carrusel)"
                  value={p.formats}
                  onChange={(e) => updatePillar(idx, { formats: e.target.value })}
                />
                <div className={styles.pillarActions}>
                  <button type="button" className="btn btn-ghost" onClick={() => movePillar(idx, -1)} disabled={idx === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => movePillar(idx, 1)}
                    disabled={idx === pillars.length - 1}
                  >
                    ↓
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => removePillar(idx)}>
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
          {pillars.length < MAX_PILLARS && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setPillars((list) => [...list, newPillar()]);
                setDirty(true);
              }}
            >
              + Agregar pilar
            </button>
          )}
        </section>
      )}

      {tab === "generar" && (
        <section className={styles.section}>
          {savedPillars.length === 0 ? (
            <div className="card" style={{ padding: 24 }}>
              <p style={{ marginTop: 0 }}>Primero define y guarda los pilares de esta marca.</p>
              <button type="button" className="btn btn-primary" onClick={() => setTab("estrategia")}>
                Ir a pilares
              </button>
            </div>
          ) : (
            <>
              <div className={styles.toolbar}>
                <button
                  type="button"
                  className={`${styles.tab} ${mode === "sueltas" ? styles.tabActive : ""}`}
                  onClick={() => setMode("sueltas")}
                >
                  Ideas sueltas
                </button>
                <button
                  type="button"
                  className={`${styles.tab} ${mode === "semana" ? styles.tabActive : ""}`}
                  onClick={() => setMode("semana")}
                >
                  Mi semana (niveles de consciencia)
                </button>
              </div>
              {mode === "semana" && (
                <div className={`card ${styles.phaseBox}`}>
                  <div className={styles.weekControls}>
                    <label className="field">
                      <span className="field-label">Piezas por semana</span>
                      <select className="select" value={weekPosts} onChange={(e) => setWeekPosts(Number(e.target.value))}>
                        {[3, 4, 5, 7].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="field-label">Empieza el lunes</span>
                      <input className="input" type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
                    </label>
                  </div>
                  <p className={styles.muted}>
                    Una idea por día, cada una para un nivel de consciencia distinto, encadenadas: lo que el lunes nombra como
                    síntoma, el domingo lo resuelve con tu oferta.
                  </p>
                </div>
              )}

              <h2 className={styles.h2}>1. ¿De dónde sale la idea?</h2>
              <div className={styles.sources}>
                {IDEA_SOURCES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`card ${styles.source} ${source === s.id ? styles.sourceActive : ""}`}
                    onClick={() => {
                      setSource(s.id);
                      if (s.id === "investigacion" && !researchOpts) {
                        getResearchOptions()
                          .then(setResearchOpts)
                          .catch(() => setResearchOpts([]));
                      }
                    }}
                  >
                    <strong>{s.label}</strong>
                    <span>{s.hint}</span>
                  </button>
                ))}
              </div>
              {sourceDef.needsText && (
                <textarea
                  className="textarea"
                  rows={5}
                  placeholder={sourceDef.placeholder}
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                />
              )}
              {source === "investigacion" && (
                <div className={styles.filters}>
                  {researchOpts === null ? (
                    <p className={styles.muted}>Contando tus reels de Competencia…</p>
                  ) : researchOpts.length === 0 ? (
                    <p className={styles.muted}>
                      Todavía no hay reels clasificados de cuentas con nicho. En Competencia, ponle nicho a cada cuenta
                      (&quot;+ nicho&quot;), transcribe sus reels y dale a &quot;Clasificar pendientes&quot;.
                    </p>
                  ) : (
                    <>
                      <label className="field">
                        <span className="field-label">Nicho</span>
                        <select
                          className="select"
                          value={researchNiche}
                          onChange={(e) => {
                            setResearchNiche(e.target.value);
                            setResearchTopic("");
                          }}
                        >
                          <option value="">Elige un nicho</option>
                          {researchOpts.map((o) => (
                            <option key={o.niche} value={o.niche}>
                              {o.niche} — {o.count} reels
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="field-label">Tema (opcional)</span>
                        <select
                          className="select"
                          value={researchTopic}
                          onChange={(e) => setResearchTopic(e.target.value)}
                          disabled={!researchNiche}
                        >
                          <option value="">Todos los temas</option>
                          {(researchOpts.find((o) => o.niche === researchNiche)?.topics ?? []).map((t) => (
                            <option key={t.topic} value={t.topic}>
                              {t.topic} — {t.count}
                              {t.count < MIN_RESEARCH_POSTS ? " (pocos)" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      {researchNiche && (
                        <p className={styles.muted}>
                          Mínimo {MIN_RESEARCH_POSTS} reels para armar el post: los números salen de tus datos, no
                          de la IA.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <h2 className={styles.h2}>2. Afina (opcional)</h2>
              <div className={styles.filters}>
                <label className="field">
                  <span className="field-label">Pilar</span>
                  <select className="select" value={pillarKey} onChange={(e) => setPillarKey(e.target.value)}>
                    <option value="">Todos (según su %)</option>
                    {savedPillars.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Nivel de consciencia</span>
                  <select
                    className="select"
                    value={mode === "semana" ? "" : level}
                    onChange={(e) => setLevel(e.target.value)}
                    disabled={mode === "semana"}
                    title={mode === "semana" ? "En 'Mi semana' cada día tiene su nivel" : undefined}
                  >
                    <option value="">{mode === "semana" ? "Uno por día" : "Mezcla"}</option>
                    {AWARENESS_LEVELS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Propósito</span>
                  <select className="select" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                    <option value="">Según nivel y etapa</option>
                    {PURPOSES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Estilo de formato</span>
                  <select className="select" value={formatStyle} onChange={(e) => setFormatStyle(e.target.value)}>
                    <option value="">Que varíe</option>
                    {FORMAT_STYLES.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Formato</span>
                  <select className="select" value={format} onChange={(e) => setFormat(e.target.value)}>
                    <option value="">Mezcla</option>
                    <option value="reel">Reel</option>
                    <option value="carousel">Carrusel</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Pilar de valor</span>
                  <select className="select" value={valuePillar} onChange={(e) => setValuePillar(e.target.value)}>
                    <option value="">Que elija la IA</option>
                    {VALUE_PILLARS.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Tipo de gancho</span>
                  <select className="select" value={hookType} onChange={(e) => setHookType(e.target.value)}>
                    <option value="">Que elija la IA</option>
                    {HOOK_TYPES.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Estructura</span>
                  <select className="select" value={structure} onChange={(e) => setStructure(e.target.value)}>
                    <option value="">Que elija la IA</option>
                    {SCRIPT_STRUCTURES.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={styles.toolbar}>
                <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                  {generating ? "Generando…" : mode === "semana" ? "✦ Armar mi semana" : "✦ Generar ideas"}
                </button>
                {mode === "semana" && fresh.length > 0 && fresh.some((i) => i.day !== null) && (
                  <button type="button" className="btn btn-secondary" onClick={handleSchedule} disabled={scheduling}>
                    {scheduling ? "Agendando…" : "Agendar semana en el calendario"}
                  </button>
                )}
                {scheduleMsg && <span className={styles.ok}>{scheduleMsg}</span>}
                {fresh.length > 0 && (
                  <span className={styles.muted}>
                    Guarda las que te sirvan; las demás se pierden al recargar.
                  </span>
                )}
              </div>
              {genError && <p className={styles.error}>{genError}</p>}
              {rowError && <p className={styles.error}>{rowError}</p>}

              <div className={styles.ideas}>
                {fresh.map((idea) => (
                  <div key={idea.id} className={styles.ideaWrap}>
                    {idea.day !== null && <p className={styles.dayLabel}>{WEEK_DAYS[idea.day]}</p>}
                    {renderIdea(idea, false)}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {tab === "banco" && (
        <section className={styles.section}>
          <div className={styles.toolbar}>
            <select className="select" style={{ maxWidth: 260 }} value={bankPillar} onChange={(e) => setBankPillar(e.target.value)}>
              <option value="">Todos los pilares</option>
              {savedPillars.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="button" className={`${styles.tab} ${!showUsed ? styles.tabActive : ""}`} onClick={() => setShowUsed(false)}>
              Pendientes
            </button>
            <button type="button" className={`${styles.tab} ${showUsed ? styles.tabActive : ""}`} onClick={() => setShowUsed(true)}>
              Ya hechas
            </button>
          </div>
          {rowError && <p className={styles.error}>{rowError}</p>}
          {visibleIdeas.length === 0 ? (
            <p className={styles.muted}>
              {showUsed ? "Todavía no conviertes ninguna idea en guion." : "No hay ideas guardadas aquí. Genera algunas en “Generar ideas”."}
            </p>
          ) : (
            <div className={styles.ideas}>
              {visibleIdeas.map((idea) => renderIdea(idea, true))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
