/**
 * Respuestas del test de estrategia → cliente ideal + 5 pilares + etapa.
 *
 * Lo comparten el portal (`lib/portal/strategy.ts`, guarda directo) y el
 * estudio (`/estrategia`, llena el formulario y Paco guarda). Quién lee el
 * perfil de la marca y con qué cliente de Supabase queda del lado de cada uno:
 * acá entran los textos ya armados.
 *
 * `MODEL_FAST`: corre síncrono dentro de la Netlify Function (~26-30s).
 *
 * SERVER-ONLY (llama a la API de Anthropic).
 */

import { MODEL_FAST } from "../ai/anthropic";
import { generateJsonPlain } from "../ai/json";
import { ACCOUNT_PHASES, type AccountPhase, type Pillar, type StrategyFieldKey } from "./pillars";
import { STRATEGY_TEST_SYSTEM, buildStrategyTestPrompt, normalizeStrategyDraft } from "./prompts";
import { phaseFromAnswers, testAnswersToText, type TestAnswers } from "./test";

export type StrategyFromTest = {
  fields: Partial<Record<StrategyFieldKey, string>>;
  pillars: Pillar[];
  account_phase: AccountPhase;
};

/** Lanza `AiJsonError` si el modelo no devuelve JSON, o `Error` si no trae pilares. */
export async function strategyFromTest(input: {
  answers: TestAnswers;
  brandContext: string;
  productsContext: string;
}): Promise<StrategyFromTest> {
  const account_phase = phaseFromAnswers(input.answers);
  const phase = ACCOUNT_PHASES.find((p) => p.id === account_phase)!;

  const raw = await generateJsonPlain({
    label: "strategy-test",
    model: MODEL_FAST,
    maxTokens: 3500,
    system: STRATEGY_TEST_SYSTEM,
    userMessage: buildStrategyTestPrompt({
      brandContext: input.brandContext,
      productsContext: input.productsContext,
      answersText: testAnswersToText(input.answers),
      phaseLabel: `${phase.label}. ${phase.hint} Reparto: ${phase.mix}`,
    }),
  });

  const draft = normalizeStrategyDraft(raw);
  if (draft.pillars.length === 0) throw new Error("La IA no devolvió pilares. Intenta de nuevo.");
  return { ...draft, account_phase };
}
