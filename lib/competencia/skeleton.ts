/**
 * Esqueleto de un post de competencia (migración `0021`).
 *
 * Método Andrea, "Nivel 2": antes de reescribir una referencia, sacarle la
 * estructura — cuál es el gancho, en qué segundo cae el primer problema, cómo
 * mantiene la atención, cómo cierra — y armar ESE esqueleto para tu tema, con
 * tu interpretación encima. Se muestra en `AdaptarModal` y viaja a las dos
 * adaptaciones (completa → brief de /guiones/nuevo; ligera → la ruta).
 *
 * Módulo puro: lo usan la server action que extrae, el modal y la ruta.
 *
 * ⚠️ El segundo del primer problema lo calcula el CÓDIGO (`estimateSecond`),
 * no la IA: la transcripción guardada es texto sin tiempos, y el modelo
 * inventaría un número con cara de medido. La IA solo cita la frase; acá se
 * busca en la transcripción y se convierte palabras → segundos. Si la frase no
 * aparece literal, el segundo queda en null y la pantalla muestra "—".
 */

import { HOOK_TYPE_LABELS, HOOK_TYPE_SLUGS, HOOK_TYPES } from "./taxonomy";

/** Ritmo de habla de un reel en español: ~150 palabras por minuto. */
export const WORDS_PER_SECOND = 2.5;

/** Tope del campo "Tu interpretación" (va pegado al prompt). */
export const INTERPRETATION_MAX = 1200;

export type PostSkeleton = {
  /** De dónde salió: con transcripción hay segundos; con caption, no. */
  source: "transcription" | "caption";
  hook: { quote: string; hook_type: string | null; why: string };
  first_problem: {
    quote: string;
    /** El problema en abstracto, sin el tema del competidor. */
    what: string;
    /** Segundo estimado en código. null = sin transcripción o frase no hallada. */
    second: number | null;
  };
  /** 2-4 recursos de retención, en genérico. */
  retention: string[];
  closing: { quote: string; asks: string };
  /** El esqueleto en piezas genéricas, reusables para otro tema. */
  steps: string[];
};

// ─── Medición ────────────────────────────────────────────────────────────────

function normWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * Índice (en palabras) donde arranca `quote` dentro de `text`, o -1.
 * Prueba con las primeras 6, 4 y 3 palabras de la cita: el modelo a veces
 * corrige una coma o cambia una palabra hacia el final, rara vez al inicio.
 */
export function findQuoteWordIndex(text: string, quote: string): number {
  const hay = normWords(text);
  const needle = normWords(quote);
  if (!needle.length || !hay.length) return -1;
  for (const k of [6, 4, 3]) {
    const n = needle.slice(0, Math.min(k, needle.length));
    if (n.length < Math.min(3, needle.length)) continue;
    for (let i = 0; i + n.length <= hay.length; i++) {
      let ok = true;
      for (let j = 0; j < n.length; j++) {
        if (hay[i + j] !== n[j]) {
          ok = false;
          break;
        }
      }
      if (ok) return i;
    }
  }
  return -1;
}

/** Segundo estimado en que se dice `quote` dentro de la transcripción. */
export function estimateSecond(transcription: string, quote: string): number | null {
  const idx = findQuoteWordIndex(transcription, quote);
  if (idx < 0) return null;
  return Math.round(idx / WORDS_PER_SECOND);
}

// ─── Lectura tolerante (jsonb sin esquema / respuesta del modelo) ───────────

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function strList(v: unknown, maxItems: number, maxLen = 240): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Nunca lanza. null si no hay ni gancho ni piezas: no vale la pena mostrarlo. */
export function sanitizeSkeleton(raw: unknown): PostSkeleton | null {
  const r = obj(raw);
  const hook = obj(r.hook);
  const fp = obj(r.first_problem);
  const closing = obj(r.closing);
  const hookType = str(hook.hook_type, 40);
  const second =
    typeof fp.second === "number" && Number.isFinite(fp.second) && fp.second >= 0
      ? Math.round(fp.second)
      : null;

  const sk: PostSkeleton = {
    source: r.source === "caption" ? "caption" : "transcription",
    hook: {
      quote: str(hook.quote),
      hook_type: HOOK_TYPE_SLUGS.includes(hookType) ? hookType : null,
      why: str(hook.why),
    },
    first_problem: { quote: str(fp.quote), what: str(fp.what), second },
    retention: strList(r.retention, 4),
    closing: { quote: str(closing.quote), asks: str(closing.asks) },
    steps: strList(r.steps, 8),
  };
  if (!sk.hook.quote && !sk.steps.length) return null;
  return sk;
}

// ─── Prompts ────────────────────────────────────────────────────────────────

