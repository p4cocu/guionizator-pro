import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODEL_DEFAULT, MODEL_FAST } from "@/lib/ai/anthropic";
import { AiJsonError, generateJson } from "@/lib/ai/json";

export const runtime = "nodejs";
export const maxDuration = 120;

const REEL_FORMAT = `{
  "voice_off": "texto completo para teleprompter",
  "blocks": [
    {
      "name": "HOOK",
      "duration": "Xs",
      "lines": [{"tag": "CÁMARA", "text": "texto del guion"}]
    }
  ],
  "music_a": {"name": "nombre ≤5 palabras", "why": "por qué funciona", "prompt": "prompt ≤200 chars sin marcas"},
  "music_b": {"name": "...", "why": "...", "prompt": "..."}
}`;

const CAROUSEL_FORMAT = `{
  "slides": [
    {
      "number": 1,
      "text": "texto del slide ≤15 palabras",
      "visual": "descripción del diseño visual",
      "micro_anchor": "elemento de retención o null"
    }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { client_id, brief, type, content, instruction } = (await req.json()) as {
      client_id: string;
      brief: string;
      type: "reel" | "carousel";
      content: Record<string, unknown>;
      instruction: string;
    };

    if (!client_id || !brief?.trim() || !type || !content || !instruction?.trim()) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
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

    const clientCtx = [
      `## Perfil del cliente: ${client.nombre}`,
      client.marca && `**Marca:** ${client.marca}`,
      client.cliente_ideal && `**Cliente ideal:** ${client.cliente_ideal}`,
      client.nicho && `**Nicho:** ${client.nicho}`,
      client.dolor && `**Dolor principal:** ${client.dolor}`,
      client.tono && `**Tono de voz:** ${client.tono}`,
    ].filter(Boolean).join("\n");

    const format = type === "reel" ? REEL_FORMAT : CAROUSEL_FORMAT;

    const userMessage = `Eres editor de guiones de ${type === "reel" ? "Reels de Instagram (30–60s)" : "carruseles de Instagram"}.

Brief original: ${brief.trim()}

Guion actual:
${JSON.stringify(content, null, 2)}

Instrucción del usuario: "${instruction.trim()}"

Genera 2 versiones alternativas del guion completo aplicando la instrucción. Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional):
{
  "options": [
    { "label": "Opción 1", "content": ${format} },
    { "label": "Opción 2", "content": ${format} }
  ]
}`;

    const model = type === "carousel" ? MODEL_FAST : MODEL_DEFAULT;
    const maxTokens = type === "carousel" ? 2048 : 4096;

    let parsed;
    try {
      ({ data: parsed } = await generateJson({
        label: "script-edit",
        userMessage,
        brainContent: activeBrain?.content ?? undefined,
        clientContext: clientCtx,
        model,
        maxTokens,
      }));
    } catch (e) {
      if (e instanceof AiJsonError) {
        return NextResponse.json({ error: "Error al parsear respuesta de IA", raw: e.rawText }, { status: 500 });
      }
      throw e;
    }

    return NextResponse.json(parsed);
  } catch (e) {
    console.error("[script-edit] Error:", e);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
