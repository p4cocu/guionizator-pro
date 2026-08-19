/**
 * Edición de texto de un guion desde el portal (Fase D, etapa 8).
 *
 * Módulo **puro** (sin Supabase, sin JSX): lo importan el editor cliente y las
 * server actions que guardan.
 *
 * ## Qué se puede editar y qué no
 *
 * Solo el TEXTO: la voz en off de un reel, y el titular y el cuerpo de cada
 * slide de un carrusel. Los bloques de producción, las duraciones, los tags,
 * la música, el `visual` y el micro-anchor **no** se tocan desde el portal —
 * son decisiones de rodaje y diseño, no del mensaje.
 *
 * ## La regla que sostiene este archivo
 *
 * `applyTextDraft` **mergea sobre el `content` original**; nunca lo reescribe.
 * El `content` es jsonb sin esquema y trae cosas que el portal ni dibuja
 * (`blocks`, `music_a`, `music_b`, `source`, `visual`, `micro_anchor`). Si el
 * editor devolviera un objeto nuevo con los tres campos que sí muestra, editar
 * una coma desde el portal borraría el guion de producción entero. Por eso los
 * slides se recorren por índice sobre el array original y se les cambian dos
 * claves, en vez de construirlos de cero.
 */

import { toScriptView } from "./scriptView";

export type ScriptTextDraft =
  | { kind: "reel"; voiceOff: string }
  | {
      kind: "carousel";
      /** Un item por slide del `content`, en el mismo orden (el índice manda). */
      slides: {
        number: number;
        text: string;
        /** `null` = ese slide no tiene cuerpo; el editor no dibuja el campo. */
        body: string | null;
      }[];
    }
  | { kind: "empty" };

/**
 * Pasa el `content` guardado al borrador editable.
 *
 * Un reel sin contenido igual devuelve un borrador vacío editable: es válido
 * que el cliente escriba la voz en off desde cero. Un carrusel sin slides no,
 * porque no hay nada que numerar — ahí el editor no se ofrece.
 */
export function toTextDraft(
  content: Record<string, unknown> | null | undefined,
  type: string | null,
): ScriptTextDraft {
  const view = toScriptView(content, type);

  if (view.kind === "carousel") {
    return {
      kind: "carousel",
      slides: view.slides.map((s) => ({ number: s.number, text: s.text, body: s.body })),
    };
  }

  if (view.kind === "reel") return { kind: "reel", voiceOff: view.voiceOff };

  return type === "carousel" ? { kind: "empty" } : { kind: "reel", voiceOff: "" };
}

/** ¿Hay algo que editar? Si no, la pantalla no ofrece el botón. */
export function isEditableDraft(draft: ScriptTextDraft): boolean {
  return draft.kind === "reel" || (draft.kind === "carousel" && draft.slides.length > 0);
}

/** ¿Cambió algo respecto del original? Evita guardar (y versionar) de gusto. */
export function draftChanged(a: ScriptTextDraft, b: ScriptTextDraft): boolean {
  if (a.kind !== b.kind) return true;
  if (a.kind === "reel" && b.kind === "reel") return a.voiceOff !== b.voiceOff;
  if (a.kind === "carousel" && b.kind === "carousel") {
    if (a.slides.length !== b.slides.length) return true;
    return a.slides.some((s, i) => s.text !== b.slides[i].text || s.body !== b.slides[i].body);
  }
  return false;
}

/**
 * Devuelve el `content` con el texto del borrador aplicado encima.
 *
 * No muta el original (el editor cliente lo tiene en un `useState`) y respeta
 * cualquier clave que no conozca.
 */
export function applyTextDraft(
  content: Record<string, unknown> | null | undefined,
  draft: ScriptTextDraft,
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(content ?? {}) };

  if (draft.kind === "reel") {
    return { ...base, voice_off: draft.voiceOff };
  }

  if (draft.kind === "carousel") {
    const original = Array.isArray(base.slides) ? base.slides : [];
    const slides = original.map((raw, i) => {
      const slide = { ...((raw ?? {}) as Record<string, unknown>) };
      const edited = draft.slides[i];
      if (!edited) return slide;
      slide.text = edited.text;
      // `body` solo se pisa si el slide ya lo tenía: si era `null`, sigue
      // `null` y no le inventamos un campo al guion.
      if (edited.body !== null) slide.body = edited.body;
      return slide;
    });
    return { ...base, slides };
  }

  return base;
}

/** Límite de cordura para el textarea y para la validación del servidor. */
export const MAX_TEXT_LENGTH = 6000;

export class ScriptTextError extends Error {}

/**
 * Valida un borrador antes de guardarlo. Corre también en el servidor: una
 * server action es un endpoint público y el largo del textarea no la protege.
 */
export function assertValidDraft(draft: ScriptTextDraft): void {
  if (draft.kind === "reel") {
    if (draft.voiceOff.length > MAX_TEXT_LENGTH) {
      throw new ScriptTextError("El texto es demasiado largo.");
    }
    return;
  }
  if (draft.kind === "carousel") {
    for (const slide of draft.slides) {
      if (slide.text.length > MAX_TEXT_LENGTH || (slide.body ?? "").length > MAX_TEXT_LENGTH) {
        throw new ScriptTextError("El texto de un slide es demasiado largo.");
      }
    }
    return;
  }
  throw new ScriptTextError("Este guion no tiene texto editable.");
}
