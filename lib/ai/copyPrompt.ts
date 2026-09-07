/**
 * El prompt del copy de una publicación — **una sola definición** para el
 * estudio y para el portal.
 *
 * Antes vivía duplicado en `app/api/ai/copy/route.ts` y en
 * `lib/portal/scriptTools.ts` (las rutas son handlers, no módulos importables,
 * así que la duplicación era el precio de que el portal midiera el cupo). Con
 * el copy en dos versiones ese precio subía: dos formatos de salida que se
 * desincronizan a la primera corrección. Como el prompt es texto puro, se
 * extrae acá y los dos lo importan; lo que sigue separado es la ejecución (el
 * portal cobra cupo y lee con service role, el estudio no).
 *
 * Módulo **puro**: sin `fs`, sin Supabase, sin el SDK de Anthropic. Lo puede
 * importar tanto un route handler como un componente de servidor.
 *
 * ## Dos versiones, siempre
 *
 * `copy_short` (directo, para quien no abre el "más") y `copy_long`
 * (desarrollado). Se piden en la MISMA llamada a propósito: dos llamadas
 * costarían el doble de cupo en el portal y darían dos textos que no se hablan
 * entre sí. Ver migración `0014` (`script_copies.copy_short`).
 */

// ─── Plataformas ─────────────────────────────────────────────────────────────

/**
 * Las que tienen prompt propio y afinado. TikTok y YouTube aparecen en el
 * selector como "Pronto": YouTube no es solo otro tono, pide título +
 * descripción, que es otra forma de salida.
 */
export type CopyPlatformId = "instagram" | "linkedin";

export type CopyPlatformOption = {
  id: string;
  label: string;
  /** `true` = se dibuja en el selector pero todavía no genera. */
  soon?: boolean;
};

export const COPY_PLATFORMS: CopyPlatformOption[] = [
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "tiktok", label: "TikTok", soon: true },
  { id: "youtube", label: "YouTube", soon: true },
];

export function isCopyPlatform(value: string): value is CopyPlatformId {
  return value === "instagram" || value === "linkedin";
}

