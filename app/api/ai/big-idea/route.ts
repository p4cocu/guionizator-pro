import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWithBrain, MODEL_FAST } from "@/lib/ai/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

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

    const { client_id, brief, type } = (await req.json()) as {
      client_id: string;
      brief: string;
      type: "reel" | "carousel";
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

    const userMessage = `Tipo de contenido: ${type === "reel" ? "Reel (30–60s)" : "Carrusel (8–10 slides)"}

Brief:
${brief.trim()}

Tu tarea: define LA BIG IDEA de este guion — el mensaje central más poderoso que queremos transmitir.

La Big Idea debe:
- Ser una sola oración clara y concreta (máximo 2 oraciones)
- Conectar el dolor o deseo del cliente ideal con la propuesta de valor
- Ser lo suficientemente específica para guiar todo el guion
- Sonar como algo que la audiencia sentiría como propio

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional):
{"big_idea": "..."}`;

    const result = await generateWithBrain({
      userMessage,
      clientContext: buildClientContext(client),
      model: MODEL_FAST,
      maxTokens: 300,
    });

    let parsed;
    try {
      const cleaned = result.text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Error al parsear respuesta de IA", raw: result.text }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (e) {
    console.error("[big-idea] Error:", e);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
