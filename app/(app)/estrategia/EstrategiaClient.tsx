"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FUNNEL_STAGES,
  IDEA_SOURCES,
  MAX_PILLARS,
  STRATEGY_FIELDS,
  type ContentIdea,
  type FunnelStage,
  type IdeaSource,
  type Pillar,
  type Strategy,
  type StrategyFieldKey,
} from "@/lib/strategy/pillars";
import {
  HOOK_TYPES,
  SCRIPT_STRUCTURES,
  VALUE_PILLARS,
  colorFor,
  labelFor,
} from "@/lib/competencia/taxonomy";
import { deleteIdea, draftStrategy, generateIdeas, saveIdea, saveStrategy, setIdeaUsed } from "./actions";
import styles from "./estrategia.module.css";

type Cliente = { id: string; nombre: string; marca: string | null };
type Tab = "estrategia" | "generar" | "banco";

type Props = {
  clientes: Cliente[];
  clientId: string;
  initialStrategy: Strategy;
  initialIdeas: ContentIdea[];
};

const STAGE_LABEL: Record<FunnelStage, string> = Object.fromEntries(
  FUNNEL_STAGES.map((s) => [s.id, s.label]),
) as Record<FunnelStage, string>;

function newPillar(): Pillar {
  return {
    key: `pilar_${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    objective: "",
    stage: "atraer",
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
    `Etapa: ${STAGE_LABEL[idea.stage] ?? idea.stage}`,
    idea.hook_type && `Gancho: ${labelFor("hook_type", idea.hook_type)}`,
    idea.script_structure && `Estructura sugerida: ${labelFor("script_structure", idea.script_structure)}`,
    idea.value_pillar && `Valor: ${labelFor("value_pillar", idea.value_pillar)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return `Gancho: "${idea.hook}"\n\n${idea.brief}\n\n(${meta})`;
}

function scriptHref(clientId: string, idea: ContentIdea, pillars: Pillar[]) {
  const params = new URLSearchParams({
    client_id: clientId,
    brief: briefFor(idea, pillars),
    type: idea.format === "carousel" ? "carousel" : "reel",
  });
  return `/guiones/nuevo?${params.toString()}`;
}

export default function EstrategiaClient({ clientes, clientId, initialStrategy, initialIdeas }: Props) {
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
  const [savedPillars, setSavedPillars] = useState<Pillar[]>(initialStrategy.pillars);
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [drafting, startDrafting] = useTransition();
  const [draftPillars, setDraftPillars] = useState<Pillar[] | null>(null);
  const [strategyError, setStrategyError] = useState<string | null>(null);

  // ── Generador ──
  const [source, setSource] = useState<IdeaSource>("matriz");
  const [sourceText, setSourceText] = useState("");
  const [pillarKey, setPillarKey] = useState("");
  const [stage, setStage] = useState("");
  const [format, setFormat] = useState("");
  const [valuePillar, setValuePillar] = useState("");
  const [hookType, setHookType] = useState("");
  const [structure, setStructure] = useState("");
  const [generating, startGenerating] = useTransition();
  const [genError, setGenError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<ContentIdea[]>([]);

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
      const res = await saveStrategy({ client_id: clientId, fields, pillars });
      if (!res.ok) {
        setStrategyError(res.error);
        return;
      }
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

  // ── Handlers: generador ──
  function handleGenerate() {
    setGenError(null);
    startGenerating(async () => {
      const res = await generateIdeas({
        client_id: clientId,
        source,
        source_text: sourceDef.needsText ? sourceText : null,
        pillar_key: pillarKey || null,
        stage: stage || null,
        format: format === "reel" || format === "carousel" ? format : null,
        value_pillar: valuePillar || null,
        hook_type: hookType || null,
        script_structure: structure || null,
      });
      if (!res.ok) {
        setGenError(res.error);
        return;
      }
      setFresh(res.ideas);
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
          {pillar && <span className="badge badge--emerald">{pillar.name}</span>}
          <span className={`badge ${styles.tagMuted}`}>{STAGE_LABEL[idea.stage] ?? idea.stage}</span>
          <span className={`badge ${styles.tagMuted}`}>{idea.format === "carousel" ? "Carrusel" : "Reel"}</span>
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
        <p className={styles.ideaHook}>“{idea.hook}”</p>
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
                    value={p.stage}
                    onChange={(e) => updatePillar(idx, { stage: e.target.value as FunnelStage })}
                    aria-label="Etapa"
                  >
                    {FUNNEL_STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
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
                  placeholder="Temas, uno por línea"
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
              <h2 className={styles.h2}>1. ¿De dónde sale la idea?</h2>
              <div className={styles.sources}>
                {IDEA_SOURCES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`card ${styles.source} ${source === s.id ? styles.sourceActive : ""}`}
                    onClick={() => setSource(s.id)}
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
                  <span className="field-label">Etapa</span>
                  <select className="select" value={stage} onChange={(e) => setStage(e.target.value)}>
                    <option value="">Mezcla</option>
                    {FUNNEL_STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
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
                  {generating ? "Generando ideas…" : "✦ Generar ideas"}
                </button>
                {fresh.length > 0 && (
                  <span className={styles.muted}>
                    Guarda las que te sirvan; las demás se pierden al recargar.
                  </span>
                )}
              </div>
              {genError && <p className={styles.error}>{genError}</p>}
              {rowError && <p className={styles.error}>{rowError}</p>}

              <div className={styles.ideas}>
                {fresh.map((idea) => renderIdea(idea, false))}
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
