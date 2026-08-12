import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODEL_DEFAULT, MODEL_FAST } from "@/lib/ai/anthropic";
import { AiJsonError, generateJson } from "@/lib/ai/json";

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

// Reels: only voice_off on first generation — production blocks are generated
// separately via /api/ai/production-blocks once the script is polished.
const REEL_FORMAT = `{
  "voice_off": "texto completo para teleprompter, flujo continuo sin etiquetas, máximo 150-200 palabras para 30-60 segundos"
}`;

// Julian Alborna format — voice_off only, includes source card
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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { client_id, brief, type, structure_name, structure, big_idea, micro_story } = (await req.json()) as {
      client_id: string;
      brief: string;
      type: "reel" | "carousel";
      structure_name: string;
      structure?: { hook: string; arc: string; close: string };
      big_idea?: string;
      micro_story?: string;
    };

    if (!client_id || !brief?.trim() || !type || !structure_name) {
      return NextResponse.json({ error: "client_id, brief, type y structure_name son requeridos" }, { status: 400 });
    }

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

    const isAlborna = isAlbornaStructure(structure_name);

    let format: string;
    if (type === "carousel") {
      format = CAROUSEL_FORMAT;
    } else if (isAlborna) {
      format = REEL_FORMAT_ALBORNA;
    } else {
      format = REEL_FORMAT;
    }

    const structurePlan = structure
      ? `\nPlanteamiento de la estructura (respétalo fielmente):\n- Hook: ${structure.hook}\n- Arco: ${structure.arc}\n- Cierre: ${structure.close}`
      : "";

    const bigIdeaLine = big_idea?.trim()
      ? `\nBig Idea (mensaje central — todo el guion debe servir a esta idea):\n"${big_idea.trim()}"\n`
      : "";

    const microStoryLine = micro_story?.trim() && isAlborna
      ? `\nMicro-historia de apertura (YA ESTÁ ELEGIDA por el usuario — úsala EXACTAMENTE como apertura del bloque MICRO-HISTORIA, sin cambiar su esencia, solo adaptando si es necesario para fluidez):\n"${micro_story.trim()}"\n`
      : "";

    const albornaRules = isAlborna
      ? `\nREGLAS CRÍTICAS PARA JULIAN ALBORNA:
1. La historia de apoyo (bloque HISTORIA REAL) DEBE ser una historia REAL y verificable: una película, serie, libro, o evento histórico documentado. PROHIBIDO inventar personajes o situaciones ficticias no atribuibles a una fuente real.
2. Al final del JSON, en el campo "source", especifica SIEMPRE la fuente exacta: título de la película/serie/libro, o descripción del evento real con fecha/contexto.
3. La micro-historia de apertura (bloque MICRO-HISTORIA) debe conectar de forma NATURAL con la historia real — el puente debe sentirse inevitable, no forzado.
4. El guion completo debe construirse sobre la Big Idea arriba indicada.\n`
      : "";

    const userMessage = `Tipo de contenido: ${type === "reel" ? "Reel (30–60s)" : "Carrusel (8–10 slides)"}

Brief:
${brief.trim()}
${bigIdeaLine}${microStoryLine}
Estructura elegida: ${structure_name}${structurePlan}
${albornaRules}
Genera el guion completo desarrollando exactamente el planteamiento indicado arriba. Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional). Formato exacto:
${format}`;

    const model = type === "carousel" ? MODEL_FAST : MODEL_DEFAULT;
    const maxTokens = type === "carousel" ? 2048 : 4096;

    let parsed: Record<string, unknown>;
    try {
      ({ data: parsed } = await generateJson({
        label: "script",
        userMessage,
        brainContent: activeBrain?.content ?? undefined,
        clientContext: buildClientContext(client),
        model,
        maxTokens,
      }));
    } catch (e) {
      if (e instanceof AiJsonError) {
        return NextResponse.json({ error: "Error al parsear respuesta de IA", raw: e.rawText }, { status: 500 });
      }
      throw e;
    }

    // Normalise reel content: production blocks are generated separately
    if (type === "reel") {
      parsed = {
        voice_off: parsed.voice_off ?? "",
        blocks: [],
        music_a: null,
        music_b: null,
        ...(parsed.source ? { source: parsed.source } : {}),
      };
    }

    return NextResponse.json({
      content: parsed,
      brain_version_id: activeBrain?.id ?? null,
    });
  } catch (e) {
    console.error("[script] Error:", e);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