export function buildSkeletonPrompt(input: {
  transcription: string;
  caption: string;
}): string {
  const { transcription, caption } = input;
  const taxonomy = HOOK_TYPES.map((i) => `- ${i.slug}: ${i.definition}`).join("\n");
  const fromTranscript = Boolean(transcription);
  return `Eres analista de contenido de Instagram en español latinoamericano (método Andrea Estratega). Te paso un ${fromTranscript ? "reel transcrito" : "post (solo su descripción)"} de la competencia. Extráele el ESQUELETO: la estructura que lo hace funcionar, separada de su tema.

Responde estas preguntas:
1. ¿Cuál es el gancho? Cítalo y di por qué engancha.
2. ¿Dónde cae el PRIMER PROBLEMA (la primera tensión, dolor o error que plantea)? Cita la frase.
3. ¿Cómo mantiene la atención? 2 a 4 recursos (ej. "promete un resultado y lo paga al final", "lista numerada", "giro inesperado a mitad").
4. ¿Cómo cierra? Cita la frase final y di qué le pide a la audiencia (seguir, comentar una palabra, guardar, link, nada).
5. El esqueleto en 4 a 8 piezas, en orden.

Reglas:
- Las citas ("quote") se COPIAN LITERAL del texto, sin corregir ni resumir. Si no hay frase que aplique, deja "".
- La cita del gancho es SOLO la primera frase (lo que se dice en los primeros 3 segundos): máximo 20 palabras, corta en el primer punto.
- Si la pieza no plantea ningún problema, "first_problem.quote" va "" y "what" dice qué hace en su lugar (ej. "Va directo a la demo, sin plantear problema").
- "what", "retention" y "steps" son GENÉRICOS: describen la jugada, no el tema. Prohibido nombrar el producto, la herramienta, la marca, el nicho, las cifras, los tiempos, los casos o las frases del competidor (ni entre comillas). Usa [tema], [problema], [resultado], [herramienta] como huecos. Bien: "Afirma que [creencia común] está mal". Mal: "Dice que ChatGPT no sirve para editar". Mal: "Revela que el SAT te debe dinero". Mal: "Lo resuelve en menos de 10 minutos".
- Cada recurso de "retention" tiene máximo 14 palabras y no lleva comillas.
- "steps" describe la FUNCIÓN NARRATIVA de cada parte del video (gancho, promesa, prueba, giro, cierre…), NO las instrucciones que da el video. Si es un tutorial, los pasos del tutorial son UNA sola pieza. Bien: "Enseña el proceso en 3 pasos cortos con [herramienta]". Mal: "Haz clic en [opción] y elige el [complemento]".
- La pieza 1 de "steps" es el gancho y la última es el cierre; van en el orden real del video. Cada pieza empieza con un verbo en tercera persona ("Promete…", "Muestra…") y tiene máximo 14 palabras.
- No inventes nada que no esté en el texto.

Tipos de gancho (usa el slug exacto en "hook_type"):
${taxonomy}

Devuelve ÚNICAMENTE este JSON:
{
  "hook": { "quote": "...", "hook_type": "<slug>", "why": "1 frase" },
  "first_problem": { "quote": "...", "what": "el problema en genérico, 1 frase" },
  "retention": ["...", "..."],
  "closing": { "quote": "...", "asks": "..." },
  "steps": ["...", "..."]
}

${caption ? `DESCRIPCIÓN:\n${caption.slice(0, 800)}\n\n` : ""}${fromTranscript ? `TRANSCRIPCIÓN:\n${transcription.slice(0, 5000)}` : ""}`;
}

/** Bloque legible (prompt de adaptación y brief de /guiones/nuevo). */
export function skeletonToText(sk: PostSkeleton): string {
  const lines: string[] = [];
  if (sk.hook.quote || sk.hook.why) {
    const type = sk.hook.hook_type ? ` (${HOOK_TYPE_LABELS[sk.hook.hook_type] ?? sk.hook.hook_type})` : "";
    lines.push(`- Gancho${type}: ${sk.hook.quote ? `"${sk.hook.quote}"` : ""}${sk.hook.why ? ` — ${sk.hook.why}` : ""}`);
  }
  if (sk.first_problem.what || sk.first_problem.quote) {
    const when = sk.first_problem.second != null ? ` (≈ segundo ${sk.first_problem.second})` : "";
    lines.push(`- Primer problema${when}: ${sk.first_problem.what || `"${sk.first_problem.quote}"`}`);
  }
  if (sk.retention.length) lines.push(`- Cómo retiene: ${sk.retention.join("; ")}`);
  if (sk.closing.asks || sk.closing.quote) {
    lines.push(`- Cómo cierra: ${sk.closing.asks || `"${sk.closing.quote}"`}`);
  }
  if (sk.steps.length) {
    lines.push(`- Paso a paso (${sk.steps.length} piezas):`);
    sk.steps.forEach((st, i) => lines.push(`  ${i + 1}. ${st}`));
  }
  return lines.join("\n");
}

/**
 * Lo que se le pega a la adaptación: esqueleto + interpretación del creador.
 * La interpretación lleva la misma regla anti-invención que el resto de los
 * prompts: el modelo convertía "a mí me pasó" en una anécdota con cifras.
 */
export function skeletonInstruction(sk: PostSkeleton | null, interpretation: string): string {
  const parts: string[] = [];
  if (sk) {
    parts.push(
      `── Anatomía del post fuente ──\n${skeletonToText(sk)}\nArma ESTA MISMA anatomía (gancho, momento del primer problema, recursos de retención y tipo de cierre) pero para el tema del cliente. Respeta el orden de las piezas; el contenido de cada una es del cliente.`,
    );
  }
  const interp = interpretation.trim().slice(0, INTERPRETATION_MAX);
  if (interp) {
    parts.push(
      `── Interpretación del creador (manda sobre el post fuente) ──\n"""\n${interp}\n"""\nUsa este ángulo y esta experiencia. No le agregues cifras, casos, plazos ni resultados que no estén escritos aquí o en el perfil del cliente.`,
    );
  }
  return parts.join("\n\n");
}
