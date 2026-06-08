import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWithBrain, MODEL_DEFAULT } from "@/lib/ai/anthropic";

export const runtime = "nodejs";
export const maxDuration = 120;

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

REGLAS:
- Si la instrucción pide N alternativas/opciones/propuestas de una parte (ej: "3 alternativas de hook", "2 propuestas de cierre"), devuelve exactamente N variantes completas del guion donde SOLO esa parte cambia. Los labels serán "Opción 1", "Opción 2", etc.
- Si la instrucción es un cambio directo (ej: "el cierre usa lenguaje más simple"), devuelve 1 variante con el cambio aplicado. Label: "Cambio aplicado".
- Siempre devuelve guiones COMPLETOS en el formato exacto indicado.
- Respeta el brief y el perfil del cliente en todas las variantes.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional):
{
  "options": [
    { "label": "Opción 1", "content": ${format} }
  ]
}`;

  const result = await generateWithBrain({
    userMessage,
    brainContent: activeBrain?.content ?? undefined,
    clientContext: clientCtx,
    model: MODEL_DEFAULT,
    maxTokens: 6000,
  });

  let parsed;
  try {
    const cleaned = result.text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "Error al parsear respuesta de IA", raw: result.text }, { status: 500 });
  }

  return NextResponse.json(parsed);
}
