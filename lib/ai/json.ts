/**
 * Parseo tolerante + reintento automático de las respuestas JSON de la IA.
 *
 * Por qué existe: los endpoints de `app/api/ai/` le piden a Claude JSON estricto
 * y hacían `JSON.parse()` pelado. Cuando el modelo ensuciaba la respuesta (una
 * frase antes del JSON, un fence raro, una coma de más, o el texto cortado por
 * `max_tokens`) el usuario veía "Error al parsear respuesta de IA" y tenía que
 * volver a apretar el botón. Apretar de nuevo casi siempre funciona: es un
 * tropezón puntual del modelo, no un bug determinístico. Este helper hace ese
 * reintento solo —una sola vez— diciéndole al modelo qué falló.
 *
 * Uso:
 *   const { data } = await generateJson<MiTipo>({ label: "script", userMessage, ... });
 *   // ...y en el catch del handler:
 *   if (e instanceof AiJsonError) return NextResponse.json({ error: "...", raw: e.rawText }, { status: 500 });
 */

import type Anthropic from "@anthropic-ai/sdk";
import {
  anthropic,
  generateWithBrain,
  type GenerateOptions,
  type GenerateResult,
} from "./anthropic";

/** Techo al subir `max_tokens` en el reintento por respuesta cortada. */
const MAX_TOKENS_CEILING = 8192;

/** Intentos totales (1 original + 1 reintento). Subirlo cuesta latencia y tokens. */
const MAX_ATTEMPTS = 2;

export class AiJsonError extends Error {
  /** Texto crudo del último intento — se devuelve al cliente como `raw`. */
  readonly rawText: string;
  readonly attempts: number;

  constructor(label: string, rawText: string, attempts: number) {
    super(`[${label}] la IA no devolvió JSON válido tras ${attempts} intento(s)`);
    this.name = "AiJsonError";
    this.rawText = rawText;
    this.attempts = attempts;
  }
}

const FENCE_RE = /```(?:json)?\s*([\s\S]*?)```/;

/**
 * Intenta sacar un JSON del texto, aguantando la basura habitual del modelo:
 * fences de markdown, texto antes/después del objeto y comas finales.
 * Tira `SyntaxError` si ninguna variante parsea.
 */
export function extractJson<T = Record<string, unknown>>(text: string): T {
  const trimmed = text.trim();

  const candidates = [trimmed];

  const fenced = trimmed.match(FENCE_RE);
  if (fenced) candidates.push(fenced[1].trim());

  const outermost = sliceOutermost(trimmed);
  if (outermost) candidates.push(outermost);

  let lastError: unknown;
  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const variant of [candidate, dropTrailingCommas(candidate)]) {
      try {
        return JSON.parse(variant) as T;
      } catch (e) {
        lastError = e;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new SyntaxError("respuesta vacía o sin JSON");
}

/** Recorta desde el primer `{`/`[` hasta el último `}`/`]`. */
function sliceOutermost(text: string): string | null {
  const starts = [text.indexOf("{"), text.indexOf("[")].filter((i) => i >= 0);
  if (starts.length === 0) return null;
  const start = Math.min(...starts);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (end <= start) return null;
  const sliced = text.slice(start, end + 1);
  return sliced === text ? null : sliced;
}

/**
 * Borra comas colgantes antes de `}` o `]`. Último recurso: solo se prueba
 * cuando el parseo normal ya falló, así que el riesgo de tocar una coma que
 * vivía dentro de un string es aceptable.
 */
function dropTrailingCommas(text: string): string {
  return text.replace(/,(\s*[}\]])/g, "$1");
}

function buildRetryHint(reason: string, truncated: boolean): string {
  return [
    `CORRECCIÓN — tu respuesta anterior no se pudo leer como JSON (${reason}).`,
    "Devuelve el MISMO contenido, ahora como JSON válido y completo:",
    "- Sin markdown, sin ```, sin una sola palabra antes o después del JSON.",
    "- Empieza con { o [ y termina con } o ].",
    "- Escapa las comillas y los saltos de línea que vayan dentro de un string.",
    truncated
      ? "- Tu respuesta anterior se cortó por longitud: sé más breve para que el JSON entre completo."
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

interface JsonAttempt {
  text: string;
  /** La respuesta se cortó por `max_tokens`. */
  truncated: boolean;
}

/**
 * Corre `call` y parsea; si el JSON no se puede leer, la vuelve a correr una
 * vez pasándole un `hint` con el motivo del fallo. `call` decide cómo usar ese
 * hint (típicamente, pegándolo al final del mensaje de usuario).
 */
export async function parseJsonWithRetry<T = Record<string, unknown>>(
  label: string,
  call: (hint: string | null, attempt: number) => Promise<JsonAttempt>,
): Promise<{ data: T; text: string; attempts: number }> {
  let hint: string | null = null;
  let lastText = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { text, truncated } = await call(hint, attempt);
    lastText = text;

    try {
      return { data: extractJson<T>(text), text, attempts: attempt };
    } catch (e) {
      const reason = truncated
        ? "se cortó antes de terminar"
        : e instanceof Error
          ? e.message
          : "formato inesperado";

      if (attempt === MAX_ATTEMPTS) {
        console.error(`[${label}] JSON inválido tras ${attempt} intentos: ${reason}`);
        break;
      }

      console.warn(`[${label}] JSON inválido (${reason}) — reintentando una vez`);
      hint = buildRetryHint(reason, truncated);
    }
  }

  throw new AiJsonError(label, lastText, MAX_ATTEMPTS);
}

/**
 * `generateWithBrain` + parseo tolerante + un reintento. Si la primera pasada
 * se cortó por longitud, el reintento sube `max_tokens`.
 */
export async function generateJson<T = Record<string, unknown>>(
  opts: GenerateOptions & { label: string },
): Promise<{ data: T; result: GenerateResult; attempts: number }> {
  const { label, userMessage, maxTokens = 4096, ...rest } = opts;

  let result!: GenerateResult;
  let wasTruncated = false;

  const parsed = await parseJsonWithRetry<T>(label, async (hint) => {
    result = await generateWithBrain({
      ...rest,
      userMessage: hint ? `${userMessage}\n\n${hint}` : userMessage,
      maxTokens: wasTruncated
        ? Math.min(maxTokens * 2, MAX_TOKENS_CEILING)
        : maxTokens,
    });
    wasTruncated = result.stopReason === "max_tokens";
    return { text: result.text, truncated: wasTruncated };
  });

  return { data: parsed.data, result, attempts: parsed.attempts };
}

/**
 * Igual que `generateJson` pero para los endpoints que no usan el cerebro:
 * system prompt propio y una sola vuelta de mensajes.
 */
export async function generateJsonPlain<T = Record<string, unknown>>(opts: {
  label: string;
  model: string;
  /** Opcional: varios llamadores meten las instrucciones en el propio mensaje. */
  system?: string;
  userMessage: string;
  maxTokens: number;
}): Promise<T> {
  const { label, model, system, userMessage, maxTokens } = opts;
  let wasTruncated = false;

  const parsed = await parseJsonWithRetry<T>(label, async (hint) => {
    const response = await anthropic.messages.create({
      model,
      max_tokens: wasTruncated
        ? Math.min(maxTokens * 2, MAX_TOKENS_CEILING)
        : maxTokens,
      ...(system ? { system } : {}),
      messages: [
        { role: "user", content: hint ? `${userMessage}\n\n${hint}` : userMessage },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    wasTruncated = response.stop_reason === "max_tokens";
    return { text, truncated: wasTruncated };
  });

  return parsed.data;
}
