/**
 * Generación de guiones desde el portal — add-on de pago (Fase D, etapa 6).
 *
 * SERVER-ONLY: usa service role. Nunca importar desde un `"use client"`.
 *
 * ## Por qué no se reusan las rutas de `/api/ai/*`
 *
 * Todas arman el contexto con `.from("clients").eq("owner_id", user.id)`, y un
 * miembro del portal **no tiene policy de select sobre `clients`** (esa tabla
 * trae las notas internas). Con su sesión ese `select` vuelve vacío. Lo mismo
 * con `brain_versions`, que quedó owner-only en `0006`. Así que el perfil y el
 * cerebro se leen acá con **service role**, filtrando la pertenencia a mano.
 *
 * ## Qué NO ve el cliente
 *
 * `clients.notas` queda fuera del contexto a propósito: son apuntes internos de
 * Paco sobre la marca, y todo lo que entra al prompt puede salir parafraseado
 * en el guion. El resto del perfil (qué vende, dolor, deseo, tono) sí va: es
 * información que el cliente dio.
 *
 * ## Por qué el guardado también va con service role
 *
 * Un miembro no tiene `insert` sobre `scripts` (`0006` solo le dio select y el
 * update de `collaborator`). Darle una policy de insert sería regalarle el
 * medidor: con su JWT y la anon key puede llamar a PostgREST directo y crear
 * guiones sin pasar por el tope de un add-on de PAGO. Por eso el insert vive
 * acá, con `owner_id` resuelto desde `clients` y `client_id` fijado por el
 * servidor.
 *
 * ## El tope
 *
 * `assertCanGenerate` corre **antes** de llamar a la IA: pasarse no gasta
 * tokens. `logAiGeneration` (en `lib/portal/usage.ts`) corre **después** de que
 * la IA respondió: un error de la API no le come el cupo al cliente.
 */

import type { User } from "@supabase/supabase-js";
import { createServiceClient } from "../supabase/service";
import { MODEL_DEFAULT, MODEL_FAST } from "../ai/anthropic";
import { AiJsonError, generateJson } from "../ai/json";
import { loadClientKnowledge } from "../ai/clientKnowledge";
import { getPortalClient, requirePortalSession, type PortalClient } from "./access";
import { AI_FEATURE_SLUG, hasFeature } from "./features";
import { getAiUsageState, type AiUsageState } from "./usage";

export type ScriptType = "reel" | "carousel";

/** Error con status HTTP: las rutas lo traducen tal cual. */
export class PortalGenerationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PortalGenerationError";
    this.status = status;
  }
}

// ─── Contexto: perfil de la marca + cerebro activo del dueño ─────────────────

export type GenerationContext = {
  ownerId: string;
  /** Para `loadClientKnowledge()` — la carpeta `knowledge/clients/<nombre>/`. */
  clientName: string;
  /** Perfil de la marca en markdown, listo para el system prompt. Sin `notas`. */
  clientContext: string;
  /** Cerebro activo del dueño. `undefined` = cae al `brain/system-prompt.md`. */
  brainContent?: string;
  brainVersionId: string | null;
};

type ClientRow = Record<string, string | null> & { owner_id: string };

/**
 * Perfil de la marca tal como lo arma `/api/ai/script`, **menos `notas`**.
 * Cualquier campo que se agregue acá termina influyendo en lo que la IA le
 * escribe al cliente: agregar con criterio.
 */
