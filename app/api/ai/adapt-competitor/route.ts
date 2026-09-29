import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODEL_DEFAULT, MODEL_FAST } from "@/lib/ai/anthropic";
import { AiJsonError, generateJson } from "@/lib/ai/json";
import { loadClientKnowledge } from "@/lib/ai/clientKnowledge";
import { buildClientContext } from "@/lib/ai/clientContext";
import { withProductContext } from "@/lib/ai/productContext";
import { loadProductContext } from "@/lib/products/load";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Qué hacer con el servicio elegido (ficha de oferta, migración 0016). Cambia
 * según el modo porque la ligera tiene una regla opuesta: no tocar la esencia
 * del post. Ahí el servicio entra solo por el cierre.
 */
const PRODUCT_ADAPT_COMPLETE = `
Servicio a promover: el de la ficha "Servicio que promueve este contenido" de arriba.
- Aterriza el patrón ganador en ESE servicio: el problema, el público y el cierre salen de su ficha.
- El cierre invita al CTA de la ficha (si lo tiene).
- Usa objeciones, proceso o prueba social de la ficha solo donde sumen, sin convertirlo en anuncio.`;

const PRODUCT_ADAPT_LIGHT = `
Servicio a promover: el de la ficha "Servicio que promueve este contenido" de arriba.
- NO cambies el ángulo ni el desarrollo del post: solo el cierre.
- El cierre conecta la idea con ese servicio en 1-2 frases naturales e invita a su CTA (si la ficha lo tiene).`;

const REEL_FORMAT = `{
  "structure_name": "nombre de la estructura del cerebro que mejor encaja con esta adaptación",
  "title": "título de publicación corto y atractivo",
  "voice_off": "texto completo para teleprompter, flujo continuo sin etiquetas, máximo 150-200 palabras para 30-60 segundos"
}`;

const CAROUSEL_FORMAT = `{
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

type SourcePost = {
  username?: string | null;
  caption?: string | null;
  type?: string | null;
  likes?: number | null;
  comments?: number | null;
  video_views?: number | null;
  permalink?: string | null;
  posted_at?: string | null;
  transcription?: string | null;
};

function fmtMetric(n: number | null | undefined): string {
  return n == null ? "—" : String(n);
}

function buildContentSection(post: SourcePost): string {
  const caption = (post.caption ?? "(sin caption)").trim();
  if (post.transcription) {
    return `Transcripción del audio (fuente primaria):
"""
${post.transcription.trim()}
"""
Caption (referencia):
"""
${caption}
"""`;
  }
  return `Caption:
"""
${caption}
"""`;
}

function buildCompletePrompt(
  post: SourcePost,
  type: "reel" | "carousel",
  format: string,
  hasProduct = false,
): string {
  const sourceMetrics = [
    post.video_views != null && `Vistas: ${fmtMetric(post.video_views)}`,
    `Likes: ${fmtMetric(post.likes)}`,
    `Comentarios: ${fmtMetric(post.comments)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return `Tarea: ADAPTAR a la marca del cliente una idea que YA funcionó en la competencia. NO es una copia: toma el ÁNGULO, el HOOK y la ESTRUCTURA ganadora del post fuente y reescríbelos por completo con la voz, el qué-vende, el dolor y el deseo del cliente. El resultado debe sonar 100% del cliente, no del competidor.

Tipo de contenido a generar: ${type === "reel" ? "Reel (30–60s)" : "Carrusel (8–10 slides)"}

── Post fuente (competencia) ──
Autor: @${post.username ?? "desconocido"}
Tipo original: ${post.type ?? "—"}
Métricas: ${sourceMetrics}
${buildContentSection(post)}

Instrucciones:
1. Identifica POR QUÉ este contenido funcionó (el gancho, la promesa, la estructura) y reusa ESE patrón, no el tema ni las palabras del competidor.
2. Aterrízalo al cliente: su producto, su cliente ideal, su dolor/deseo y su tono de voz.
3. Elige del cerebro la estructura narrativa que mejor encaje y devuélvela en "structure_name".
4. Propón un "title" de publicación.
${hasProduct ? PRODUCT_ADAPT_COMPLETE : ""}
Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional). Formato exacto:
${format}`;
}

