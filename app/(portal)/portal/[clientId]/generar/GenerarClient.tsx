"use client";

/**
 * La pantalla de generación del portal (Fase D, etapa 6).
 *
 * Dos flujos, según `clients.ai_generation_mode` (lo elige Paco por marca):
 *
 *   simple    Brief → Guion                              (1 llamada)
 *   completo  Brief → Big Idea → Estructura → Guion       (3 llamadas)
 *
 * No es el wizard de `/guiones/nuevo`: acá no hay micro-historias, ni edición
 * con IA, ni pestañas comparando versiones. El cliente no es guionista — lo que
 * necesita es pedir, mirar y mandar.
 *
 * **Todo lo que decide corre en el servidor.** El contador de acá es informativo:
 * quien corta el tope es `/api/portal/generar/guion`, que además es el único que
 * registra el consumo. Si esta UI mintiera, el servidor igual diría que no.
 *
 * Los `fetch` y la server action van todos dentro de try/catch: una mutación sin
 * catch deja la pantalla en "This page couldn't load" (regla dura de CLAUDE.md).
 */

import { useState } from "react";
import Link from "next/link";
import ScriptBody from "@/components/portal/ScriptBody";
import ScriptTextEditor from "@/components/portal/ScriptTextEditor";
import {
  applyTextDraft,
  toTextDraft,
  isEditableDraft,
  type ScriptTextDraft,
} from "@/lib/portal/scriptEdit";
import { generationModeSteps, type PortalGenerationMode } from "@/lib/portal/generationMode";
import { guardarGuion } from "./actions";
import s from "./generar.module.css";

type ScriptType = "reel" | "carousel";

type Structure = { name: string; hook: string; arc: string; close: string };

function isAlborna(name: string): boolean {
  return name.toLowerCase().includes("alborna");
}

type Usage = { used: number; limit: number | null; remaining: number | null };

type Generated = {
  content: Record<string, unknown>;
  structureName: string;
};

type Props = {
  clientId: string;
  mode: PortalGenerationMode;
  /** ¿Tiene prendida la sección Guiones? Si no, no se le ofrece el link. */
  canSeeScripts: boolean;
  initialUsage: Usage;
};

