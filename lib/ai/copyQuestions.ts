/**
 * Las 1-2 preguntas que la IA hace ANTES de escribir el copy de una publicación
 * externa ("Ya grabé el video", migración `0014`).
 *
 * Por qué existe: el contexto que Paco escribe de apuro describe el video, pero
 * casi nunca trae lo que hace que un copy suene profesional en vez de genérico
 * — el dato concreto, a quién le habla, qué quiere que pase después. Pedirlo en
 * el prompt del copy no sirve: el modelo se lo inventa. Preguntarlo es la única
 * forma de que el dato sea real.
 *
 * **Las respuestas son opcionales.** Si Paco no contesta ninguna, el flujo es
 * exactamente el de antes: las respuestas se anexan al contexto y ese contexto
 * es el que ya alimentaba a `/api/ai/copy` y a `/api/ai/cover`. Por eso esto no
 * toca ningún prompt existente ni agrega una columna: lo único que cambia es
 * que el texto que entra es mejor.
 *
 * Módulo puro (sin Supabase, sin `"use server"`) para poder importarlo desde el
 * formulario y desde el server action.
 */

import { copyPlatformLabel } from "./copyPrompt";

/** Tope duro. Paco pidió "1 o 2 máximo" y el prompt lo repite, pero el corte real es este. */
export const MAX_COPY_QUESTIONS = 2;

export type CopyQuestion = {
  /** Estable dentro de la tanda: la UI lo usa de key y de índice de respuesta. */
  id: string;
  /** La pregunta, en una línea. */
  question: string;
  /** Ejemplo de respuesta: va de placeholder del input. */
  placeholder: string;
};

export const COPY_QUESTIONS_SYSTEM = `Eres un director creativo que entrevista a un creador de contenido antes de escribirle el copy de su publicación.
Haces las MENOS preguntas posibles: solo aquello que no se puede deducir de lo que ya te contó y que cambiaría de verdad el copy.
Escribes en español latinoamericano, tuteo, directo y sin preámbulos.
Siempre devuelves un JSON válido con la estructura indicada, sin markdown y sin explicaciones.`;

export type CopyQuestionsInput = {
  platform: string;
  scriptType: string;
  context: string;
  title: string | null;
  brandContext: string | null;
};

export function buildCopyQuestionsPrompt(input: CopyQuestionsInput): string {
  const { platform, scriptType, context, title, brandContext } = input;
  const piece = scriptType === "carousel" ? "carrusel" : "reel";

  return `El creador ya grabó un ${piece} y ahora necesita el copy para ${copyPlatformLabel(platform)}.

${brandContext ? `${brandContext}\n\n` : ""}## Lo que te contó del ${piece}
${title ? `**Título interno:** ${title}\n` : ""}${context}

## Tu tarea
Devuelve **2 preguntas** cuya respuesta haría que el copy sea notoriamente mejor. Manda 1 sola si de verdad no existe una segunda que aporte. Nunca más de 2.

Reglas:
- **Nunca preguntes algo que ya está contestado arriba.** Si el contexto ya dice a quién le habla o cuál es el cierre, busca otra cosa.
- Apunta a lo que un copy genérico no tiene: el dato duro o la cifra, el detalle específico que solo él conoce, la objeción real de quien lo va a leer, o qué quiere exactamente que haga la persona después de verlo.
- Nada de preguntas de trámite ("¿qué hashtags quieres?", "¿qué tono prefieres?", "¿cuánto dura?").
- Una pregunta = una sola cosa. **Prohibido encadenar con "y" o con "o"** ("¿cuánto duró o cuánto costó?" son dos preguntas: elige una). Tampoco ofrezcas opciones dentro de la pregunta.
- Las dos preguntas tienen que ser sobre cosas distintas, no dos formas de pedir lo mismo.
- Máximo 15 palabras por pregunta. Que se pueda contestar en una línea.
- **Tutea** (tú, quieres, escuchas). Nada de voseo (vos, querés, escuchás).
- El \`placeholder\` es un ejemplo BREVE de respuesta, escrito como lo diría él, no una instrucción.

Devuelve ÚNICAMENTE este JSON (sin markdown, sin explicaciones):
{"questions": [{"question": "la pregunta", "placeholder": "ejemplo corto de respuesta"}]}`;
}

/**
 * Normaliza lo que devolvió el modelo: recorta a `MAX_COPY_QUESTIONS`, tira las
 * vacías y pone los `id`. Nunca lanza — si la tanda viene inservible devuelve
 * `[]` y la UI simplemente no muestra el panel, que es el comportamiento de
 * antes de esta mejora.
 */
export function normalizeCopyQuestions(raw: unknown): CopyQuestion[] {
  const list = (raw as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return [];

  return list
    .map((item) => {
      const q = item as { question?: unknown; placeholder?: unknown };
      return {
        question: typeof q.question === "string" ? q.question.trim() : "",
        placeholder: typeof q.placeholder === "string" ? q.placeholder.trim() : "",
      };
    })
    .filter((q) => q.question.length > 0)
    .slice(0, MAX_COPY_QUESTIONS)
    .map((q, i) => ({ id: `q${i + 1}`, ...q }));
}

/**
 * Pega las respuestas al final del contexto. Ese texto es el que se guarda en
 * `scripts.brief` y en `content.voice_off`, o sea lo que leen el prompt del copy
 * y el de portadas: no hay una segunda vía por la que esto viaje.
 *
 * Las preguntas sin responder no dejan rastro — no se escribe "sin respuesta",
 * que el modelo leería como un dato.
 */
export function appendAnswersToContext(
  context: string,
  questions: CopyQuestion[],
  answers: Record<string, string>,
): string {
  const answered = questions
    .map((q) => ({ q: q.question, a: (answers[q.id] ?? "").trim() }))
    .filter((x) => x.a.length > 0);

  if (answered.length === 0) return context.trim();

  return [
    context.trim(),
    "",
    "Detalles adicionales:",
    ...answered.map((x) => `- ${x.q} ${x.a}`),
  ].join("\n");
}