function buildLightPrompt(
  post: SourcePost,
  type: "reel" | "carousel",
  format: string,
  context?: string,
  hasProduct = false,
): string {
  const sourceMetrics = [
    post.video_views != null && `Vistas: ${fmtMetric(post.video_views)}`,
    `Likes: ${fmtMetric(post.likes)}`,
    `Comentarios: ${fmtMetric(post.comments)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return `Tarea: ADAPTAR LIGERAMENTE el tono de voz de un post de la competencia. Conserva exactamente el mismo ángulo, la misma idea central, la misma estructura y el mismo gancho del post fuente. SOLO cambia el tono de voz para que suene al cliente, sin alterar la esencia del contenido.${context ? `\n\nContexto adicional del creador: ${context}` : ""}

Tipo de contenido a generar: ${type === "reel" ? "Reel (30–60s)" : "Carrusel (8–10 slides)"}

── Post fuente (competencia) ──
Autor: @${post.username ?? "desconocido"}
Tipo original: ${post.type ?? "—"}
Métricas: ${sourceMetrics}
${buildContentSection(post)}

Instrucciones:
1. Mantén el mismo tema, ángulo, estructura de información y gancho del post fuente.
2. Adapta SOLO el tono de voz al perfil del cliente (su forma de hablar, vocabulario, registro).
3. ${hasProduct ? "El servicio a promover entra SOLO por el cierre (ver abajo)." : "Usa los productos/servicios del cliente solo si encajan naturalmente — no fuerces el pitch."}
4. Elige del cerebro la estructura narrativa más similar a la del post fuente.
5. Propón un "title" de publicación.
${hasProduct ? PRODUCT_ADAPT_LIGHT : ""}
Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional). Formato exacto:
${format}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { client_id, post, type: typeOverride, adapt_type, context, product_id } = (await req.json()) as {
      client_id: string;
      post: SourcePost;
      type?: "reel" | "carousel";
      adapt_type?: "completa" | "ligera";
      context?: string;
      /** Servicio al que se adapta, además de la marca (migración 0016). */
      product_id?: string | null;
    };

    if (!client_id || !post) {
      return NextResponse.json({ error: "client_id y post son requeridos" }, { status: 400 });
    }

    const type: "reel" | "carousel" =
      typeOverride ?? (post.type === "carousel" ? "carousel" : "reel");

    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .eq("owner_id", user.id)
      .single();

    if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    const { data: activeBrain } = await supabase
      .from("brain_versions")
      .select("id, content")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .single();

    const productContext = await loadProductContext(supabase, {
      productId: product_id,
      ownerId: user.id,
      clientId: client_id,
    });

    let clientContext = buildClientContext(client);
    const knowledge = loadClientKnowledge(client.nombre as string);
    if (knowledge) {
      clientContext += `\n\n## Conocimiento de marca de ${client.nombre}\n${knowledge}`;
    }
    clientContext = withProductContext(clientContext, productContext);

    const format = type === "carousel" ? CAROUSEL_FORMAT : REEL_FORMAT;
    const isLight = adapt_type === "ligera";
    const hasProduct = productContext !== null;

    const userMessage = isLight
      ? buildLightPrompt(post, type, format, context, hasProduct)
      : buildCompletePrompt(post, type, format, hasProduct);

    const model = type === "carousel" ? MODEL_FAST : MODEL_DEFAULT;
    const maxTokens = type === "carousel" ? 3000 : 4096;

    let parsed;
    try {
      ({ data: parsed } = await generateJson({
        label: "adapt-competitor",
        userMessage,
        brainContent: activeBrain?.content ?? undefined,
        clientContext,
        model,
        maxTokens,
      }));
    } catch (e) {
      if (e instanceof AiJsonError) {
        return NextResponse.json({ error: "Error al parsear respuesta de IA", raw: e.rawText }, { status: 500 });
      }
      throw e;
    }

    const structure_name =
      typeof parsed.structure_name === "string" && parsed.structure_name.trim()
        ? parsed.structure_name.trim()
        : "Adaptado de competencia";
    const title =
      typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : null;

    let content: Record<string, unknown>;
    if (type === "reel") {
      content = {
        voice_off: parsed.voice_off ?? "",
        blocks: [],
        music_a: null,
        music_b: null,
      };
    } else {
      content = { slides: parsed.slides ?? [] };
    }

    return NextResponse.json({
      content,
      structure_name,
      title,
      type,
      brain_version_id: activeBrain?.id ?? null,
    });
  } catch (e) {
    console.error("[adapt-competitor] Error:", e);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
