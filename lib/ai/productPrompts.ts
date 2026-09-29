/**
 * Los tres prompts que giran alrededor de la ficha de un servicio (`0016`):
 *
 *   1. **Ideas** — "Dame ideas para este servicio" en `/guiones/nuevo`.
 *   2. **Preguntas de afinado** — si a la ficha le faltan campos clave, 1-2
 *      preguntas antes de generar (mismo patrón que `copyQuestions.ts`).
 *   3. **Extracción** — "Llenar desde landing" en `/clientes/[id]`.
 *
 * Módulo puro: prompts + normalizadores que nunca lanzan. Las llamadas viven
 * en server actions (`guiones/nuevo/productActions.ts`,
 * `clientes/productActions.ts`).
 */

import {
  PRODUCT_FIELDS,
  isProductFieldKey,
  sanitizeProductDetails,
  type ProductDetails,
  type ProductFieldKey,
} from "@/lib/products/fields";

const TUTEO_RULE =
  "Escribes en español latinoamericano con TUTEO (tú, quieres, tienes). Nada de voseo (vos, querés, tenés).";

// ─── 1. Ideas de contenido para un servicio ──────────────────────────────────

export type IdeaStage = "atraer" | "convencer" | "convertir";

export const IDEA_STAGES: { id: IdeaStage; label: string; hint: string }[] = [
  { id: "atraer", label: "Atraer", hint: "Gente que todavía no sabe que tiene el problema" },
  { id: "convencer", label: "Convencer", hint: "Ya tiene el problema y compara opciones" },
  { id: "convertir", label: "Convertir", hint: "Está lista: falta el empujón" },
];

export type ProductIdea = {
  id: string;
  stage: IdeaStage;
  format: "reel" | "carousel";
  /** Primera frase del contenido. */
  hook: string;
  /** El ángulo en una línea ("objeción: es caro"). */
  angle: string;
  /** El brief listo para pegar en el paso 1 del flujo. */
  brief: string;
};

export const MAX_PRODUCT_IDEAS = 9;

export const PRODUCT_IDEAS_SYSTEM = `Eres estratega de contenido para Instagram. Diseñas ideas de reels y carruseles que promueven un servicio SIN sonar a anuncio: cada pieza aporta valor por sí sola y el servicio aparece como la solución natural.
${TUTEO_RULE}
Siempre devuelves un JSON válido con la estructura indicada, sin markdown y sin explicaciones.`;

export function buildProductIdeasPrompt(input: {
  brandContext: string;
  productContext: string;
  /** Si el usuario ya eligió formato, sesga la mezcla; nunca la vuelve exclusiva. */
  preferredType?: "reel" | "carousel" | null;
  /** Lo que ya escribió en el brief, para no repetirle lo mismo. */
  currentBrief?: string | null;
}): string {
  const { brandContext, productContext, preferredType, currentBrief } = input;
  const mix =
    preferredType === "carousel"
      ? "Mayoría carruseles (al menos 6 de 9), el resto reels."
      : preferredType === "reel"
        ? "Mayoría reels (al menos 6 de 9), el resto carruseles."
        : "Mezcla reels y carruseles según qué formato le sirva más a cada ángulo.";

  return `${brandContext}

${productContext}

---

## Tu tarea
Propón **9 ideas de contenido** para promover este servicio en Instagram: **3 por etapa**.

Etapas:
- **atraer**: para quien todavía no sabe que tiene el problema. Ángulos: el dolor en una escena concreta, un mito, un error común, una verdad incómoda del nicho.
- **convencer**: para quien ya lo sabe y compara. Ángulos: cómo es el proceso por dentro, una objeción respondida, comparación con la alternativa, un caso o resultado real de la ficha.
- **convertir**: para quien está listo. Ángulos: la oferta, la garantía, "qué pasa después de que me escribes". El cierre invita al CTA de la ficha. Urgencia SOLO si la ficha la trae (cupos, fecha límite); si no, nada de urgencia.

Formato: ${mix}
- Reel = una idea que se cuenta en 30-60s con voz, historia o demostración.
- Carrusel = una idea que se lista, compara o explica paso a paso.

${currentBrief?.trim() ? `El usuario ya escribió este brief; propón ángulos DISTINTOS a este:\n"${currentBrief.trim()}"\n\n` : ""}Reglas:
- Cada idea usa datos de la ficha. Si la ficha no tiene prueba social, NO propongas ideas de "casos" o "resultados".
- **Prohibido inventar** cupos, fechas límite, condiciones de pago, plazos, cifras o características que no estén escritos en la ficha. Tampoco "mejores" lo que dice (si dice "sin plazos forzosos", no lo conviertas en "pagas por lo que usas").
- Nada de ideas genéricas que servirían para cualquier servicio ("5 beneficios de…").
- \`hook\`: la primera frase tal como se diría o se leería. Máximo 14 palabras.
- \`angle\`: el ángulo en máximo 8 palabras.
- \`brief\`: 2-3 oraciones que expliquen de qué trata la pieza, qué parte de la ficha usa y a qué invita el cierre. Es lo que se le va a pasar al guionista.

Devuelve ÚNICAMENTE este JSON:
{"ideas": [{"stage": "atraer|convencer|convertir", "format": "reel|carousel", "hook": "...", "angle": "...", "brief": "..."}]}`;
}

