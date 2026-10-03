"use client";

/**
 * "Ideas para tu semana" (portal). Pide 3, 5 o 7 ideas encadenadas (una por
 * día), y el cliente guarda **solo las que le gustan** — ninguna entra sola al
 * banco ni al calendario (decisión de Paco, 2026-10-02).
 *
 * Generar cobra (1 por 3 piezas, 2 por 5 o 7); guardar y quitar son gratis.
 * Todo en lenguaje de cliente: los niveles de consciencia, propósitos y
 * formatos salen de `AWARENESS_PLAIN` / `PURPOSE_PLAIN` / `formatStylePlain`.
 *
 * El `blocked` espeja al servidor: cupo agotado no bloquea si hay recargas.
 */

import { useState } from "react";
import Link from "next/link";
import { Layers } from "@/components/hooks/HookParts";
import { WEEK_DAYS, type ContentIdea, type Pillar } from "@/lib/strategy/pillars";
import { AWARENESS_PLAIN, PURPOSE_PLAIN, formatStylePlain } from "@/lib/strategy/test";
import type { WeekIdea } from "@/lib/strategy/runIdeas";
import type { PortalUsage } from "@/lib/portal/weekIdeas";
import { weekIdeasCost } from "@/lib/billing/plan";
import { guardarIdea, pedirSemana, quitarIdea } from "./actions";
import t from "@/components/portal/aiTools.module.css";

const SIZES = [3, 5, 7].map((posts) => ({ posts, cost: weekIdeasCost(posts) }));

/** El brief que viaja a `/generar`: la idea + el gancho de 3 capas. */
function generarHref(clientId: string, idea: ContentIdea): string {
  const lines = [
    idea.brief,
    "",
    `Gancho sugerido — dices: "${idea.hook}"`,
    idea.hook_text ? `Se lee en pantalla: "${idea.hook_text}"` : null,
    idea.hook_visual ? `Se ve en el primer segundo: ${idea.hook_visual}` : null,
  ].filter((l) => l !== null);
  const params = new URLSearchParams({ brief: lines.join("\n"), tipo: idea.format });
  return `/portal/${clientId}/generar?${params.toString()}`;
}

