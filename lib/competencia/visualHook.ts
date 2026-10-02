/**
 * Gancho visual de un reel de competencia (migración `0023`).
 *
 * La anatomía (`skeleton.ts`) sale de la transcripción y solo ve lo que se
 * DICE. El gancho tiene 3 capas (`lib/hooks/criteria.ts`): lo que se lee, lo
 * que se ve en el primer segundo y lo que se dice — las dos primeras solo
 * existen en el video. Gemini mira los primeros 3, 5 o 10 segundos (nunca el
 * reel completo: se paga por cuadro) y devuelve las 3 capas + los 7 criterios
 * de Andrea, con la misma forma que los ganchos de `/guiones` y `/ganchos`.
 *
 * Módulo puro: lo usan la server action, el modal y el brief de Adaptar.
 *
 * ⚠️ `texto_pantalla` y `largo_texto` los pisa el código
 * (`withMeasuredChecks`): el modelo cuenta mal las palabras.
 */

import {
  HOOK_CRITERIA,
  HOOK_RULES_PROMPT,
  normalizeChecks,
  scoreChecks,
  withMeasuredChecks,
  wordCount,
  type HookCheck,
} from "../hooks/criteria";
import { HOOK_TYPE_LABELS, HOOK_TYPE_SLUGS, HOOK_TYPES } from "./taxonomy";

/** Segundos que se pueden mirar. 10 es para casos raros (gancho lento). */
export const VISUAL_HOOK_SECONDS = [3, 5, 10] as const;
export type VisualHookSeconds = (typeof VISUAL_HOOK_SECONDS)[number];
export const DEFAULT_VISUAL_HOOK_SECONDS: VisualHookSeconds = 5;

/** Más cuadros cuanto más corto el tramo (~25-30 cuadros en total). */
export const FPS_BY_SECONDS: Record<VisualHookSeconds, number> = { 3: 8, 5: 5, 10: 3 };

export function toVisualHookSeconds(v: unknown): VisualHookSeconds {
  return VISUAL_HOOK_SECONDS.includes(v as VisualHookSeconds) ? (v as VisualHookSeconds) : DEFAULT_VISUAL_HOOK_SECONDS;
}

export const HOOK_LAYERS = ["texto", "visual", "verbal"] as const;
export type HookLayer = (typeof HOOK_LAYERS)[number];
export const HOOK_LAYER_LABELS: Record<HookLayer, string> = {
  texto: "Texto en pantalla",
  visual: "Lo que se ve",
  verbal: "Lo que se dice",
};

export const CAMERA_KINDS = ["fija", "movimiento", "cortes"] as const;
export type CameraKind = (typeof CAMERA_KINDS)[number];
export const CAMERA_LABELS: Record<CameraKind, string> = {
  fija: "Cámara fija",
  movimiento: "Cámara en movimiento",
  cortes: "Cortes rápidos",
};

export type VisualHook = {
  /** Segundos que se miraron. */
  seconds: number;
  /** Texto en pantalla, literal. "" = no hay. */
  text_overlay: string;
  /** Segundo en que aparece el texto (lo dice el modelo; es aproximado). */
  text_second: number | null;
  /** Qué se ve en el primer segundo, concreto. */
  first_second: string;
  /** Lo que se dice en el tramo, literal. "" = nadie habla. */
  verbal: string;
  /** Dónde vive el gancho, de más a menos peso. */
  layers: HookLayer[];
  camera: CameraKind | null;
  camera_note: string;
  /** ¿Se entiende con el volumen apagado? */
  silent_ok: boolean | null;
  silent_note: string;
  hook_type: string | null;
  checks: HookCheck[];
  /** La jugada en genérico, para replicarla en otro tema. */
  lesson: string;
};

