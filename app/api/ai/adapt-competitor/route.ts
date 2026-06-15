import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWithBrain, MODEL_DEFAULT, MODEL_FAST } from "@/lib/ai/anthropic";
import { loadClientKnowledge } from "@/lib/ai/clientKnowledge";

export const runtime = "nodejs";
export const maxDuration = 120;

function buildClientContext(c: Record<string, string | null>): string {
  return [
    `## Perfil del cliente: ${c.nombre}`,
    c.marca && `**Marca:** ${c.marca}`,
    c.que_vende && `**Qué vende:** ${c.que_vende}`,
    c.cliente_ideal && `**Cliente ideal:** ${c.cliente_ideal}`,
    c.nicho && `**Nicho:** ${c.nicho}`,
    c.dolor && `**Dolor principal:** ${c.dolor}`,
    c.deseo && `**Deseo principal:** ${c.deseo}`,
    c.tono && `**Tono de voz:** ${c.tono}`,
    c.notas && `**Notas adicionales:** ${c.notas}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Reel: solo voz en off en la primera generación — los bloques de producción se
// generan aparte vía /api/ai/production-blocks una vez pulida la voz en off.
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
      "text": "texto del slide ≤15 palabras",
      "visual": "descripción del diseño visual: jerarquía tipográfica, elemento visual, color/contraste",
      "micro_anchor": "elemento de retención o null si no aplica"
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
};

function fmtMetric(n: number | null | undefined): string {
  return n == null ? "—" : String(n);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { client_id, post, type: typeOverride } = (await req.json()) as {
      client_id: string;
      post: SourcePost;
      type?: "reel" | "carousel";
    };

    if (!client_id || !post) {
      return NextResponse.json({ error: "client_id y post son requeridos" }, { status: 400 });
    }

    // Tipo destino: respeta el override; si no, deriva del tipo del post fuente.
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

    // Contexto del cliente: perfil + conocimiento de marca por carpeta (si existe).
    let clientContext = buildClientContext(client);
    const knowledge = loadClientKnowledge(client.nombre as string);
    if (knowledge) {
      clientContext += `\n\n## Conocimiento de marca de ${client.nombre}\n${knowledge}`;
    }

    const format = type === "carousel" ? CAROUSEL_FORMAT : REEL_FORMAT;

    const sourceMetrics = [
      post.video_views != null && `Vistas: ${fmtMetric(post.video_views)}`,
      `Likes: ${fmtMetric(post.likes)}`,
      `Comentarios: ${fmtMetric(post.comments)}`,
    ]
      .filter(Boolean)
      .join(" · ");

    const userMessage = `Tarea: ADAPTAR a la marca del cliente una idea que YA funcionó en la competencia. NO es una copia: toma el ÁNGULO, el HOOK y la ESTRUCTURA ganadora del post fuente y reescríbelos por completo con la voz, el qué-vende, el dolor y el deseo del cliente. El resultado debe sonar 100% del cliente, no del competidor.

Tipo de contenido a generar: ${type === "reel" ? "Reel (30–60s)" : "Carrusel (8–10 slides)"}

── Post fuente (competencia) ──
Autor: @${post.username ?? "desconocido"}
Tipo original: ${post.type ?? "—"}
Métricas: ${sourceMetrics}
Caption:
"""
${(post.caption ?? "(sin caption)").trim()}
"""

Instrucciones:
1. Identifica POR QUÉ este contenido funcionó (el gancho, la promesa, la estructura) y reusa ESE patrón, no el tema ni las palabras del competidor.
2. Aterrízalo al cliente: su producto, su cliente ideal, su dolor/deseo y su tono de voz.
3. Elige del cerebro la estructura narrativa que mejor encaje y devuélvela en "structure_name".
4. Propón un "title" de publicación.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional). Formato exacto:
${format}`;

    const model = type === "carousel" ? MODEL_FAST : MODEL_DEFAULT;
    const maxTokens = type === "carousel" ? 2048 : 4096;

    const result = await generateWithBrain({
      userMessage,
      brainContent: activeBrain?.content ?? undefined,
      clientContext,
      model,
      maxTokens,
    });

    let parsed;
    try {
      const cleaned = result.text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Error al parsear respuesta de IA", raw: result.text }, { status: 500 });
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