export function copyPlatformLabel(id: string): string {
  return COPY_PLATFORMS.find((p) => p.id === id)?.label ?? id;
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

/**
 * El post de competencia que inspiró el video, cuando lo hay.
 *
 * ⚠️ Entra al prompt SOLO como referencia de ángulo y ritmo. La regla dura de
 * abajo ("prohibido reutilizar datos") es lo que evita que el copy termine
 * hablando del proyecto ajeno: el video es de la marca, la referencia solo
 * explica por qué ese formato funcionó.
 */
export type CopyReference = {
  username: string | null;
  caption: string | null;
  transcript: string | null;
};

export type CopyPromptInput = {
  platform: CopyPlatformId;
  /** `reel` o `carousel` — cambia cómo se nombra la pieza, no el formato de salida. */
  scriptType: string;
  /** Resumen del contenido: voz en off del reel o los slides del carrusel. */
  contentSummary: string;
  /** El brief original, o el contexto que escribió Paco si el video es externo. */
  brief?: string | null;
  title?: string | null;
  /** Perfil de la marca (`buildClientContext`). Sin esto el copy sale genérico. */
  brandContext?: string | null;
  reference?: CopyReference | null;
  /** `true` = el video ya está grabado y se registró como publicación externa. */
  isExternal?: boolean;
};

export type CopyResult = {
  copy_short: string;
  copy_long: string;
  hashtags: string;
};

// ─── Prompt ──────────────────────────────────────────────────────────────────

export const COPY_SYSTEM = `Eres un experto en copywriting para redes sociales en español latinoamericano.
Tu tarea es escribir el copy de la publicación que acompaña a un video o carrusel ya definido.
Escribes en español latinoamericano, tuteo, sin tecnicismos innecesarios y sin sonar a anuncio.
Siempre devuelves un JSON válido con la estructura indicada, sin markdown y sin explicaciones.`;

const PLATFORM_RULES: Record<CopyPlatformId, string> = {
  instagram: `PLATAFORMA: Instagram.

Versión CORTA (copy_short):
- Máximo 3 líneas (unas 40 palabras). Tiene que funcionar completa antes del "…más".
- Una sola idea + un CTA directo. 1 o 2 emojis, no más.
- Nada de introducciones ("En este video te cuento…"): arranca en el gancho.

Versión LARGA (copy_long):
- Primera línea = gancho (máximo 2 oraciones antes del "…más").
- Cuerpo de 120-280 palabras que desarrolla el tema con valor real, en párrafos cortos.
- CTA claro al final.
- Emojis estratégicos, 3-6 en todo el copy.
- Tono conversacional y auténtico.

Hashtags: de 15 a 20, mezclando nicho específico + amplio + marca, todos en una sola línea.`,

  linkedin: `PLATAFORMA: LinkedIn.

Versión CORTA (copy_short):
- Máximo 3 líneas (unas 50 palabras), sin emojis o con 1 como mucho.
- Una afirmación concreta + invitación a la conversación. Nada de clickbait.

Versión LARGA (copy_long):
- Gancho en la primera línea, frase directa y profesional.
- Storytelling de 200-380 palabras, párrafos de 1 a 3 oraciones.
- Máximo 2-3 emojis, solo si aportan.
- CTA orientado a conversación o conexión profesional.

Hashtags: de 3 a 5, en una sola línea.`,
};

const JSON_FORMAT = `Devuelve ÚNICAMENTE este JSON (sin markdown, sin explicaciones):
{"copy_short": "la versión corta, con saltos de línea si hace falta", "copy_long": "la versión desarrollada, con saltos de línea", "hashtags": "#hashtag1 #hashtag2 ... (todos en una línea)"}`;

function pieceName(scriptType: string, platform: CopyPlatformId): string {
  if (scriptType === "carousel") return "carrusel";
  return platform === "linkedin" ? "video" : "Reel";
}

/**
 * La referencia de competencia, si la hay.
 *
 * La instrucción negativa es la parte importante y va junto al dato, no en el
 * system prompt: pegada al texto ajeno es donde el modelo la respeta.
 */
function referenceBlock(ref: CopyReference | null | undefined): string {
  if (!ref) return "";
  const caption = (ref.caption ?? "").trim().slice(0, 1200);
  const transcript = (ref.transcript ?? "").trim().slice(0, 2000);
  if (!caption && !transcript) return "";

  return `

---

REFERENCIA DE ESTILO — publicación ajena que inspiró este video${
    ref.username ? ` (@${ref.username})` : ""
  }:
${caption ? `Copy de la referencia:\n${caption}\n` : ""}${
    transcript ? `Transcripción de la referencia:\n${transcript}\n` : ""
  }
⚠️ REGLA DURA sobre la referencia: úsala SOLO para entender el ángulo, el ritmo y el tipo de gancho que funcionó. Está PROHIBIDO reutilizar sus datos, cifras, nombres propios, ofertas, productos, anécdotas o afirmaciones. El copy habla del proyecto de la marca de arriba y de nada más. Si la referencia y la marca no coinciden en tema, ignora el tema de la referencia y quédate solo con la forma.`;
}

export function buildCopyPrompt(input: CopyPromptInput): string {
  const {
    platform,
    scriptType,
    contentSummary,
    brief,
    title,
    brandContext,
    reference,
    isExternal,
  } = input;

  const brandBlock = brandContext?.trim()
    ? `MARCA QUE PUBLICA (el copy tiene que sonar a esta marca y hablar de SU proyecto):
${brandContext.trim()}

---

`
    : "";

  const contentLabel = isExternal
    ? `CONTENIDO DEL VIDEO YA GRABADO (lo describió quien lo grabó):`
    : `CONTENIDO DE LA PIEZA:`;

  return `${brandBlock}Escribe el copy de la publicación de este ${pieceName(scriptType, platform)}.

${title?.trim() ? `Título interno: ${title.trim()}\n` : ""}${
    brief?.trim() ? `Contexto / brief:\n${brief.trim()}\n\n` : ""
  }${contentLabel}
${contentSummary.trim() || "(sin detalle: apóyate en el contexto de arriba)"}${referenceBlock(reference)}

---

${PLATFORM_RULES[platform]}

Escribe DOS versiones del mismo copy, no dos copys distintos: la corta es la misma idea comprimida, no otro tema.

${JSON_FORMAT}`;
}

// ─── Resumen del contenido ───────────────────────────────────────────────────

/**
 * El contenido del guion, achicado para el prompt. Lo comparten la ruta del
 * estudio y el portal para que los dos manden exactamente lo mismo.
 */
export function summarizeScriptContent(
  scriptType: string,
  content: Record<string, unknown> | null,
): string {
  if (!content) return "";

  if (scriptType === "carousel") {
    const slides = Array.isArray(content.slides) ? content.slides : [];
    return slides
      .map((s: unknown) => {
        const slide = s as { number?: number; text?: string; body?: string };
        return `Slide ${slide.number ?? "?"}: ${slide.text ?? ""}${
          slide.body ? ` — ${slide.body}` : ""
        }`;
      })
      .join("\n")
      .slice(0, 3000);
  }

  const voiceOff = typeof content.voice_off === "string" ? content.voice_off : "";
  return voiceOff.slice(0, 3000);
}

/**
 * Normaliza lo que devolvió el modelo.
 *
 * Acepta `copy` a secas (el formato viejo, de cuando había una sola versión) y
 * lo trata como la versión larga: así un reintento que caiga en el formato
 * anterior no se pierde. Si no hay ninguna de las dos, lanza — el que llama
 * decide qué mensaje mostrar.
 */
export function normalizeCopyResult(raw: {
  copy_short?: string;
  copy_long?: string;
  copy?: string;
  hashtags?: string;
}): CopyResult {
  const long = (raw.copy_long ?? raw.copy ?? "").trim();
  const short = (raw.copy_short ?? "").trim();
  if (!long && !short) throw new Error("La IA no devolvió el copy.");
  return {
    copy_long: long || short,
    copy_short: short || long,
    hashtags: (raw.hashtags ?? "").trim(),
  };
}