// ─── Lectura tolerante ──────────────────────────────────────────────────────

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Nunca lanza. null si no trae nada que mostrar. */
export function sanitizeVisualHook(raw: unknown): VisualHook | null {
  const r = obj(raw);
  const layers = (Array.isArray(r.layers) ? r.layers : [])
    .filter((x): x is HookLayer => HOOK_LAYERS.includes(x as HookLayer))
    .filter((x, i, a) => a.indexOf(x) === i);
  const camera = CAMERA_KINDS.includes(r.camera as CameraKind) ? (r.camera as CameraKind) : null;
  const hookType = str(r.hook_type, 40);
  const textOverlay = str(r.text_overlay, 300);
  const ts = typeof r.text_second === "number" && Number.isFinite(r.text_second) && r.text_second >= 0
    ? Math.round(r.text_second * 10) / 10
    : null;

  const vh: VisualHook = {
    seconds: typeof r.seconds === "number" ? r.seconds : DEFAULT_VISUAL_HOOK_SECONDS,
    text_overlay: textOverlay,
    text_second: textOverlay ? ts : null,
    first_second: str(r.first_second),
    verbal: str(r.verbal, 500),
    layers,
    camera,
    camera_note: str(r.camera_note, 200),
    silent_ok: typeof r.silent_ok === "boolean" ? r.silent_ok : null,
    silent_note: str(r.silent_note, 200),
    hook_type: HOOK_TYPE_SLUGS.includes(hookType) ? hookType : null,
    checks: withMeasuredChecks(normalizeChecks(r.checks), textOverlay),
    lesson: str(r.lesson),
  };
  if (!vh.first_second && !vh.text_overlay && !vh.verbal) return null;
  return vh;
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

export function buildVisualHookPrompt(input: { seconds: number; caption: string }): string {
  const criteria = HOOK_CRITERIA.map((c) => `- ${c.id}: ${c.label}. ${c.hint}`).join("\n");
  const taxonomy = HOOK_TYPES.map((i) => `- ${i.slug}: ${i.definition}`).join("\n");
  return `Eres analista de ganchos de Instagram (método Andrea Estratega). Te paso SOLO los primeros ${input.seconds} segundos de un reel de la competencia. Analiza el GANCHO tal como se ve y se oye, cuadro por cuadro.

${HOOK_RULES_PROMPT}

Responde:
1. text_overlay: el texto en pantalla que aparece en estos segundos, COPIADO LITERAL (respeta palabras y orden; une las líneas de un mismo letrero con un espacio). No incluyas subtítulos automáticos que solo repiten lo que se dice palabra por palabra; si SOLO hay subtítulos, ponlos y dilo en "silent_note". Si no hay texto, "".
2. text_second: segundo en que aparece ese texto por primera vez (0 si está desde el inicio). null si no hay texto.
3. first_second: qué se VE en el primer segundo, concreto y en 1 frase (persona, encuadre, objeto, acción, pantalla, escena). Nada de interpretar intenciones.
4. verbal: lo que se DICE en estos segundos, literal. "" si nadie habla (solo música).
5. layers: dónde vive el gancho — las capas que de verdad cargan la atención, de más a menos peso: "texto", "visual", "verbal". Una capa que existe pero no engancha (ej. un subtítulo que repite) NO va.
6. camera: "fija" (sin cortes ni movimiento de cámara; puede moverse la persona), "movimiento" (paneo, zoom, cámara en mano) o "cortes" (2 o más cortes de edición en el tramo). camera_note: 1 frase de qué viste.
7. silent_ok: ¿se entiende de qué va con el volumen apagado? true/false. silent_note: por qué, 1 frase.
8. hook_type: el tipo de gancho (slug exacto de la lista).
9. checks: evalúa los 7 criterios. status "ok", "falla" o "na" (no aplica); note de máximo 12 palabras con lo que viste.
10. lesson: la jugada del gancho en GENÉRICO para replicarla en otro tema, máximo 25 palabras. Usa [tema], [resultado], [objeto] como huecos. Prohibido nombrar la marca, el producto, el nicho, las cifras o las frases del competidor. Bien: "Muestra el [resultado] terminado en mano en el segundo 0 y lo explica después". Mal: "Muestra la cocina de 3 millones".

Reglas:
- Describe SOLO lo que está en el video. No inventes texto, cifras ni acciones que no veas u oigas.
- Si el tramo no alcanza a mostrar algo (ej. el texto aparece después), no lo supongas.
- Español latinoamericano, tuteo.

Criterios (id exacto en "checks"):
${criteria}

Tipos de gancho:
${taxonomy}
${input.caption ? `\nDescripción del post (solo contexto, NO es texto en pantalla):\n${input.caption.slice(0, 500)}\n` : ""}
Devuelve ÚNICAMENTE este JSON:
{
  "text_overlay": "...",
  "text_second": 0,
  "first_second": "...",
  "verbal": "...",
  "layers": ["texto", "visual"],
  "camera": "fija",
  "camera_note": "...",
  "silent_ok": true,
  "silent_note": "...",
  "hook_type": "<slug>",
  "checks": [{ "id": "texto_pantalla", "status": "ok", "note": "..." }],
  "lesson": "..."
}`;
}

// ─── Texto para el brief de Adaptar ─────────────────────────────────────────

export function visualHookToText(vh: VisualHook): string {
  const lines: string[] = [];
  if (vh.text_overlay) {
    lines.push(`- Texto en pantalla (${wordCount(vh.text_overlay)} palabras): "${vh.text_overlay}"`);
  } else {
    lines.push("- Texto en pantalla: no tiene");
  }
  if (vh.first_second) lines.push(`- Primer segundo: ${vh.first_second}`);
  if (vh.verbal) lines.push(`- Dice: "${vh.verbal}"`);
  if (vh.layers.length) lines.push(`- El gancho vive en: ${vh.layers.map((l) => HOOK_LAYER_LABELS[l]).join(" > ")}`);
  if (vh.camera) lines.push(`- ${CAMERA_LABELS[vh.camera]}${vh.camera_note ? ` — ${vh.camera_note}` : ""}`);
  if (vh.silent_ok != null) lines.push(`- Sin audio: ${vh.silent_ok ? "se entiende" : "no se entiende"}`);
  if (vh.hook_type) lines.push(`- Tipo: ${HOOK_TYPE_LABELS[vh.hook_type] ?? vh.hook_type}`);
  const { ok, total } = scoreChecks(vh.checks);
  if (total) lines.push(`- Criterios de Andrea: ${ok}/${total}`);
  if (vh.lesson) lines.push(`- La jugada: ${vh.lesson}`);
  return lines.join("\n");
}

/** Bloque que se pega a la adaptación (completa y ligera). */
export function visualHookInstruction(vh: VisualHook | null): string {
  if (!vh) return "";
  return `── Gancho visual del post fuente (primeros ${vh.seconds} s, analizado en el video) ──\n${visualHookToText(vh)}\nCopia la JUGADA del gancho (dónde vive, qué se ve en el segundo 0, cámara, se entiende sin audio) para el tema del cliente. El texto, el objeto y la frase son del cliente: no reuses sus palabras ni sus cifras.`;
}
