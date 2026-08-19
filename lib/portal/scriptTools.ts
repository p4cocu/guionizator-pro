/**
 * Portadas y Copy Expert desde el portal (Fase D, etapa 8) — el add-on de IA
 * aplicado a un guion que ya existe.
 *
 * SERVER-ONLY: usa service role. Nunca importar desde un `"use client"`.
 *
 * ## Las dos gastan cupo
 *
 * Las dos llaman a Claude, así que van contra el MISMO tope que generar guiones
 * (`clients.ai_generation_limit`, medido en `ai_usage_log`), igual que "Adaptar
 * a mi marca". Una llamada = una fila. Son más baratas que un guion (Haiku
 * 4.5 contra Sonnet), pero un medidor por tipo de llamada sería otro tope que
 * explicarle al cliente, y sin tope quedaría una canilla abierta.
 *
 * ## Por qué no se reusan `/api/ai/{cover,copy}`
 *
 * Por lo mismo que el resto del portal: esas rutas arman todo con la sesión y
 * **no miden nada**. Además reciben el `content` en el body sin chequear de
 * quién es el guion. Acá el guion se lee con service role filtrando
 * `client_id`, y el consumo se registra.
 *
 * ⚠️ Los prompts están **duplicados** con esas rutas (son handlers, no módulos
 * importables) — misma disciplina que `lib/portal/generate.ts`. Al tocar uno,
 * revisar el otro o el cliente recibe portadas con otro criterio que las de
 * Paco.
 *
 * ## Dónde se guardan
 *
 * En las mismas tablas que el estudio: `script_covers` y `script_copies`, con
 * `owner_id` = dueño de la marca. Las dos quedaron **owner-only** en `0006` (el
 * miembro no tiene ninguna policy ahí), así que leer y escribir va con service
 * role, filtrando la pertenencia a mano.
 */

import fs from "fs";
import path from "path";
import { createServiceClient } from "../supabase/service";
import { MODEL_FAST } from "../ai/anthropic";
import { generateJsonPlain } from "../ai/json";
import { PortalGenerationError } from "./generate";
import {
  isPortalCopyPlatform,
  type PortalCoverIdea,
  type PortalScriptCopy,
} from "./scriptToolsShared";

// Los tipos y la lista de plataformas viven en `./scriptToolsShared` (módulo
// puro) para que el panel cliente los pueda importar sin arrastrar `fs`, el SDK
// de Anthropic y el service role al bundle del browser.
export {
  PORTAL_COPY_PLATFORMS,
  isPortalCopyPlatform,
  type PortalCoverIdea,
  type PortalScriptCopy,
} from "./scriptToolsShared";

// ─── El guion, leído con service role ────────────────────────────────────────

export type ToolScript = {
  id: string;
  type: string | null;
  title: string | null;
  brief: string | null;
  structure_name: string | null;
  content: Record<string, unknown> | null;
};

