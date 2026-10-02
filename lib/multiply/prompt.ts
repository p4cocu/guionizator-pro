/**
 * "✦ Multiplicar" (punto 6): de una pieza propia que funcionó, sacar su
 * esqueleto y proponer 3 variaciones que lo mantienen y cambian UNA sola cosa
 * cada una — método Andrea: "se multiplica este contenido si es que realmente
 * funcionó".
 *
 * Una sola llamada (`MODEL_FAST`) devuelve esqueleto + variaciones: corre
 * síncrona dentro de la Function de Netlify (~26 s de límite). Por eso son
 * PROPUESTAS cortas y no guiones completos: "Desarrollar" lleva cada una a
 * /guiones/nuevo, que es donde se escribe el guion.
 *
 * El esqueleto tiene la misma forma que el de Competencia (`PostSkeleton`,
 * `sanitizeSkeleton`) para reusar su render y su texto. Acá no hay segundos:
 * el guion propio no tiene tiempos y nadie los necesita para variarlo.
 *
 * Módulo puro.
 */

import { HOOK_RULES_PROMPT, wordCount } from "@/lib/hooks/criteria";
import { HOOK_TYPES } from "@/lib/competencia/taxonomy";
import { sanitizeSkeleton, skeletonToText, type PostSkeleton } from "@/lib/competencia/skeleton";

export type VariationAxis = "linea" | "gancho" | "formato";

export const VARIATION_AXES: { id: VariationAxis; label: string; rule: string }[] = [
  {
    id: "linea",
    label: "Otra línea narrativa",
    rule: "mismo esqueleto y MISMO TIPO de gancho que la original, pero sobre OTRO TEMA: una línea narrativa u objeción distinta, tomada de los pilares de la estrategia. En \"what_changes\" cita esa línea narrativa tal como aparece en la estrategia, con el NOMBRE del pilar (nunca su clave entre comillas invertidas). No vale el mismo tema con otro enfoque: eso es otra variación",
  },
  {
    id: "gancho",
    label: "Otro gancho",
    rule: "mismo tema y mismo esqueleto, pero abre con OTRO TIPO de gancho de la lista (distinto al de la pieza original)",
  },
  {
    id: "formato",
    label: "Otro formato",
    rule: "mismo tema y mismo esqueleto, pero en OTRO FORMATO de grabación (ej. si fue cámara a cuadro → pantalla grabada, demo, caso, lista, carrusel)",
  },
];

export type Variation = {
  axis: VariationAxis;
  /** Reel o carrusel: "Otro formato" puede cambiarlo, y /guiones/nuevo lo necesita. */
  type: "reel" | "carousel";
  /** Qué cambia respecto a la original, 1 frase. */
  what_changes: string;
  title: string;
  /** El ángulo en 2-3 frases. */
  angle: string;
  hook: string;
  hook_text: string;
  hook_visual: string;
};

export type MultiplyResult = {
  skeleton: PostSkeleton;
  variations: Variation[];
};

export function buildMultiplyPrompt(input: {
  brandContext: string;
  strategyContext: string;
  scriptTitle: string;
  scriptType: string;
  scriptText: string;
  performance: string;
}): string {
  const taxonomy = HOOK_TYPES.map((i) => `- ${i.slug}: ${i.label}`).join("\n");
  const axes = VARIATION_AXES.map((a) => `- "${a.id}": ${a.rule}`).join("\n");
  return `Eres estratega de contenido de Instagram en español latinoamericano (tuteo, método Andrea Estratega). Esta pieza PROPIA de la marca ya se publicó y FUNCIONÓ: ${input.performance}. Tu trabajo es multiplicarla.

Paso 1 — Sácale el ESQUELETO: la estructura que la hizo funcionar, separada de su tema.
Paso 2 — Propón 3 VARIACIONES, una por eje, que mantienen ese esqueleto y cambian UNA sola cosa:
${axes}

Reglas del esqueleto:
- Las citas ("quote") se COPIAN LITERAL del guion. La del gancho es solo la primera frase, máximo 20 palabras.
- "what", "retention" y "steps" son GENÉRICOS: describen la jugada, no el tema. Usa [tema], [problema], [resultado], [herramienta] como huecos.
- "retention": 2 o 3 recursos, máximo 14 palabras cada uno.
- "steps": 4 a 7 piezas en orden, cada una empieza con un verbo en tercera persona ("Promete…", "Muestra…") y tiene máximo 14 palabras. La 1 es el gancho y la última el cierre.

Reglas de las variaciones:
- Cada una se queda DENTRO de la estrategia de la marca (sus pilares y líneas narrativas). Nada de temas nuevos que la marca no trabaja.
- PROHIBIDO inventar cifras, porcentajes, plazos, casos de clientes, testimonios, ofertas, precios o recursos ("plantilla en mi bio"). Si hace falta un dato, deja el hueco [N] o [dato] para que la marca ponga el suyo.
- Español latinoamericano con TUTEO: "generas", "puedes", "haz". PROHIBIDO el voseo ("generás", "podés", "hacé").
- "type": "reel" o "carousel". Igual al original salvo que la variación de formato lo cambie.
- "title": máximo 10 palabras. "angle": 2 frases que digan de qué va y qué gana quien lo ve. "what_changes": 1 frase que diga qué cambia respecto a la original.
- El gancho de cada variación va en 3 capas, las tres OBLIGATORIAS: "dice" (la primera frase que se dice, declarando), "pantalla" (texto en pantalla, de 8 a 12 palabras: CUÉNTALAS, pero NO escribas el conteo) y "se_ve" (lo que se ve en el primer segundo, concreto).
- Las tres variaciones son distintas entre sí y distintas de la original.

${HOOK_RULES_PROMPT}

Tipos de gancho (para "hook_type" del esqueleto, usa el slug exacto):
${taxonomy}

Devuelve ÚNICAMENTE este JSON:
{
  "skeleton": {
    "hook": { "quote": "...", "hook_type": "<slug>", "why": "1 frase" },
    "first_problem": { "quote": "...", "what": "1 frase genérica" },
    "retention": ["...", "..."],
    "closing": { "quote": "...", "asks": "..." },
    "steps": ["...", "..."]
  },
  "variations": [
    { "axis": "linea", "type": "reel", "what_changes": "...", "title": "...", "angle": "...", "dice": "...", "pantalla": "...", "se_ve": "..." },
    { "axis": "gancho", ... },
    { "axis": "formato", ... }
  ]
}

${input.brandContext}

${input.strategyContext}

## La pieza que funcionó (${input.scriptType === "carousel" ? "carrusel" : "reel"})
Título: ${input.scriptTitle || "(sin título)"}

${input.scriptText.slice(0, 5000)}`;
}

