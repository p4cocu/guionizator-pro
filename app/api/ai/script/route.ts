import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWithBrain, MODEL_DEFAULT } from "@/lib/ai/anthropic";

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

const REEL_FORMAT = `{
  "voice_off": "texto completo para teleprompter, flujo continuo sin etiquetas",
  "blocks": [
    {
      "name": "HOOK",
      "duration": "Xs",
      "lines": [
        {"tag": "CÁMARA", "text": "texto del guion"}
      ]
    }
  ],
  "music_a": {"name": "nombre ≤5 palabras", "why": "por qué funciona en 1-2 oraciones", "prompt": "prompt de generación ≤200 chars sin nombres de artistas o marcas"},
  "music_b": {"name": "...", "why": "...", "prompt": "..."}
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

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, brief, type, structure_name } = (await req.json()) as {
    client_id: string;
    brief: string;
    type: "reel" | "carousel";
    structure_name: string;
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

  const format = type === "reel" ? REEL_FORMAT : CAROUSEL_FORMAT;

  const userMessage = `Tipo de contenido: ${type === "reel" ? "Reel (30–60s)" : "Carrusel (8–10 slides)"}

Brief:
${brief.trim()}

Estructura elegida: ${structure_name}

Genera el guion completo aplicando la estructura elegida y el perfil del cliente. Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional). Formato exacto:
${format}`;

  const result = await generateWithBrain({
    userMessage,
    brainContent: activeBrain?.content ?? undefined,
    clientContext: buildClientContext(client),
    model: MODEL_DEFAULT,
    maxTokens: 4096,
  });

  let parsed;
  try {
    const cleaned = result.text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "Error al parsear respuesta de IA", raw: result.text }, { status: 500 });
  }

  return NextResponse.json({
    content: parsed,
    brain_version_id: activeBrain?.id ?? null,
  });
}