export function normalizeProductIdeas(raw: unknown): ProductIdea[] {
  const list = (raw as { ideas?: unknown })?.ideas;
  if (!Array.isArray(list)) return [];

  const stages: IdeaStage[] = ["atraer", "convencer", "convertir"];
  return list
    .map((item) => {
      const i = item as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
      const stage = stages.includes(i.stage as IdeaStage) ? (i.stage as IdeaStage) : "atraer";
      const format: "reel" | "carousel" = i.format === "carousel" ? "carousel" : "reel";
      return { stage, format, hook: str(i.hook), angle: str(i.angle), brief: str(i.brief) };
    })
    .filter((i) => i.hook && i.brief)
    .slice(0, MAX_PRODUCT_IDEAS)
    .map((i, idx) => ({ id: `idea${idx + 1}`, ...i }));
}

// ─── 2. Preguntas de afinado cuando la ficha está incompleta ─────────────────

export type ProductQuestion = {
  id: string;
  /** Campo de la ficha que esta respuesta llenaría — permite "guardar en la ficha". */
  field: ProductFieldKey;
  question: string;
  placeholder: string;
};

export const MAX_PRODUCT_QUESTIONS = 2;

export const PRODUCT_QUESTIONS_SYSTEM = `Eres un director creativo que entrevista a un creador antes de escribir un guion que promueve su servicio.
Haces las MENOS preguntas posibles: solo lo que falta y cambiaría de verdad el guion.
${TUTEO_RULE}
Siempre devuelves un JSON válido con la estructura indicada, sin markdown y sin explicaciones.`;

export function buildProductQuestionsPrompt(input: {
  brandContext: string;
  productContext: string;
  missing: ProductFieldKey[];
  brief: string;
}): string {
  const { brandContext, productContext, missing, brief } = input;
  const missingList = missing
    .map((k) => {
      const f = PRODUCT_FIELDS.find((x) => x.key === k);
      return `- \`${k}\`: ${f?.label ?? k}`;
    })
    .join("\n");

  return `${brandContext}

${productContext}

## Brief del guion
${brief.trim() || "(todavía sin brief)"}

## Campos que le faltan a la ficha
${missingList}

## Tu tarea
Elige de esos campos los **2** que más mejorarían ESTE guion (1 solo si el segundo no aporta) y formula una pregunta por cada uno.

Reglas:
- \`field\` tiene que ser EXACTAMENTE uno de los identificadores de la lista de arriba.
- Nunca preguntes algo que ya responde el brief o la ficha.
- Una pregunta = una sola cosa. **Prohibido encadenar con "y" o con "o"**. Tampoco ofrezcas opciones dentro de la pregunta.
- Máximo 15 palabras por pregunta. Que se pueda contestar en una o dos líneas.
- **Tutea** (tú, quieres, tienes). Nada de voseo.
- El \`placeholder\` es un ejemplo BREVE de respuesta, escrito como lo diría el creador.

Devuelve ÚNICAMENTE este JSON:
{"questions": [{"field": "identificador", "question": "la pregunta", "placeholder": "ejemplo corto"}]}`;
}

