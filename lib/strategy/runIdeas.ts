/**
 * La llamada del generador de ideas, compartida por `/estrategia` (estudio) y
 * "Ideas para tu semana" del portal.
 *
 * Solo arma el prompt, llama al modelo y limpia la salida: quién puede
 * llamarla, con qué cliente de Supabase se lee la marca y si se cobra lo decide
 * cada lado. El `brandContext` del portal llega **sin `notas`**.
 *
 * SERVER-ONLY.
 */

import { MODEL_FAST } from "../ai/anthropic";
import { generateJsonPlain } from "../ai/json";
import { WEEK_PLANS, buildStrategyContext, type ContentIdea, type IdeaSource, type Strategy } from "./pillars";
import {
  STRATEGY_IDEAS_SYSTEM,
  buildStrategyIdeasPrompt,
  maskInventedNumbers,
  normalizeStrategyIdeas,
  type IdeaFilters,
} from "./prompts";

export type WeekIdea = ContentIdea & { day: number | null };

export const EMPTY_IDEA_FILTERS: IdeaFilters = {
  pillar: null,
  level: null,
  purpose: null,
  format: null,
  format_style: null,
  value_pillar: null,
  hook_type: null,
  script_structure: null,
};

/** Casillas de "Mi semana" para N piezas, o `null` si N no es un plan válido. */
export function weekSlotsFor(posts: number | null | undefined) {
  return posts && posts <= 7 ? (WEEK_PLANS[posts] ?? null) : null;
}

/** Lanza `AiJsonError` si el modelo no devolvió JSON: cada lado lo traduce. */
export async function runStrategyIdeas(input: {
  brandContext: string;
  strategy: Strategy;
  source: IdeaSource;
  material: string | null;
  filters: IdeaFilters;
  previousHooks: string[];
  weekPosts?: number | null;
}): Promise<WeekIdea[]> {
  const strategyContext = buildStrategyContext(input.strategy);
  const weekSlots = weekSlotsFor(input.weekPosts);
  const raw = await generateJsonPlain({
    label: "strategy-ideas",
    model: MODEL_FAST,
    // Medido 2026-10-02 (Vercel): 6 ideas ≈ 2.2k tokens / ~21 s; "Mi semana"
    // de 7 ≈ 2.7k / ~26 s. 5000 deja margen para no cortar por max_tokens,
    // que dispara el reintento de lib/ai/json.ts y duplica la espera.
    maxTokens: 5000,
    system: STRATEGY_IDEAS_SYSTEM,
    userMessage: buildStrategyIdeasPrompt({
      brandContext: input.brandContext,
      strategyContext,
      source: input.source,
      sourceMaterial: input.material,
      filters: input.filters,
      previousHooks: input.previousHooks,
      weekSlots,
    }),
  });
  const knownContext = `${input.brandContext}\n${strategyContext}\n${input.material ?? ""}`;
  let ideas = normalizeStrategyIdeas(raw, {
    pillarKeys: input.strategy.pillars.map((p) => p.key),
    source: input.source,
  }).map((idea) => maskInventedNumbers(idea, knownContext, ["hook", "hook_text", "hook_visual", "angle", "brief"]));
  // En "Mi semana" la casilla manda: si la IA se corrió de día o de nivel, se
  // reacomoda por posición.
  if (weekSlots) {
    ideas = ideas.slice(0, weekSlots.length).map((idea, i) => ({
      ...idea,
      day: weekSlots[i].day,
      stage: weekSlots[i].level,
    }));
  }
  return ideas;
}
