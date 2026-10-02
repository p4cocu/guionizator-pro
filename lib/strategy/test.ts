/**
 * Test de estrategia (migración `0019`): un cuestionario sin jerga que llena el
 * cliente ideal, los 5 pilares y la etapa de la cuenta.
 *
 * - Las preguntas de texto alimentan a la IA (`buildStrategyTestPrompt`).
 * - La ETAPA no la decide la IA: sale de `phaseFromAnswers`, con reglas fijas
 *   sobre las 4 preguntas de opción. Así es predecible y se puede explicar.
 * - `sanitizeTestAnswers` es el único camino de escritura de
 *   `content_strategies.test_answers`.
 *
 * Lo usan el portal (`/portal/[id]/estrategia`) y el estudio (`/estrategia`,
 * "Hacer el test"). Módulo puro: no importa Supabase.
 */

import type { AccountPhase, AndreaPillar } from "./pillars";

export type TestQuestion =
  | { key: string; kind: "text"; label: string; hint: string; required: boolean }
  | { key: string; kind: "choice"; label: string; options: { id: string; label: string }[] };

export const TEST_BLOCKS: { title: string; intro: string; questions: TestQuestion[] }[] = [
  {
    title: "Tu cliente",
    intro: "Piensa en la persona que más te gustaría tener como cliente. Escribe como hablas, no como folleto.",
    questions: [
      {
        key: "quien",
        kind: "text",
        label: "¿A quién le vendes?",
        hint: "Descríbelo como si me lo presentaras: a qué se dedica, cómo es su día, dónde está.",
        required: true,
      },
      {
        key: "problema",
        kind: "text",
        label: "¿Qué le quita el sueño antes de llegar contigo?",
        hint: "Con sus palabras, como te lo cuenta. Si son varias cosas, una por línea.",
        required: true,
      },
      {
        key: "deseo",
        kind: "text",
        label: "¿Qué quiere lograr?",
        hint: "Cómo se ve su vida o su negocio cuando eso se resuelve.",
        required: true,
      },
      {
        key: "frenos",
        kind: "text",
        label: "¿Qué te dicen antes de no comprar?",
        hint: "Precio, tiempo, desconfianza, \"lo hago yo solo\"… lo que más escuchas.",
        required: false,
      },
    ],
  },
  {
    title: "Tu negocio",
    intro: "Lo que haces y por qué contigo y no con otro.",
    questions: [
      {
        key: "oferta",
        kind: "text",
        label: "¿Qué vendes?",
        hint: "Tus productos o servicios principales, como se los explicas a alguien.",
        required: true,
      },
      {
        key: "diferencia",
        kind: "text",
        label: "¿Qué haces distinto a los demás que venden lo mismo?",
        hint: "Tu forma de trabajar, tu experiencia, algo que solo tú haces.",
        required: true,
      },
      {
        key: "resultado",
        kind: "text",
        label: "¿Qué logra quien trabaja contigo?",
        hint: "Un ejemplo real si lo tienes. Si todavía no hay, cuéntame qué esperas lograr.",
        required: false,
      },
      {
        key: "preguntas",
        kind: "text",
        label: "¿Qué te preguntan una y otra vez?",
        hint: "Por WhatsApp, en mensajes, en persona. Cada pregunta repetida es un contenido.",
        required: false,
      },
    ],
  },
  {
    title: "Tu Instagram hoy",
    intro: "Sin juicio: esto solo sirve para saber qué tipo de contenido te conviene ahora.",
    questions: [
      {
        key: "seguidores",
        kind: "choice",
        label: "¿Cuántos seguidores tienes?",
        options: [
          { id: "menos_1k", label: "Menos de 1,000" },
          { id: "1k_10k", label: "Entre 1,000 y 10,000" },
          { id: "mas_10k", label: "Más de 10,000" },
        ],
      },
      {
        key: "oferta_clara",
        kind: "choice",
        label: "¿Tienes claro qué vendes, a quién y a qué precio?",
        options: [
          { id: "si", label: "Sí, lo tengo claro" },
          { id: "mas_o_menos", label: "Más o menos" },
          { id: "no", label: "Todavía no" },
        ],
      },
      {
        key: "mensajes",
        kind: "choice",
        label: "¿Te escriben por Instagram personas interesadas en comprarte?",
        options: [
          { id: "nunca", label: "Casi nunca" },
          { id: "a_veces", label: "A veces" },
          { id: "seguido", label: "Seguido" },
        ],
      },
      {
        key: "ventas",
        kind: "choice",
        label: "¿Ya vendes gracias a Instagram?",
        options: [
          { id: "no", label: "Todavía no" },
          { id: "algunas", label: "Algunas ventas" },
          { id: "constante", label: "Sí, de forma constante" },
        ],
      },
    ],
  },
];