export default function WeekIdeasPanel({
  clientId,
  pillars,
  canGenerate,
  canSave,
  initialSaved,
  initialUsage,
}: {
  clientId: string;
  pillars: Pillar[];
  /** `generar_ia` prendido y rol que no es `viewer`. */
  canGenerate: boolean;
  /** `collaborator` o dueño. */
  canSave: boolean;
  initialSaved: ContentIdea[];
  initialUsage: PortalUsage | null;
}) {
  const [posts, setPosts] = useState(3);
  const [fresh, setFresh] = useState<WeekIdea[]>([]);
  const [saved, setSaved] = useState<ContentIdea[]>(initialSaved);
  const [usage, setUsage] = useState<PortalUsage | null>(initialUsage);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cost = weekIdeasCost(posts);
  const remaining = usage?.remaining ?? null;
  const credits = usage?.creditBalance ?? 0;
  const available = remaining === null ? Infinity : Math.max(0, remaining) + credits;
  const blocked = available < cost;
  const pillarName = (key: string | null) => pillars.find((p) => p.key === key)?.name ?? null;

  if (!canGenerate && saved.length === 0) return null;

  async function generar() {
    setLoading(true);
    setError(null);
    try {
      const res = await pedirSemana({ clientId, posts });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFresh(res.ideas);
      setUsage(res.usage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos armar tu semana.");
    } finally {
      setLoading(false);
    }
  }

  async function guardar(idea: WeekIdea) {
    setBusyId(idea.id);
    setError(null);
    try {
      const res = await guardarIdea({ clientId, idea });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved((list) => [res.idea, ...list]);
      setFresh((list) => list.filter((i) => i.id !== idea.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la idea.");
    } finally {
      setBusyId(null);
    }
  }

  async function quitar(idea: ContentIdea) {
    setBusyId(idea.id);
    setError(null);
    const snapshot = saved;
    setSaved((list) => list.filter((i) => i.id !== idea.id));
    try {
      const res = await quitarIdea({ clientId, ideaId: idea.id });
      if (!res.ok) {
        setSaved(snapshot);
        setError(res.error ?? "No se pudo quitar la idea.");
      }
    } catch (e) {
      setSaved(snapshot);
      setError(e instanceof Error ? e.message : "No se pudo quitar la idea.");
    } finally {
      setBusyId(null);
    }
  }

  function renderIdea(idea: ContentIdea & { day?: number | null }, isSaved: boolean) {
    const pillar = pillarName(idea.pillar_key);
    const format = formatStylePlain(idea.format_style);
    return (
      <article key={idea.id} className={`${t.card} ${isSaved ? t.cardSaved : ""}`}>
        {typeof idea.day === "number" && <span className={t.day}>{WEEK_DAYS[idea.day]}</span>}
        <div className={t.tags}>
          <span className={t.tag}>{idea.format === "carousel" ? "Carrusel" : "Reel"}</span>
          {pillar && <span className={t.tag}>{pillar}</span>}
          <span className={t.tag}>{AWARENESS_PLAIN[idea.stage]}</span>
          {idea.purpose && <span className={t.tag}>{PURPOSE_PLAIN[idea.purpose]}</span>}
        </div>
        <Layers verbal={idea.hook} text={idea.hook_text} visual={idea.hook_visual} plain />
        <p className={t.body}>{idea.brief}</p>
        {format && <p className={t.muted}>Cómo grabarlo: {format}</p>}
        <div className={t.actions}>
          {!isSaved && canSave && (
            <button type="button" className="btn btn-secondary" onClick={() => guardar(idea as WeekIdea)} disabled={busyId === idea.id}>
              {busyId === idea.id ? "Guardando…" : "♡ Me gusta, guardar"}
            </button>
          )}
          {canGenerate && (
            <Link href={generarHref(clientId, idea)} className="btn btn-ghost">
              Escribir este guion →
            </Link>
          )}
          {isSaved && canSave && (
            <button type="button" className="btn btn-ghost" onClick={() => quitar(idea)} disabled={busyId === idea.id}>
              Quitar
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <section className={t.panel} style={{ marginBottom: 30 }}>
      <div className={t.head}>
        <h3 className={t.title}>Ideas para tu semana</h3>
        {canGenerate && usage && remaining !== null && (
          <span className={t.quota}>
            {remaining <= 0 && credits > 0 ? `${credits} créditos comprados` : `${Math.max(0, remaining)} generaciones este ciclo`}
          </span>
        )}
      </div>

      {canGenerate && (
        <>
          <p className={t.hint}>
            Te armamos una semana de publicaciones a partir de tus temas: cada día le habla a alguien que está en un
            momento distinto, del que todavía no sabe que tiene el problema al que ya casi te elige. Guarda solo las que
            te gusten.
          </p>
          <div className={t.row}>
            {SIZES.map((x) => (
              <button
                key={x.posts}
                type="button"
                className={`${t.choice} ${posts === x.posts ? t.choiceActive : ""}`}
                onClick={() => setPosts(x.posts)}
                disabled={loading}
              >
                {x.posts} publicaciones
                <small>{x.cost === 1 ? "1 generación" : `${x.cost} generaciones`}</small>
              </button>
            ))}
          </div>
          <div className={t.row}>
            <button type="button" className="btn btn-primary" onClick={generar} disabled={loading || blocked}>
              {loading ? "Armando tu semana… (unos 20-30 segundos)" : "✦ Dame ideas para mi semana"}
            </button>
            {blocked && !loading && (
              <span className={t.muted}>
                No te alcanzan las generaciones para esta opción. Elige menos publicaciones o recarga desde Facturación.
              </span>
            )}
          </div>
        </>
      )}
      {error && <p className={t.error}>{error}</p>}

      {fresh.length > 0 && (
        <>
          <p className={t.muted}>Las que no guardes se pierden al salir de esta pantalla.</p>
          <div className={t.cards}>{fresh.map((idea) => renderIdea(idea, false))}</div>
        </>
      )}

      {saved.length > 0 && (
        <>
          <h4 className={t.title} style={{ fontSize: 15, marginTop: 8 }}>
            Tus ideas guardadas
          </h4>
          <div className={t.cards}>{saved.map((idea) => renderIdea(idea, true))}</div>
        </>
      )}
    </section>
  );
}
