/**
 * Las dos llamadas de ganchos de 3 capas, compartidas por el estudio
 * (`/guiones/[id]`, `/ganchos`) y el portal (guion del cliente y "Revisar un
 * gancho" en `/generar`).
 *
 * Solo prompt + modelo + limpieza. La lectura del guion, la pertenencia y el
 * cobro los resuelve cada lado. Lanzan `AiJsonError` si el modelo no devolvió
 * JSON.
 *
 * SERVER-ONLY.
 */

import { MODEL_DEFAULT, MODEL_FAST } from "../ai/anthropic";
import { generateJsonPlain } from "../ai/json";
import {
  HOOK_REVIEW_SYSTEM,
  LAYERED_HOOKS_SYSTEM,
  buildHookReviewPrompt,
  buildLayeredHooksPrompt,
  normalizeHookReview,
  normalizeLayeredHooks,
  type HookReview,
  type LayeredHook,
} from "./prompts";

/** El texto del guion tal como lo leen los prompts de ganchos. */
export function scriptToText(type: string, content: unknown): string {
  const c = (content ?? {}) as { voice_off?: unknown; slides?: unknown };
  if (type === "carousel" && Array.isArray(c.slides)) {
    return c.slides
      .map((sl, i) => {
        const s = sl as { number?: number; text?: string; title?: string; body?: string };
        return `Slide ${s.number ?? i + 1}: ${[s.title, s.text, s.body].filter(Boolean).join(" — ")}`;
      })
      .join("\n");
  }
  return typeof c.voice_off === "string" ? c.voice_off : "";
}

/**
 * "✦ 3 ganchos de 3 capas". `MODEL_DEFAULT` porque el gancho es lo que más
 * pesa en el video y la salida es corta (~700 tokens, ~12-16 s medido).
 */
export async function runLayeredHooks(input: {
  brandContext: string;
  type: "reel" | "carousel";
  brief: string;
  scriptText: string;
}): Promise<LayeredHook[]> {
  const raw = await generateJsonPlain({
    label: "layered-hooks",
    model: MODEL_DEFAULT,
    maxTokens: 1800,
    system: LAYERED_HOOKS_SYSTEM,
    userMessage: buildLayeredHooksPrompt(input),
  });
  return normalizeLayeredHooks(raw);
}

/** Califica con los 7 criterios y propone versión mejorada. `MODEL_FAST`, ~6 s. */
export async function runHookReview(input: {
  brandContext: string | null;
  verbal: string;
  textOverlay: string | null;
  visual: string | null;
  context: string | null;
}): Promise<HookReview | null> {
  const raw = await generateJsonPlain({
    label: "hook-review",
    model: MODEL_FAST,
    maxTokens: 1200,
    system: HOOK_REVIEW_SYSTEM,
    userMessage: buildHookReviewPrompt(input),
  });
  return normalizeHookReview(raw, input.textOverlay);
}