export function normalizeProductQuestions(raw: unknown, allowed: ProductFieldKey[]): ProductQuestion[] {
  const list = (raw as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return [];

  const seen = new Set<string>();
  return list
    .map((item) => {
      const q = item as Record<string, unknown>;
      return {
        field: typeof q.field === "string" ? q.field.trim() : "",
        question: typeof q.question === "string" ? q.question.trim() : "",
        placeholder: typeof q.placeholder === "string" ? q.placeholder.trim() : "",
      };
    })
    .filter((q): q is { field: ProductFieldKey; question: string; placeholder: string } => {
      if (!q.question || !isProductFieldKey(q.field)) return false;
      if (!allowed.includes(q.field) || seen.has(q.field)) return false;
      seen.add(q.field);
      return true;
    })
    .slice(0, MAX_PRODUCT_QUESTIONS)
    .map((q, i) => ({ id: `pq${i + 1}`, ...q }));
}

/**
 * Pega las respuestas al brief. Igual que `appendAnswersToContext` del copy:
 * las preguntas sin responder no dejan rastro.
 */
export function appendProductAnswers(
  brief: string,
  questions: ProductQuestion[],
  answers: Record<string, string>,
): string {
  const answered = questions
    .map((q) => ({ q: q.question, a: (answers[q.id] ?? "").trim() }))
    .filter((x) => x.a.length > 0);
  if (answered.length === 0) return brief.trim();
  return [brief.trim(), "", "Detalles del servicio:", ...answered.map((x) => `- ${x.q} ${x.a}`)].join("\n");
}

// ─── 3. Llenar la ficha desde el texto de una landing ────────────────────────

/** Tope del texto pegado. Una landing entera cabe; un PDF de 40 páginas no. */
export const LANDING_TEXT_MAX = 15000;

export const PRODUCT_EXTRACT_SYSTEM = `Extraes información comercial de un texto de venta y la ordenas en una ficha.
Eres literal: solo usas lo que el texto dice. Si un dato no está, devuelves null — nunca lo deduces ni lo inventas.
${TUTEO_RULE}
Siempre devuelves un JSON válido con la estructura indicada, sin markdown y sin explicaciones.`;

export function buildProductExtractPrompt(input: { nombre: string; text: string }): string {
  const fields = PRODUCT_FIELDS.map((f) => `  "${f.key}": "${f.label}" o null`).join(",\n");
  return `Servicio/producto: ${input.nombre}

## Texto de la landing / página de venta
"""
${input.text.trim().slice(0, LANDING_TEXT_MAX)}
"""

## Tu tarea
Llena la ficha de este servicio SOLO con lo que dice el texto.

Reglas:
- Si el texto no menciona un dato, pon null. Prohibido rellenar con suposiciones.
- Cifras, precios, resultados y testimonios: cópialos tal cual aparecen. Nunca redondees ni inventes.
- Redacta cada campo en 1-4 líneas claras, en listas cortas separadas por " · " cuando haya varios puntos.
- \`descripcion\`: qué es el servicio en UNA oración.
- Si el texto trae varios servicios, extrae solo el que se llama "${input.nombre}" (o el principal si no hay coincidencia).

Devuelve ÚNICAMENTE este JSON:
{
  "descripcion": "qué es en una oración" o null,
${fields}
}`;
}

export function normalizeProductExtract(raw: unknown): {
  descripcion: string | null;
  details: Partial<ProductDetails>;
} {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const desc = typeof obj.descripcion === "string" ? obj.descripcion.trim() : "";
  // `null` del modelo → "" → sanitize lo vuelve null. Mismo camino que la UI.
  const cleaned: Record<string, unknown> = {};
  for (const f of PRODUCT_FIELDS) cleaned[f.key] = typeof obj[f.key] === "string" ? obj[f.key] : "";
  return { descripcion: desc || null, details: sanitizeProductDetails(cleaned) };
}