export const TEST_QUESTIONS: TestQuestion[] = TEST_BLOCKS.flatMap((b) => b.questions);

export type TestAnswers = Record<string, string>;

export const TEST_TEXT_MAX = 1500;

/** Recorta textos, descarta claves desconocidas y opciones inválidas. Nunca lanza. */
export function sanitizeTestAnswers(raw: unknown): TestAnswers {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: TestAnswers = {};
  for (const q of TEST_QUESTIONS) {
    const v = r[q.key];
    if (typeof v !== "string") continue;
    if (q.kind === "text") {
      const t = v.trim().slice(0, TEST_TEXT_MAX);
      if (t) out[q.key] = t;
    } else if (q.options.some((o) => o.id === v)) {
      out[q.key] = v;
    }
  }
  return out;
}

/** Qué falta para poder enviar el test (las de texto obligatorias + las 4 de opción). */
export function missingTestAnswers(answers: TestAnswers): TestQuestion[] {
  return TEST_QUESTIONS.filter((q) => (q.kind === "choice" || q.required) && !answers[q.key]?.trim());
}

/**
 * La etapa de la cuenta según Andrea, con reglas fijas:
 * - **Senior**: ya vende de forma constante.
 * - **Junior**: la oferta está clara y ya hay interesados o algunas ventas.
 * - **Freshman**: menos de 1,000 seguidores y casi nadie escribe.
 * - **Sophomore**: el resto — hay algo de audiencia o de interés, pero la
 *   oferta todavía no está clara (o sí lo está y todavía no llegan mensajes).
 */
export function phaseFromAnswers(a: TestAnswers): AccountPhase {
  if (a.ventas === "constante") return "senior";
  const hayInteres = a.mensajes === "a_veces" || a.mensajes === "seguido" || a.ventas === "algunas";
  if (a.oferta_clara === "si" && hayInteres) return "junior";
  if (a.seguidores === "menos_1k" && a.mensajes === "nunca" && a.ventas !== "algunas") return "freshman";
  return "sophomore";
}

/** Las respuestas como texto para el prompt (y para que Paco las lea). */
export function testAnswersToText(a: TestAnswers): string {
  return TEST_QUESTIONS.map((q) => {
    const v = a[q.key];
    if (!v) return null;
    const value = q.kind === "choice" ? (q.options.find((o) => o.id === v)?.label ?? v) : v;
    return `**${q.label}**\n${value}`;
  })
    .filter(Boolean)
    .join("\n\n");
}

// ─── Lenguaje de cliente (portal) ────────────────────────────────────────────
// En el portal no se dice "Freshman" ni "pilar de Andrea": se dice qué significa.

export const PHASE_PLAIN: Record<AccountPhase, { title: string; body: string }> = {
  freshman: {
    title: "Arrancando: que te conozcan",
    body: "Todavía pocas personas te encuentran. Este mes el contenido busca que te vean y que empiecen las conversaciones: más videos que conectan con lo que le pasa a tu cliente, y la venta de forma suave.",
  },
  sophomore: {
    title: "Construyendo: que quede claro qué ofreces",
    body: "Ya publicas, pero tu oferta todavía no se ve con claridad. Este mes el contenido muestra cómo lo resuelves tú y por qué contigo, y cada semana una invitación directa a trabajar contigo.",
  },
  junior: {
    title: "Generando confianza: de interesados a clientes",
    body: "Ya te escriben, pero falta que confíen para comprar. Este mes pesa más el contenido que enseña de verdad y muestra resultados, y cada semana una invitación directa a trabajar contigo.",
  },
  senior: {
    title: "Creciendo: vender más con un sistema",
    body: "Ya vendes por Instagram. Este mes el contenido refuerza lo que te hace único: casos, testimonios y tu forma de trabajar, para llegar a más gente como tus mejores clientes.",
  },
};

export const ANDREA_PILLAR_PLAIN: Record<AndreaPillar, string> = {
  problema: "Lo que le pasa a tu cliente",
  solucion: "Cómo lo resuelves tú",
  resultado: "Lo que logra contigo",
};