function str(v: unknown, max = 600): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** El modelo a veces pega el conteo que se le pidió: "… sin plugins (9 palabras)". */
function stripCount(text: string): string {
  return text.replace(/\s*\((?:\d+|\[N\])\s+palabras?\)\s*$/i, "").trim();
}

/** Nunca lanza. null si no hay esqueleto ni variaciones utilizables. */
export function sanitizeMultiply(raw: unknown, fallbackType: "reel" | "carousel"): MultiplyResult | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sk = sanitizeSkeleton({ ...(r.skeleton as object), source: "transcription" });
  if (!sk) return null;
  // Sin transcripción con tiempos: el segundo no aplica en una pieza propia.
  sk.first_problem.second = null;

  const seen = new Set<VariationAxis>();
  const variations: Variation[] = [];
  for (const v of Array.isArray(r.variations) ? r.variations : []) {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const axis = VARIATION_AXES.find((a) => a.id === o.axis)?.id;
    if (!axis || seen.has(axis)) continue;
    const item: Variation = {
      axis,
      type: o.type === "carousel" ? "carousel" : o.type === "reel" ? "reel" : fallbackType,
      what_changes: str(o.what_changes, 300),
      title: str(o.title, 160),
      angle: str(o.angle),
      hook: str(o.dice ?? o.hook, 300),
      hook_text: stripCount(str(o.pantalla ?? o.hook_text, 200)),
      hook_visual: str(o.se_ve ?? o.hook_visual, 300),
    };
    if (!item.title || !item.angle) continue;
    seen.add(axis);
    variations.push(item);
  }
  if (!variations.length) return null;
  return { skeleton: sk, variations };
}

/** Largo del texto en pantalla medido en código (el modelo cuenta mal). */
export function hookTextWarning(v: Variation): string | null {
  const n = wordCount(v.hook_text);
  if (!n) return "Sin texto en pantalla";
  if (n < 8 || n > 12) return `Texto en pantalla de ${n} palabras (ideal 8-12)`;
  return null;
}

/** El brief con el que "Desarrollar" abre /guiones/nuevo. */
export function variationBrief(input: {
  originalTitle: string;
  performance: string;
  skeleton: PostSkeleton;
  variation: Variation;
}): string {
  const { variation: v } = input;
  const axis = VARIATION_AXES.find((a) => a.id === v.axis)!;
  return [
    `Multiplicar lo que funcionó: variación de mi pieza «${input.originalTitle || "sin título"}» (${input.performance}).`,
    "",
    `Variación — ${axis.label}: ${v.what_changes}`,
    `Título: ${v.title}`,
    v.angle,
    "",
    "Gancho propuesto:",
    v.hook_text && `- Texto en pantalla: ${v.hook_text}`,
    v.hook_visual && `- Lo que se ve: ${v.hook_visual}`,
    v.hook && `- Lo que se dice: ${v.hook}`,
    "",
    `── Anatomía de la pieza original ──\n${skeletonToText(input.skeleton)}`,
    "Mantén ESTA anatomía (orden de las piezas, tipo de cierre y recursos de retención). Cambia solo lo que dice la variación. No agregues cifras, casos, plazos ni ofertas que no estén en el perfil de la marca.",
  ]
    .filter((l): l is string => typeof l === "string")
    .join("\n");
}