export default function GenerarClient({ clientId, mode, canSeeScripts, initialUsage }: Props) {
  const completo = mode === "completo";
  const steps = generationModeSteps(mode);

  const [step, setStep] = useState(0);
  const [type, setType] = useState<ScriptType>("reel");
  const [brief, setBrief] = useState("");

  const [bigIdea, setBigIdea] = useState("");
  const [structures, setStructures] = useState<Structure[]>([]);
  const [chosen, setChosen] = useState<Structure | null>(null);

  const [generated, setGenerated] = useState<Generated | null>(null);
  // Borrador editable del guion generado (etapa 8): lo que se guarda es esto,
  // no lo que devolvió la IA. Regenerar cuesta crédito; corregir una frase no.
  const [draft, setDraft] = useState<ScriptTextDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  const [usage, setUsage] = useState<Usage>(initialUsage);
  const [loading, setLoading] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);

  const blocked = usage.remaining !== null && usage.remaining <= 0;
  const lastStep = steps.length - 1;

  async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`/api/portal/generar/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "No se pudo completar el pedido.");
    return data as T;
  }

  function reset() {
    setStep(0);
    setBigIdea("");
    setStructures([]);
    setChosen(null);
    setGenerated(null);
    setDraft(null);
    setEditing(false);
    setTitle("");
    setSavedId(null);
    setError(null);
  }

  // ── Paso: generar el guion (los dos modos terminan acá) ───────────────────

  async function generar(structure?: Structure | null) {
    setLoading("Escribiendo el guion… puede tardar hasta un minuto.");
    setError(null);
    try {
      const data = await post<{
        content: Record<string, unknown>;
        structure_name: string;
        usage: Usage;
      }>("guion", {
        brief,
        type,
        big_idea: completo ? bigIdea : undefined,
        structure_name: structure?.name,
        structure: structure
          ? { hook: structure.hook, arc: structure.arc, close: structure.close }
          : undefined,
      });

      setGenerated({ content: data.content, structureName: data.structure_name });
      setDraft(toTextDraft(data.content, type));
      setEditing(false);
      setUsage(data.usage);
      setSavedId(null);
      setStep(lastStep);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el guion.");
    } finally {
      setLoading(null);
    }
  }

  // ── Paso 1 → 2 ────────────────────────────────────────────────────────────

  async function avanzarDesdeBrief() {
    if (!brief.trim()) {
      setError("Escribe de qué quieres que hable el guion.");
      return;
    }

    if (!completo) {
      await generar(null);
      return;
    }

    setLoading("Buscando la idea central…");
    setError(null);
    try {
      const data = await post<{ big_idea: string }>("big-idea", { brief, type });
      setBigIdea(data.big_idea);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la idea central.");
    } finally {
      setLoading(null);
    }
  }

  async function pedirEstructuras() {
    if (!bigIdea.trim()) {
      setError("La idea central no puede quedar vacía.");
      return;
    }
    setLoading("Armando las tres formas de contarlo…");
    setError(null);
    try {
      const data = await post<{ structures: Structure[] }>("estructuras", {
        brief,
        type,
        big_idea: bigIdea,
      });
      setStructures(data.structures ?? []);
      setChosen(data.structures?.[0] ?? null);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron proponer estructuras.");
    } finally {
      setLoading(null);
    }
  }

  // ── Guardar ───────────────────────────────────────────────────────────────

  async function guardar() {
    if (!generated) return;
    setLoading("Guardando…");
    setError(null);
    try {
      const res = await guardarGuion({
        clientId,
        type,
        brief,
        structureName: generated.structureName,
        title: title.trim() || null,
        // Lo editado, mergeado sobre el content original (ver `scriptEdit.ts`).
        content: draft ? applyTextDraft(generated.content, draft) : generated.content,
      });
      if (res.ok) {
        setSavedId(res.scriptId);
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el guion.");
    } finally {
      setLoading(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className={s.meter}>
        <div className={s.steps}>
          {steps.map((label, i) => (
            <span
              key={label}
              className={`${s.stepChip} ${i === step ? s.stepActive : ""} ${i < step ? s.stepDone : ""}`}
            >
              {i < step ? "✓ " : ""}
              {label}
            </span>
          ))}
        </div>
        <p className={s.usage}>
          {usage.limit === null ? (
            <>Generaciones ilimitadas este mes</>
          ) : (
            <>
              Te {usage.remaining === 1 ? "queda" : "quedan"}{" "}
              <strong className={blocked ? s.usageOver : undefined}>{usage.remaining ?? 0}</strong>{" "}
              de {usage.limit} este mes
            </>
          )}
        </p>
      </div>

      {blocked && !generated && (
        <div className={s.blockedBox}>
          <p className={s.blockedTitle}>Llegaste al tope de este mes</p>
          <p className={s.blockedText}>
            El contador se reinicia el día 1. Si necesitas más guiones antes,
            háblalo con quien maneja tu contenido.
          </p>
        </div>
      )}

      {/* ── Paso 0: brief ── */}
      {step === 0 && (
        <div className={s.card}>
          <div className={s.field}>
            <label className="field-label">Tipo de contenido</label>
            <div className={s.typeToggle}>
              <button
                type="button"
                className={`${s.typeBtn} ${type === "reel" ? s.typeBtnActive : ""}`}
                onClick={() => setType("reel")}
                disabled={!!loading}
              >
                Reel
              </button>
              <button
                type="button"
                className={`${s.typeBtn} ${type === "carousel" ? s.typeBtnActive : ""}`}
                onClick={() => setType("carousel")}
                disabled={!!loading}
              >
                Carrusel
              </button>
            </div>
          </div>

          <div className={s.field}>
            <label className="field-label" htmlFor="brief">
              ¿De qué quieres que hable?
            </label>
            <textarea
              id="brief"
              className="textarea"
              rows={5}
              maxLength={4000}
              placeholder="Ej: quiero contar por qué la mayoría abandona a los dos meses, y que se entienda que no es falta de disciplina sino de método."
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              disabled={!!loading || blocked}
            />
            <p className={s.hint}>
              Mientras más contexto le des —a quién le hablas, qué quieres que
              haga después— más se parece el guion a lo que tienes en la cabeza.
            </p>
          </div>

          <div className={s.actions}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={avanzarDesdeBrief}
              disabled={!!loading || blocked || !brief.trim()}
            >
              {completo ? "Buscar la idea central →" : "Generar guion →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 1 (completo): Big Idea ── */}
      {completo && step === 1 && (
        <div className={s.card}>
          <span className="eyebrow">Idea central</span>
          <p className={s.hint}>
            Es el mensaje al que va a servir todo el guion. Puedes ajustarlo
            antes de seguir.
          </p>
          <textarea
            className="textarea"
            rows={3}
            value={bigIdea}
            onChange={(e) => setBigIdea(e.target.value)}
            disabled={!!loading}
          />
          <div className={s.actions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setStep(0);
                setError(null);
              }}
              disabled={!!loading}
            >
              ← Cambiar el pedido
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={pedirEstructuras}
              disabled={!!loading || !bigIdea.trim()}
            >
              Ver formas de contarlo →
            </button>
          </div>
        </div>
      )}

      {/* ── Paso 2 (completo): estructura ── */}
      {completo && step === 2 && (
        <div>
          <p className={s.hint} style={{ marginBottom: 12 }}>
            Tres formas de contar la misma idea. Elige la que más te suene a tu
            marca.
          </p>

          <div className={s.structures}>
            {structures.map((st) => {
              const selected = chosen?.name === st.name;
              return (
                <button
                  type="button"
                  key={st.name}
                  className={`${s.structure} ${selected ? s.structureOn : ""}`}
                  onClick={() => setChosen(st)}
                  disabled={!!loading}
                >
                  <span className={`${s.structureRadio} ${selected ? s.structureCheck : ""}`}>
                    {selected && <span className={s.checkMark}>✓</span>}
                  </span>
                  <span className={s.structureBody}>
                    <span className={s.structureName}>{st.name}</span>
                    {isAlborna(st.name) && <span className={s.albornaTag}>✦ Alborna</span>}
                    <span className={s.structureRows}>
                      <span className={s.structureRow}>
                        <span className={s.structureLabel}>Arranca</span>
                        <span className={s.structureText}>{st.hook}</span>
                      </span>
                      <span className={s.structureRow}>
                        <span className={s.structureLabel}>Desarrolla</span>
                        <span className={s.structureText}>{st.arc}</span>
                      </span>
                      <span className={s.structureRow}>
                        <span className={s.structureLabel}>Cierra</span>
                        <span className={s.structureText}>{st.close}</span>
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className={s.actions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setStep(1);
                setError(null);
              }}
              disabled={!!loading}
            >
              ← Volver a la idea
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => generar(chosen)}
              disabled={!!loading || !chosen || blocked}
            >
              Generar guion →
            </button>
          </div>
        </div>
      )}

      {/* ── Último paso: el guion ── */}
      {step === lastStep && generated && (
        <div>
          {!savedId && draft && isEditableDraft(draft) && (
            <div className={s.editToggleRow}>
              <button
                type="button"
                className={s.editToggle}
                onClick={() => setEditing((v) => !v)}
                disabled={!!loading}
              >
                {editing ? "Ver como queda" : "✎ Editar el texto"}
              </button>
            </div>
          )}

          <article className={s.script}>
            <p className={s.scriptMeta}>{generated.structureName}</p>
            {editing && draft ? (
              <ScriptTextEditor draft={draft} onChange={setDraft} disabled={!!loading} />
            ) : (
              <ScriptBody
                content={draft ? applyTextDraft(generated.content, draft) : generated.content}
                type={type}
                framed={false}
                emptyText="La IA devolvió un guion vacío. Prueba generarlo de nuevo."
              />
            )}
          </article>

          {savedId ? (
            <div className={s.savedBox}>
              <p className={s.savedTitle}>Guion guardado</p>
              <p className={s.savedText}>
                Ya está en tus guiones, marcado como <strong>En preparación</strong>.
                Quien maneja tu contenido lo va a ver ahí.
              </p>
              <div className={s.actions}>
                {canSeeScripts && (
                  <Link href={`/portal/${clientId}/guiones/${savedId}`} className="btn btn-primary">
                    Ver el guion →
                  </Link>
                )}
                <button type="button" className="btn btn-secondary" onClick={reset}>
                  Generar otro
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={s.field}>
                <label className="field-label" htmlFor="titulo">
                  Título (opcional)
                </label>
                <input
                  id="titulo"
                  className="input"
                  maxLength={200}
                  placeholder="Para reconocerlo después en la lista"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!!loading}
                />
              </div>

              <div className={s.actions}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setStep(0);
                    setError(null);
                  }}
                  disabled={!!loading}
                >
                  ← Cambiar el pedido
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => generar(completo ? chosen : null)}
                  disabled={!!loading || blocked}
                  title={
                    blocked
                      ? "Llegaste al tope de este mes"
                      : "Vuelve a escribirlo desde cero. Cuenta como una generación."
                  }
                >
                  Regenerar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={guardar}
                  disabled={!!loading}
                >
                  Guardar guion
                </button>
              </div>
              <p className={s.hint}>
                Regenerar escribe una versión nueva desde cero y cuenta como otra
                generación del mes.
              </p>
            </>
          )}
        </div>
      )}

      {loading && (
        <div className={s.loading}>
          <span className={s.spinner} />
          <span>{loading}</span>
        </div>
      )}

      {error && <p className={s.error}>{error}</p>}
    </div>
  );
}
