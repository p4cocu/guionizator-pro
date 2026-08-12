import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODEL_DEFAULT } from "@/lib/ai/anthropic";
import { AiJsonError, generateJson } from "@/lib/ai/json";

export const runtime = "nodejs";
export const maxDuration = 60;

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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { client_id, brief, type, big_idea } = (await req.json()) as {
      client_id: string;
      brief: string;
      type: "reel" | "carousel";
      big_idea?: string;
    };

    if (!client_id || !brief?.trim() || !type) {
      return NextResponse.json({ error: "client_id, brief y type son requeridos" }, { status: 400 });
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
      .select("content")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .single();

    const userMessage = `Tipo de contenido: ${type === "reel" ? "Reel (30–60s)" : "Carrusel (8–10 slides)"}

Brief:
${brief.trim()}
${big_idea?.trim() ? `\nBig Idea (mensaje central confirmado por el usuario — todas las estructuras deben servir a este mensaje):\n"${big_idea.trim()}"\n` : ""}
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

    let parsed;
    try {
      ({ data: parsed } = await generateJson({
        label: "structures",
        userMessage,
        brainContent: activeBrain?.content ?? undefined,
        clientContext: buildClientContext(client),
        model: MODEL_DEFAULT,
        maxTokens: 1500,
      }));
    } catch (e) {
      if (e instanceof AiJsonError) {
        return NextResponse.json({ error: "Error al parsear respuesta de IA", raw: e.rawText }, { status: 500 });
      }
      throw e;
    }

    return NextResponse.json(parsed);
  } catch (e) {
    console.error("[structures] Error:", e);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