/** El guion, confirmando que es de esta marca. 404 si no. */
export async function loadClientScript(clientId: string, scriptId: string): Promise<ToolScript> {
  const { data, error } = await createServiceClient()
    .from("scripts")
    .select("id, type, title, brief, structure_name, content")
    .eq("id", scriptId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throw new PortalGenerationError(error.message, 500);
  if (!data) throw new PortalGenerationError("Ese guion no existe o no es de esta marca.", 404);
  return data as ToolScript;
}

// ─── Portadas ────────────────────────────────────────────────────────────────

/**
 * La guía de portadas de alto CTR. Si el archivo no está en el bundle, la
 * generación sigue (con menos contexto) en vez de fallar — igual que en
 * `/api/ai/cover`. Ver `next.config.ts`: el tracing de `knowledge/**` para
 * `/portal/**` es lo que hace que exista en producción.
 */
function readCoverKnowledge(): string {
  try {
    return fs.readFileSync(
      path.join(process.cwd(), "knowledge", "portadas-reels-carruseles-alto-ctr.md"),
      "utf-8",
    );
  } catch {
    return "";
  }
}

const COVER_SYSTEM = `Eres un experto en diseño de portadas de alto CTR para Reels y carruseles de Instagram.
Dominas neurociencia del scroll, copywriting de hooks y especificaciones técnicas de generadores de imagen IA (Flux, Midjourney, GPT-Image, Stable Diffusion).

Recibirás una guía de referencia sobre qué hace que una portada tenga alto CTR (safe zones, contraste, rostro vs. tipografía, regla de las 6 palabras, fórmulas de hook) y el contenido de un guion de Reel o carrusel.

Tu tarea: proponer EXACTAMENTE 3 conceptos de portada distintos entre sí, directamente relacionados con el contenido del guion, siguiendo la estructura de prompt:
[medium], [subject], [action/pose], [environment], [style/vibe], [technical specs]

Regla dura sobre personajes: de las 3 portadas, EXACTAMENTE 1 o 2 (nunca 0, nunca 3) deben incluir una referencia a colocar un personaje/rostro humano en la portada (con emoción extrema y clara, según la guía). El resto debe ser diseño tipográfico/color-block limpio, sin personaje.

Cada concepto debe traer también un "cover_text" (el texto que iría sobreimpreso en la portada, siguiendo la regla de las 6 palabras y alguna fórmula de hook de la guía) y una "rationale_es" breve (1-2 oraciones) explicando por qué esa portada es de alto CTR para este contenido específico.

Siempre devuelves un JSON válido. El prompt_en debe estar en inglés, listo para pegar en cualquier generador de imágenes. cover_text y rationale_es en español latinoamericano.`;

function summarizeContent(type: string | null, content: Record<string, unknown> | null): string {
  if (type !== "carousel") {
    const voiceOff = typeof content?.voice_off === "string" ? content.voice_off : "";
    return voiceOff.slice(0, 2000);
  }
  const slides = Array.isArray(content?.slides) ? content!.slides : [];
  return (slides as unknown[])
    .map((raw) => {
      const s = (raw ?? {}) as { number?: number; text?: string; body?: string };
      return `Slide ${s.number ?? "?"}: ${s.text ?? ""}${s.body ? ` — ${s.body}` : ""}`;
    })
    .join("\n")
    .slice(0, 2000);
}

export async function generateCovers(script: ToolScript): Promise<PortalCoverIdea[]> {
  const userMessage = `GUÍA DE REFERENCIA — QUÉ HACE UNA PORTADA DE ALTO CTR:
${readCoverKnowledge()}

---

GUION A CUBRIR:
Tipo: ${script.type === "carousel" ? "Carrusel (primera diapositiva, formato 4:5)" : "Reel (formato 9:16 vertical)"}
Estructura narrativa: ${script.structure_name ?? "—"}
Brief: ${script.brief ?? "—"}

Contenido del guion:
${summarizeContent(script.type, script.content)}

---

Genera EXACTAMENTE 3 conceptos de portada para este contenido, relacionados directamente con él, siguiendo la estructura [medium], [subject], [action/pose], [environment], [style/vibe], [technical specs]. Recuerda: 1 o 2 (no 0, no 3) deben tener personaje/rostro humano.

Devuelve ÚNICAMENTE este JSON (sin markdown, sin explicaciones), un array de 3 objetos:
[
  {
    "has_character": true o false,
    "medium": "...",
    "subject": "...",
    "action": "...",
    "environment": "...",
    "style_vibe": "...",
    "technical_specs": "...",
    "prompt_en": "el prompt completo en inglés ensamblando los 6 campos anteriores, listo para pegar en un generador de imágenes",
    "cover_text": "texto corto sugerido para sobreimprimir en la portada (5-6 palabras, en español)",
    "rationale_es": "por qué esta portada es de alto CTR para este contenido específico"
  }
]`;

  const covers = await generateJsonPlain<PortalCoverIdea[]>({
    label: "portal:cover",
    // Haiku 4.5 como en `/api/ai/cover`: Sonnet tardaba ~30s con la guía entera
    // y se comía el límite de las funciones síncronas de Netlify.
    model: MODEL_FAST,
    maxTokens: 1600,
    system: COVER_SYSTEM,
    userMessage,
  });

  if (!Array.isArray(covers) || covers.length === 0) {
    throw new PortalGenerationError("La IA no devolvió portadas. Intenta de nuevo.", 502);
  }
  return covers.slice(0, 3);
}

/** Portadas guardadas de un guion. `null` si nunca se generaron. */
export async function loadCovers(scriptId: string): Promise<PortalCoverIdea[] | null> {
  const { data } = await createServiceClient()
    .from("script_covers")
    .select("covers")
    .eq("script_id", scriptId)
    .maybeSingle();

  const covers = data?.covers as PortalCoverIdea[] | undefined;
  return covers?.length ? covers : null;
}

/** Guarda con `owner_id` del DUEÑO, no del miembro: si no, Paco no las ve. */
export async function saveCovers(
  scriptId: string,
  ownerId: string,
  covers: PortalCoverIdea[],
): Promise<void> {
  const { error } = await createServiceClient()
    .from("script_covers")
    .upsert(
      { owner_id: ownerId, script_id: scriptId, covers, updated_at: new Date().toISOString() },
      { onConflict: "script_id,owner_id" },
    );
  if (error) throw new PortalGenerationError(error.message, 500);
}

// ─── Copy ────────────────────────────────────────────────────────────────────

const COPY_SYSTEM = `Eres un experto en copywriting para redes sociales en español latinoamericano.
Tu tarea es transformar guiones de video/carrusel en copies optimizados para publicaciones en redes sociales.
Escribes en español latinoamericano, tuteo, sin tecnicismos innecesarios.
Siempre devuelves un JSON válido con la estructura indicada.`;

function buildCopyPrompt(
  platform: string,
  content: Record<string, unknown> | null,
  type: string | null,
): string {
  const contentStr = JSON.stringify(content ?? {}, null, 2);

  if (platform === "linkedin") {
    return `Crea el copy para LinkedIn de este ${type === "carousel" ? "carrusel" : "video"}.

GUION:
${contentStr}

El copy de LinkedIn debe:
- Gancho en la primera línea (frase directa, no clickbait)
- Storytelling profesional de 200-380 palabras
- Estructura con párrafos cortos (1-3 oraciones máximo por párrafo)
- Sin emojis excesivos (máximo 2-3 si aportan)
- CTA orientado a conversación o conexión profesional
- De 3 a 5 hashtags al final

Devuelve ÚNICAMENTE este JSON (sin markdown, sin explicaciones):
{"copy": "texto completo del copy con saltos de línea", "hashtags": "#hashtag1 #hashtag2 #hashtag3"}`;
  }

  return `Crea el copy para Instagram de este ${type === "carousel" ? "Carrusel" : "Reel"}.

GUION:
${contentStr}

El copy de Instagram debe:
- Tener un gancho en la primera línea (máximo 2 oraciones antes del "más")
- Cuerpo de 120-280 palabras que desarrolla el tema con valor real
- CTA claro al final
- Emojis estratégicos (no exagerados, 3-6 por copy)
- De 15 a 20 hashtags relevantes (mezcla nicho específico + amplio + marca)
- Tono conversacional y auténtico

Devuelve ÚNICAMENTE este JSON (sin markdown, sin explicaciones):
{"copy": "texto completo del copy con emojis y saltos de línea", "hashtags": "#hashtag1 #hashtag2 ... (todos los hashtags en una línea)"}`;
}

export async function generateCopy(
  script: ToolScript,
  platform: string,
): Promise<PortalScriptCopy> {
  if (!isPortalCopyPlatform(platform)) {
    throw new PortalGenerationError("Esa plataforma no está disponible.", 400);
  }

  const result = await generateJsonPlain<{ copy?: string; hashtags?: string }>({
    label: "portal:copy",
    model: MODEL_FAST,
    maxTokens: 1024,
    system: COPY_SYSTEM,
    userMessage: buildCopyPrompt(platform, script.content, script.type),
  });

  const copy = (result.copy ?? "").trim();
  if (!copy) throw new PortalGenerationError("La IA no devolvió el copy. Intenta de nuevo.", 502);

  return { platform, copy, hashtags: (result.hashtags ?? "").trim() };
}

/** Copies guardados de un guion, uno por plataforma. */
export async function loadCopies(scriptId: string): Promise<PortalScriptCopy[]> {
  const { data } = await createServiceClient()
    .from("script_copies")
    .select("platform, copy_text, hashtags")
    .eq("script_id", scriptId)
    .order("created_at", { ascending: false });

  const seen = new Set<string>();
  const out: PortalScriptCopy[] = [];
  for (const row of data ?? []) {
    const platform = row.platform as string;
    if (seen.has(platform)) continue;
    seen.add(platform);
    out.push({
      platform,
      copy: (row.copy_text as string) ?? "",
      hashtags: (row.hashtags as string | null) ?? "",
    });
  }
  return out;
}

/** Reemplaza el copy de esa plataforma, como hace `saveScriptCopy` del estudio. */
export async function saveCopy(
  scriptId: string,
  ownerId: string,
  copy: PortalScriptCopy,
): Promise<void> {
  const admin = createServiceClient();

  await admin
    .from("script_copies")
    .delete()
    .eq("script_id", scriptId)
    .eq("platform", copy.platform)
    .eq("owner_id", ownerId);

  const { error } = await admin.from("script_copies").insert({
    owner_id: ownerId,
    script_id: scriptId,
    platform: copy.platform,
    copy_text: copy.copy,
    hashtags: copy.hashtags || null,
  });

  if (error) throw new PortalGenerationError(error.message, 500);
}
