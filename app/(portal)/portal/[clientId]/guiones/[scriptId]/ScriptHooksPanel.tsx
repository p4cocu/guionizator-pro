"use client";

/**
 * Ganchos de 3 capas en el guion del cliente (portal).
 *
 * - Todos ven los ganchos guardados (los de Paco y los suyos).
 * - Con el add-on de IA y rol `collaborator`: "✦ 3 ganchos nuevos" y
 *   "Revisar" en cada uno, 1 generación cada uno.
 * - Guardar es gratis (`collaborator` o dueño). Nunca se borra ni se pisa un
 *   gancho: la versión mejorada de una revisión entra como gancho NUEVO.
 *
 * Etiquetas sin jerga (`plain`). El `blocked` espeja al servidor.
 */

import { useState } from "react";
import { Checklist, Layers, ScoreBadge } from "@/components/hooks/HookParts";
import type { HookReview, LayeredHook } from "@/lib/hooks/prompts";
import type { PortalHook } from "@/lib/portal/scriptHooks";
import { guardarGancho, pedirGanchos, revisarGancho } from "./hooksActions";
import t from "@/components/portal/aiTools.module.css";

export default function ScriptHooksPanel({
  clientId,
  scriptId,
  initialHooks,
  canUseAi,
  canSave,
  initialRemaining,
  creditBalance: initialCredits,
}: {
  clientId: string;
  scriptId: string;
  initialHooks: PortalHook[];
  canUseAi: boolean;
  canSave: boolean;
  initialRemaining: number | null;
  creditBalance: number;
}) {
  const [hooks, setHooks] = useState(initialHooks);
  const [proposals, setProposals] = useState<LayeredHook[]>([]);
  const [reviews, setReviews] = useState<Record<string, HookReview>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [credits, setCredits] = useState(initialCredits);

  const planAgotado = remaining !== null && remaining <= 0;
  const blocked = planAgotado && credits <= 0;

  if (!canUseAi && hooks.length === 0) return null;

  function charge() {
    if (planAgotado) setCredits((c) => Math.max(0, c - 1));
    else setRemaining((r) => (r === null ? null : Math.max(0, r - 1)));
  }

  async function run<T>(key: string, fn: () => Promise<T>): Promise<T | null> {
    setBusy(key);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo falló. Intenta de nuevo.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function nuevos() {
    const res = await run("new", () => pedirGanchos(clientId, scriptId));
    if (!res) return;
    if (!res.ok) return setError(res.error);
    setProposals(res.hooks);
    charge();
  }

  async function revisar(hook: PortalHook) {
    const res = await run(`review:${hook.id}`, () =>
      revisarGancho(clientId, scriptId, {
        id: hook.id,
        hook_text: hook.hook_text,
        text_overlay: hook.text_overlay,
        visual: hook.visual,
      }),
    );
    if (!res) return;
    if (!res.ok) return setError(res.error);
    setReviews((r) => ({ ...r, [hook.id]: res.review }));
    setHooks((list) => list.map((h) => (h.id === hook.id ? { ...h, checks: res.review.checks } : h)));
    charge();
  }

  async function guardar(key: string, h: Parameters<typeof guardarGancho>[2], after?: () => void) {
    const res = await run(`save:${key}`, () => guardarGancho(clientId, scriptId, h));
    if (!res) return;
    if (!res.ok) return setError(res.error);
    setHooks((list) => [...list, res.hook]);
    after?.();
  }

  return (
    <section className={t.panel} style={{ marginTop: 28 }}>
      <div className={t.head}>
        <h3 className={t.title}>Ganchos</h3>
        {canUseAi && remaining !== null && (
          <span className={t.quota}>
            {planAgotado && credits > 0 ? `${credits} créditos comprados` : `${Math.max(0, remaining)} generaciones este ciclo`}
          </span>
        )}
      </div>
      <p className={t.hint}>
        Los primeros segundos deciden si la gente se queda: lo que dices, lo que se lee en pantalla y lo que se ve.
      </p>

      {hooks.length > 0 && (
        <div className={t.cards}>
          {hooks.map((h) => {
            const review = reviews[h.id];
            return (
              <article key={h.id} className={t.card}>
                <div className={t.row}>{h.checks && h.checks.length > 0 && <ScoreBadge checks={h.checks} />}</div>
                <Layers verbal={h.hook_text} text={h.text_overlay} visual={h.visual} plain />
                {h.checks && h.checks.length > 0 && <Checklist checks={h.checks} plain />}
                {review && (
                  <div className={t.card}>
                    {review.verdict && <p className={t.verdict}>{review.verdict}</p>}
                    <p className={t.score}>Versión mejorada</p>
                    <Layers verbal={review.improved.verbal} text={review.improved.text_overlay} visual={review.improved.visual} plain />
                    {review.improved.why && <p className={t.body}>{review.improved.why}</p>}
                    {canSave && (
                      <div className={t.actions}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busy !== null}
                          onClick={() =>
                            guardar(
                              `imp:${h.id}`,
                              {
                                hook_text: review.improved.verbal,
                                text_overlay: review.improved.text_overlay,
                                visual: review.improved.visual,
                                hook_type: review.improved.hook_type,
                                why: review.improved.why,
                              },
                              () =>
                                setReviews((r) => {
                                  const next = { ...r };
                                  delete next[h.id];
                                  return next;
                                }),
                            )
                          }
                        >
                          {busy === `save:imp:${h.id}` ? "Guardando…" : "Guardar como gancho nuevo"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {canUseAi && !review && (
                  <div className={t.actions}>
                    <button type="button" className="btn btn-ghost" onClick={() => revisar(h)} disabled={busy !== null || blocked}>
                      {busy === `review:${h.id}` ? "Revisando…" : "✓ Revisar (1 generación)"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {canUseAi && (
        <div className={t.row}>
          <button type="button" className="btn btn-primary" onClick={nuevos} disabled={busy !== null || blocked}>
            {busy === "new" ? "Pensando ganchos… (unos 15 segundos)" : "✦ 3 ganchos nuevos (1 generación)"}
          </button>
          {blocked && <span className={t.muted}>Se acabaron tus generaciones de este ciclo. Puedes recargar desde Facturación.</span>}
        </div>
      )}
      {error && <p className={t.error}>{error}</p>}

      {proposals.length > 0 && (
        <div className={t.cards}>
          {proposals.map((p, i) => (
            <article key={`${i}:${p.verbal}`} className={t.card}>
              <div className={t.row}>
                <ScoreBadge checks={p.checks} />
              </div>
              <Layers verbal={p.verbal} text={p.text_overlay} visual={p.visual} plain />
              {p.why && <p className={t.body}>{p.why}</p>}
              {canSave && (
                <div className={t.actions}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy !== null}
                    onClick={() =>
                      guardar(
                        `new:${i}`,
                        {
                          hook_text: p.verbal,
                          text_overlay: p.text_overlay,
                          visual: p.visual,
                          hook_type: p.hook_type,
                          checks: p.checks,
                          why: p.why,
                        },
                        () => setProposals((list) => list.filter((_, j) => j !== i)),
                      )
                    }
                  >
                    {busy === `save:new:${i}` ? "Guardando…" : "Guardar este gancho"}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
