import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODEL_DEFAULT } from "@/lib/ai/anthropic";
import { AiJsonError, generateJson } from "@/lib/ai/json";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, brief, type, content, fragment, instruction } = (await req.json()) as {
    client_id: string;
    brief: string;
    type: "reel" | "carousel";
    content: Record<string, unknown>;
    fragment: string;
    instruction?: string;
  };

  if (!client_id || !brief?.trim() || !type || !content || !fragment?.trim()) {
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

  const userMessage = `Eres editor de guiones de ${type === "reel" ? "Reels de Instagram (30–60s)" : "carruseles de Instagram"}.

Brief original: ${brief.trim()}

Guion completo (contexto):
${JSON.stringify(content, null, 2)}

El usuario quiere reemplazar este fragmento exacto:
"${fragment.trim()}"

${instruction?.trim() ? `Instrucción adicional: "${instruction.trim()}"` : ""}

Genera exactamente 2 alternativas para ese fragmento. Cada alternativa debe:
- Mantener la longitud y el tono del original
- Ser coherente con el resto del guion
- Adaptarse al perfil del cliente

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional):
{
  "options": [
    { "label": "Opción 1", "text": "..." },
    { "label": "Opción 2", "text": "..." }
  ]
}`;

  let parsed;
  try {
    ({ data: parsed } = await generateJson({
      label: "inline-edit",
      userMessage,
      brainContent: activeBrain?.content ?? undefined,
      clientContext: clientCtx,
      model: MODEL_DEFAULT,
      maxTokens: 1500,
    }));
  } catch (e) {
    if (e instanceof AiJsonError) {
      return NextResponse.json({ error: "Error al parsear respuesta de IA", raw: e.rawText }, { status: 500 });
    }
    console.error("inline-edit error:", e);
    return NextResponse.json({ error: "Error al conectar con la IA" }, { status: 500 });
  }

  return NextResponse.json(parsed);
}