function buildClientContext(c: ClientRow): string {
  return [
    `## Perfil del cliente: ${c.nombre}`,
    c.marca && `**Marca:** ${c.marca}`,
    c.que_vende && `**Qué vende:** ${c.que_vende}`,
    c.cliente_ideal && `**Cliente ideal:** ${c.cliente_ideal}`,
    c.nicho && `**Nicho:** ${c.nicho}`,
    c.dolor && `**Dolor principal:** ${c.dolor}`,
    c.deseo && `**Deseo principal:** ${c.deseo}`,
    c.tono && `**Tono de voz:** ${c.tono}`,
    // `notas` NO va: son apuntes internos sobre la marca, no material de guion.
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Todo lo que hace falta para generar, en dos consultas con service role.
 *
 * El acceso a la marca ya lo validó `requirePortalClient` en la ruta; acá se
 * resuelve el `owner_id` para el insert, el log y la lectura del cerebro.
 */
export async function loadGenerationContext(clientId: string): Promise<GenerationContext> {
  const admin = createServiceClient();

  const { data: client, error } = await admin
    .from("clients")
    .select("owner_id, nombre, marca, que_vende, cliente_ideal, nicho, dolor, deseo, tono")
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw new PortalGenerationError(error.message, 500);
  if (!client) throw new PortalGenerationError("Esa marca no existe.", 404);

  const row = client as ClientRow;

  const { data: brain } = await admin
    .from("brain_versions")
    .select("id, content")
    .eq("owner_id", row.owner_id)
    .eq("is_active", true)
    .maybeSingle();

  return {
    ownerId: row.owner_id,
    clientName: row.nombre ?? "",
    clientContext: buildClientContext(row),
    brainContent: (brain?.content as string | undefined) ?? undefined,
    brainVersionId: (brain?.id as string | undefined) ?? null,
  };
}

// ─── Puerta de entrada de las rutas ──────────────────────────────────────────

/**
 * El mismo doble candado de las páginas del portal, en versión ruta: sesión →
 * acceso a la marca → flag `generar_ia` prendido. Devuelve además el contexto,
 * que es lo que las tres rutas necesitan sin excepción.
 *
 * Se usa `PortalGenerationError` en vez de `notFound()`: quien llama es un
 * `fetch`, y una respuesta JSON con status se lee mucho mejor del otro lado que
 * el HTML de la página 404.
 *
 * ⚠️ Una server action y una route handler son endpoints públicos: que la UI no
 * dibuje el botón no impide que alguien las invoque. Por eso el flag se revalida
 * acá y no se confía en la pantalla.
 */
export async function requireGenerationAccess(clientId: string): Promise<{
  user: User;
  client: PortalClient;
  ctx: GenerationContext;
}> {
  const { user } = await requirePortalSession();
  const client = await getPortalClient(user.id, clientId);

  // 404 y no 403: no le confirmamos a nadie que esa marca existe.
  if (!client) throw new PortalGenerationError("Esa marca no existe.", 404);

  if (!hasFeature(client.features, AI_FEATURE_SLUG)) {
    throw new PortalGenerationError(
      "La generación con IA no está habilitada para esta marca.",
      403,
    );
  }

  const ctx = await loadGenerationContext(client.id);
  return { user, client, ctx };
}

// ─── Tope ────────────────────────────────────────────────────────────────────

/**
 * Estado del tope. Se lee con service role: el miembro no tiene select sobre
 * `ai_usage_log`, así que con su sesión el conteo daría 0 y no cortaría nunca.
 */
export async function getGenerationState(
  clientId: string,
  ownerId: string,
  limit: number | null,
): Promise<AiUsageState> {
  return getAiUsageState(createServiceClient(), clientId, ownerId, limit);
}

/**
 * `owner_id` de una marca, sin leer el resto del perfil ni el cerebro.
 *
 * La pantalla del portal lo necesita solo para contar el consumo, y
 * `loadGenerationContext` para eso sería traerse el cerebro entero al pedo.
 */
export async function getClientOwnerId(clientId: string): Promise<string> {
  const { data, error } = await createServiceClient()
    .from("clients")
    .select("owner_id")
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw new PortalGenerationError(error.message, 500);
  if (!data) throw new PortalGenerationError("Esa marca no existe.", 404);
  return data.owner_id as string;
}

/** Igual, pero corta con 429 si ya se pasó. Se llama antes de tocar la API. */
export async function assertCanGenerate(
  clientId: string,
  ownerId: string,
  limit: number | null,
): Promise<AiUsageState> {
  const state = await getGenerationState(clientId, ownerId, limit);

  if (state.blocked) {
    throw new PortalGenerationError(
      `Llegaste al tope de ${state.limit} ${state.limit === 1 ? "guion" : "guiones"} de este mes. El contador se reinicia el día 1; si necesitas más, pídeselo a quien maneja tu contenido.`,
      429,
    );
  }

  return state;
}

// ─── Prompts ─────────────────────────────────────────────────────────────────
// Espejo de `/api/ai/{big-idea,structures,script}`. Se duplican en vez de
// importarse porque aquellas rutas son handlers, no módulos exportables; si un
// prompt cambia allá y acá no, el cliente recibe guiones con otro criterio que
// los de Paco. Al tocar uno, revisar el otro.

const REEL_FORMAT = `{
  "voice_off": "texto completo para teleprompter, flujo continuo sin etiquetas, máximo 150-200 palabras para 30-60 segundos"
}`;

const REEL_FORMAT_ALBORNA = `{
  "voice_off": "texto completo para teleprompter, flujo continuo sin etiquetas, máximo 150-200 palabras",
  "source": {"title": "Título exacto de la película, serie, libro o descripción del evento real", "type": "película | serie | libro | historia real", "description": "contexto breve de la fuente en 1 oración — ¿por qué es relevante?"}
}`;

const CAROUSEL_FORMAT = `{
  "slides": [
    {
      "number": 1,
      "text": "texto del slide ≤15 palabras",
      "visual": "descripción del diseño visual: jerarquía tipográfica, elemento visual, color/contraste",
      "micro_anchor": "elemento de retención o null si no aplica"
    }
  ]
}`;

function isAlbornaStructure(name: string): boolean {
  return name.toLowerCase().includes("alborna");
}

function typeLabel(type: ScriptType): string {
  return type === "reel" ? "Reel (30–60s)" : "Carrusel (8–10 slides)";
}

// ─── Paso 1 (modo completo): Big Idea ────────────────────────────────────────

export async function generateBigIdea(
  ctx: GenerationContext,
  input: { brief: string; type: ScriptType },
): Promise<string> {
  const userMessage = `Tipo de contenido: ${typeLabel(input.type)}

Brief:
${input.brief.trim()}

Tu tarea: define LA BIG IDEA de este guion — el mensaje central más poderoso que queremos transmitir.

La Big Idea debe:
- Ser una sola oración clara y concreta (máximo 2 oraciones)
- Conectar el dolor o deseo del cliente ideal con la propuesta de valor
- Ser lo suficientemente específica para guiar todo el guion
- Sonar como algo que la audiencia sentiría como propio

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional):
{"big_idea": "..."}`;

  const { data } = await generateJson<{ big_idea?: string }>({
    label: "portal:big-idea",
    userMessage,
    clientContext: ctx.clientContext,
    brainContent: ctx.brainContent,
    model: MODEL_FAST,
    maxTokens: 300,
  });

  const bigIdea = (data.big_idea ?? "").trim();
  if (!bigIdea) throw new PortalGenerationError("La IA no devolvió una Big Idea.", 502);
  return bigIdea;
}

// ─── Paso 2 (modo completo): estructuras ─────────────────────────────────────

export type ProposedStructure = { name: string; hook: string; arc: string; close: string };

export async function generateStructures(
  ctx: GenerationContext,
  input: { brief: string; type: ScriptType; bigIdea?: string },
): Promise<{ discarded: { name: string; reason: string }; structures: ProposedStructure[] }> {
  const userMessage = `Tipo de contenido: ${typeLabel(input.type)}

Brief:
${input.brief.trim()}
${input.bigIdea?.trim() ? `\nBig Idea (mensaje central confirmado por el usuario — todas las estructuras deben servir a este mensaje):\n"${input.bigIdea.trim()}"\n` : ""}
Aplica el Paso 0 de tu flujo. Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional). Formato exacto:
{
  "discarded": {"name": "nombre exacto de la estructura descartada", "reason": "razón en ≤15 palabras"},
  "structures": [
    {
      "name": "nombre completo de la estructura",
      "hook": "primera frase o imagen de apertura — específica para este brief y cliente",
      "arc": "cómo se desarrolla en 1 oración",
      "close": "cómo termina — pregunta, invitación o revelación"
    },
    {
      "name": "...",
      "hook": "...",
      "arc": "...",
      "close": "..."
    },
    {
      "name": "...",
      "hook": "...",
      "arc": "...",
      "close": "..."
    }
  ]
}`;

  const { data } = await generateJson<{
    discarded?: { name: string; reason: string };
    structures?: ProposedStructure[];
  }>({
    label: "portal:structures",
    userMessage,
    clientContext: ctx.clientContext,
    brainContent: ctx.brainContent,
    model: MODEL_DEFAULT,
    maxTokens: 1500,
  });

  const structures = (data.structures ?? []).filter((s) => s?.name);
  if (structures.length === 0) {
    throw new PortalGenerationError("La IA no propuso ninguna estructura.", 502);
  }

  return {
    discarded: data.discarded ?? { name: "", reason: "" },
    structures,
  };
}

// ─── Paso final: el guion ────────────────────────────────────────────────────

export type GeneratedScript = {
  content: Record<string, unknown>;
  structureName: string;
  inputTokens: number;
  outputTokens: number;
};

/**
 * En modo `simple` no llega estructura: la elige la IA y devuelve cuál usó, para
 * que el guion guardado tenga el mismo `structure_name` que uno del estudio.
 */
export async function generateScript(
  ctx: GenerationContext,
  input: {
    brief: string;
    type: ScriptType;
    bigIdea?: string;
    structureName?: string;
    structure?: { hook: string; arc: string; close: string };
  },
): Promise<GeneratedScript> {
  const chooseStructure = !input.structureName?.trim();
  const isAlborna = !chooseStructure && isAlbornaStructure(input.structureName!);

  const format =
    input.type === "carousel"
      ? CAROUSEL_FORMAT
      : isAlborna || chooseStructure
        ? REEL_FORMAT_ALBORNA
        : REEL_FORMAT;

  const structureBlock = chooseStructure
    ? `Estructura: elígela tú. Aplica el Paso 0 de tu flujo, quédate con la que mejor sirva a este brief y este cliente, y desarróllala completa.`
    : `Estructura elegida: ${input.structureName}${
        input.structure
          ? `\nPlanteamiento de la estructura (respétalo fielmente):\n- Hook: ${input.structure.hook}\n- Arco: ${input.structure.arc}\n- Cierre: ${input.structure.close}`
          : ""
      }`;

  const bigIdeaLine = input.bigIdea?.trim()
    ? `\nBig Idea (mensaje central — todo el guion debe servir a esta idea):\n"${input.bigIdea.trim()}"\n`
    : "";

  // Las reglas de Alborna aplican si la estructura elegida es esa, y también en
  // modo simple, donde la IA todavía no eligió: si termina eligiéndola, la
  // fuente es obligatoria igual. `source` es opcional en el formato, así que
  // pedirlas de más no rompe las otras estructuras.
  const albornaRules =
    isAlborna || chooseStructure
      ? `\nSI USAS LA ESTRUCTURA DE JULIAN ALBORNA, ESTAS REGLAS SON OBLIGATORIAS:
1. La historia de apoyo DEBE ser REAL y verificable: una película, serie, libro o evento histórico documentado. PROHIBIDO inventar personajes o situaciones ficticias no atribuibles a una fuente real.
2. Especifica SIEMPRE la fuente exacta en el campo "source". Si NO usas esa estructura, omite "source" por completo.
3. La micro-historia cotidiana de apertura debe conectar de forma NATURAL con la historia real — el puente debe sentirse inevitable, no forzado.\n`
      : "";

  // En modo simple la IA elige la estructura, así que tiene que decir cuál: se
  // le agrega la clave al formato en vez de pedirla aparte (un JSON, un parseo).
  const finalFormat = chooseStructure
    ? format.replace(
        "{",
        '{\n  "structure_name": "nombre exacto de la estructura que elegiste",',
      )
    : format;

  const userMessage = `Tipo de contenido: ${typeLabel(input.type)}

Brief:
${input.brief.trim()}
${bigIdeaLine}
${structureBlock}
${albornaRules}
Genera el guion completo. Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional). Formato exacto:
${finalFormat}`;

  const model = input.type === "carousel" ? MODEL_FAST : MODEL_DEFAULT;
  const maxTokens = input.type === "carousel" ? 2048 : 4096;

  const { data: parsed, result } = await generateJson<Record<string, unknown>>({
    label: "portal:script",
    userMessage,
    clientContext: ctx.clientContext,
    brainContent: ctx.brainContent,
    model,
    maxTokens,
  });

  const structureName =
    input.structureName?.trim() ||
    (typeof parsed.structure_name === "string" ? parsed.structure_name.trim() : "") ||
    "Estructura libre";

  // Misma normalización que `/api/ai/script`: en un reel los bloques de
  // producción se generan aparte (desde el estudio), así que el guion nace con
  // la voz en off y el resto vacío. Sin esto, los visores del portal y del
  // estudio reciben una forma que no esperan.
  let content: Record<string, unknown>;
  if (input.type === "reel") {
    content = {
      voice_off: parsed.voice_off ?? "",
      blocks: [],
      music_a: null,
      music_b: null,
      ...(parsed.source ? { source: parsed.source } : {}),
    };
  } else {
    content = { slides: parsed.slides ?? [] };
  }

  return {
    content,
    structureName,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

// ─── Adaptar un post de competencia (add-on de IA, mismo cupo que generar) ───
// Espejo de `/api/ai/adapt-competitor` — esa ruta es un handler, no un módulo
// importable, así que el prompt se duplica a propósito (misma disciplina que
// los otros pasos de este archivo). Al tocar uno, revisar el otro. A
// diferencia del estudio, el portal solo ofrece la adaptación "completa": la
// variante "ligera" (con contexto libre) es una herramienta de afinado que no
// aporta a un cliente que solo quiere un guion listo.

const ADAPT_REEL_FORMAT = `{
  "structure_name": "nombre de la estructura del cerebro que mejor encaja con esta adaptación",
  "title": "título de publicación corto y atractivo",
  "voice_off": "texto completo para teleprompter, flujo continuo sin etiquetas, máximo 150-200 palabras para 30-60 segundos"
}`;

const ADAPT_CAROUSEL_FORMAT = `{
  "structure_name": "nombre de la estructura del cerebro que mejor encaja con esta adaptación",
  "title": "título de publicación corto y atractivo",
  "slides": [
    {
      "number": 1,
      "text": "titular o headline del slide ≤12 palabras",
      "body": "párrafo de desarrollo del slide: 1-2 oraciones con el argumento o valor de ese slide (máximo 40 palabras)",
      "visual": "descripción del diseño visual: jerarquía tipográfica, elemento visual, color/contraste",
      "micro_anchor": "elemento de retención al final del slide o null si no aplica"
    }
  ]
}`;

export type AdaptSourcePost = {
  username: string | null;
  caption: string | null;
  type: string | null;
  likes: number | null;
  comments: number | null;
  video_views: number | null;
  transcription: string | null;
};

function fmtAdaptMetric(n: number | null | undefined): string {
  return n == null ? "—" : String(n);
}

export async function adaptCompetitorPost(
  ctx: GenerationContext,
  post: AdaptSourcePost,
  type: ScriptType,
): Promise<GeneratedScript> {
  const knowledge = loadClientKnowledge(ctx.clientName);
  const clientContext = knowledge
    ? `${ctx.clientContext}\n\n## Conocimiento de marca de ${ctx.clientName}\n${knowledge}`
    : ctx.clientContext;

  const format = type === "carousel" ? ADAPT_CAROUSEL_FORMAT : ADAPT_REEL_FORMAT;
  const sourceMetrics = [
    post.video_views != null && `Vistas: ${fmtAdaptMetric(post.video_views)}`,
    `Likes: ${fmtAdaptMetric(post.likes)}`,
    `Comentarios: ${fmtAdaptMetric(post.comments)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const contentSection = post.transcription
    ? `Transcripción del audio (fuente primaria):\n"""\n${post.transcription.trim()}\n"""\nCaption (referencia):\n"""\n${(post.caption ?? "(sin caption)").trim()}\n"""`
    : `Caption:\n"""\n${(post.caption ?? "(sin caption)").trim()}\n"""`;

  const userMessage = `Tarea: ADAPTAR a la marca del cliente una idea que YA funcionó en la competencia. NO es una copia: toma el ÁNGULO, el HOOK y la ESTRUCTURA ganadora del post fuente y reescríbelos por completo con la voz, el qué-vende, el dolor y el deseo del cliente. El resultado debe sonar 100% del cliente, no del competidor.

Tipo de contenido a generar: ${typeLabel(type)}

── Post fuente (competencia) ──
Autor: @${post.username ?? "desconocido"}
Tipo original: ${post.type ?? "—"}
Métricas: ${sourceMetrics}
${contentSection}

Instrucciones:
1. Identifica POR QUÉ este contenido funcionó (el gancho, la promesa, la estructura) y reusa ESE patrón, no el tema ni las palabras del competidor.
2. Aterrízalo al cliente: su producto, su cliente ideal, su dolor/deseo y su tono de voz.
3. Elige del cerebro la estructura narrativa que mejor encaje y devuélvela en "structure_name".
4. Propón un "title" de publicación.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional). Formato exacto:
${format}`;

  const model = type === "carousel" ? MODEL_FAST : MODEL_DEFAULT;
  const maxTokens = type === "carousel" ? 3000 : 4096;

  const { data: parsed, result } = await generateJson<Record<string, unknown>>({
    label: "portal:adapt-competitor",
    userMessage,
    clientContext,
    brainContent: ctx.brainContent,
    model,
    maxTokens,
  });

  const structureName =
    typeof parsed.structure_name === "string" && parsed.structure_name.trim()
      ? parsed.structure_name.trim()
      : "Adaptado de competencia";

  const content: Record<string, unknown> =
    type === "reel"
      ? { voice_off: parsed.voice_off ?? "", blocks: [], music_a: null, music_b: null }
      : { slides: parsed.slides ?? [] };

  return {
    content,
    structureName,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

// ─── Guardado ────────────────────────────────────────────────────────────────

/**
 * Guarda el guion generado en la marca del cliente.
 *
 * Decisiones:
 * - **Estado `preproduccion`** ("En preparación" en el portal). No `idea`: el
 *   portal esconde ese estado a propósito, y el cliente perdería de vista lo
 *   que acaba de generar. `preproduccion` describe bien lo que es: un borrador
 *   esperando que Paco lo trabaje.
 * - **`owner_id` = dueño de la marca**, nunca el miembro. Misma regla de oro
 *   que el trigger `set_owner_from_client` de `script_comments`: si quedara en
 *   el miembro, la fila desaparecería de la vista de Paco.
 * - **No** se crea la idea en `content_calendar` (a diferencia de
 *   `saveScriptWithNewIdea`): cuándo se publica lo decide Paco, no el cliente.
 */
export async function saveGeneratedScript(input: {
  clientId: string;
  ownerId: string;
  userId: string;
  type: ScriptType;
  brief: string;
  structureName: string;
  title: string | null;
  content: Record<string, unknown>;
  brainVersionId: string | null;
}): Promise<string> {
  const admin = createServiceClient();

  const { data, error } = await admin
    .from("scripts")
    .insert({
      owner_id: input.ownerId,
      client_id: input.clientId,
      type: input.type,
      brief: input.brief,
      structure_name: input.structureName,
      title: input.title,
      content: input.content,
      brain_version_id: input.brainVersionId,
      status: "preproduccion",
      generated_by: input.userId,
    })
    .select("id")
    .single();

  if (error) throw new PortalGenerationError(error.message, 500);
  return data.id as string;
}

/**
 * `redirect()` y `notFound()` de Next se implementan **lanzando** un error con
 * `digest`. Un `catch (e)` genérico —como el de las rutas y el de las actions—
 * se los come y los convierte en un 500 silencioso: el usuario sin sesión
 * recibiría "error interno" en vez de ir a `/login`. Hay que dejarlos pasar.
 */
export function rethrowIfNextControlFlow(e: unknown): void {
  const digest = (e as { digest?: unknown } | null)?.digest;
  if (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
  ) {
    throw e;
  }
}

/** Traduce cualquier error a `{ message, status }` para las rutas y actions. */
export function generationErrorInfo(e: unknown): { message: string; status: number } {
  if (e instanceof PortalGenerationError) return { message: e.message, status: e.status };
  if (e instanceof AiJsonError) {
    return {
      message: "La IA devolvió una respuesta que no se pudo leer. Intenta de nuevo.",
      status: 502,
    };
  }
  return {
    message: e instanceof Error ? e.message : "No se pudo generar el guion.",
    status: 500,
  };
}
