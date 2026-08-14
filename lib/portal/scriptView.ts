/**
 * Normaliza el `content` (jsonb) de un guion a algo dibujable (Fase D, etapa 5).
 *
 * El `content` no tiene esquema en la base: lo escribe la IA y después lo edita
 * el editor manual, así que puede venir incompleto o con campos de más. Este
 * módulo lo aterriza a una forma fija y **nunca lanza** — un guion viejo con
 * otra estructura tiene que mostrarse degradado, no romper la pantalla del
 * cliente.
 *
 * Módulo puro (sin Supabase, sin JSX): lo usan tanto el portal como cualquier
 * vista de solo lectura que venga después.
 *
 * Los reels guardan `voice_off` (el teleprompter) y opcionalmente `blocks`
 * (bloques con duración y líneas etiquetadas). Los carruseles guardan `slides`.
 * Es la misma convención que lee `scriptToText` en `lib/reports/snapshot.ts`,
 * pero acá se conserva la estructura en vez de aplanarla a texto.
 */

export type ReelBlock = {
  name: string;
  duration: string | null;
  lines: { tag: string | null; text: string }[];
};

export type CarouselSlide = {
  number: number;
  text: string;
  body: string | null;
  visual: string | null;
  microAnchor: string | null;
};

export type ScriptView =
  | { kind: "reel"; voiceOff: string; blocks: ReelBlock[] }
  | { kind: "carousel"; slides: CarouselSlide[] }
  | { kind: "empty" };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s ? s : null;
}

export function toScriptView(
  content: Record<string, unknown> | null | undefined,
  type: string | null,
): ScriptView {
  if (!content || typeof content !== "object") return { kind: "empty" };

  const slidesRaw = Array.isArray(content.slides) ? content.slides : null;
  const voiceOff = str(content.voice_off);
  const blocksRaw = Array.isArray(content.blocks) ? content.blocks : null;

  // El `type` de la fila manda, pero si el contenido no coincide se cae a lo que
  // realmente haya: hay guiones viejos con el type mal puesto.
  const looksCarousel = type === "carousel" ? Boolean(slidesRaw?.length) : false;

  if (looksCarousel || (!voiceOff && !blocksRaw?.length && slidesRaw?.length)) {
    const slides = (slidesRaw ?? []).map((raw, i) => {
      const s = (raw ?? {}) as Record<string, unknown>;
      return {
        number: typeof s.number === "number" ? s.number : i + 1,
        text: str(s.text),
        body: strOrNull(s.body),
        visual: strOrNull(s.visual),
        microAnchor: strOrNull(s.micro_anchor),
      };
    });
    return slides.length ? { kind: "carousel", slides } : { kind: "empty" };
  }

  const blocks: ReelBlock[] = (blocksRaw ?? []).map((raw) => {
    const b = (raw ?? {}) as Record<string, unknown>;
    const linesRaw = Array.isArray(b.lines) ? b.lines : [];
    return {
      name: str(b.name),
      duration: strOrNull(b.duration),
      lines: linesRaw
        .map((l) => {
          const line = (l ?? {}) as Record<string, unknown>;
          return { tag: strOrNull(line.tag), text: str(line.text) };
        })
        .filter((l) => l.text),
    };
  });

  if (!voiceOff && blocks.every((b) => b.lines.length === 0)) return { kind: "empty" };
  return { kind: "reel", voiceOff, blocks };
}

/**
 * Trozos de texto con el markdown ligero del editor ya resuelto
 * (`**negrita**`, `==resaltado==`, `_subrayado_`).
 *
 * Se devuelve como datos y no como HTML a propósito: el que dibuja arma los
 * `<strong>`/`<mark>` con JSX y así no hace falta `dangerouslySetInnerHTML`
 * sobre texto que, aunque hoy lo escribe Paco, mañana podría escribir un
 * colaborador del cliente.
 */
export type TextChunk = { text: string; bold?: boolean; mark?: boolean; underline?: boolean };

const MARKUP = /(\*\*[^*]+\*\*|==[^=]+==|_[^_]+_)/g;

export function parseMarkup(input: string): TextChunk[] {
  if (!input) return [];
  const out: TextChunk[] = [];

  for (const part of input.split(MARKUP)) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      out.push({ text: part.slice(2, -2), bold: true });
    } else if (part.startsWith("==") && part.endsWith("==") && part.length > 4) {
      out.push({ text: part.slice(2, -2), mark: true });
    } else if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
      out.push({ text: part.slice(1, -1), underline: true });
    } else {
      out.push({ text: part });
    }
  }

  return out;
}
