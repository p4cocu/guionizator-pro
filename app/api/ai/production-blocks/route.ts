import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODEL_DEFAULT } from "@/lib/ai/anthropic";
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

function isAlbornaStructure(name: string): boolean {
  return name.toLowerCase().includes("alborna");
}

const BLOCKS_FORMAT = `{
  "blocks": [
    {
      "name": "HOOK",
      "duration": "Xs",
      "lines": [
        {"tag": "CÁMARA", "text": "texto exacto de la voz en off para este momento"}
      ]
    }
  ],
  "music_a": {"name": "nombre ≤5 palabras", "why": "por qué funciona en 1-2 oraciones", "prompt": "prompt de generación ≤200 chars sin nombres de artistas o marcas"},
  "music_b": {"name": "...", "why": "...", "prompt": "..."}
}`;

const ALBORNA_BLOCKS_FORMAT = `{
  "blocks": [
    {"name": "MICRO-HISTORIA", "duration": "Xs", "lines": [{"tag": "CÁMARA", "text": "..."}]},
    {"name": "PUENTE", "duration": "Xs", "lines": [{"tag": "CÁMARA", "text": "..."}]},
    {"name": "HISTORIA REAL", "duration": "Xs", "lines": [{"tag": "B-ROLL", "text": "..."}, {"tag": "CÁMARA", "text": "..."}]},
    {"name": "LECCIÓN", "duration": "Xs", "lines": [{"tag": "CÁMARA", "text": "..."}]},
    {"name": "CIERRE", "duration": "Xs", "lines": [{"tag": "CÁMARA", "text": "..."}]}
  ],
  "music_a": {"name": "...", "why": "...", "prompt": "..."},
  "music_b": {"name": "...", "why": "...", "prompt": "..."}
}`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { script_id, voice_off } = (await req.json()) as {
      script_id: string;
      voice_off: string;
    };

    if (!script_id || !voice_off?.trim()) {
      return NextResponse.json(
        { error: "script_id y voice_off son requeridos" },
        { status: 400 }
      );
    }

    const { data: script } = await supabase
      .from("scripts")
      .select("client_id, structure_name, brief, brain_version_id")
      .eq("id", script_id)
      .eq("owner_id", user.id)
      .single();

    if (!script) return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });

    const [{ data: client }, { data: activeBrain }] = await Promise.all([
      supabase
        .from("clients")
        .select("*")
        .eq("id", script.client_id)
        .eq("owner_id", user.id)
        .single(),
      supabase
        .from("brain_versions")
        .select("id, content")
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .single(),
    ]);

    if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    const isAlborna = isAlbornaStructure(script.structure_name);
    const format = isAlborna ? ALBORNA_BLOCKS_FORMAT : BLOCKS_FORMAT;

    const userMessage = `Tienes la voz en off (teleprompter) de un Reel de Instagram ya pulida por el creador. Tu tarea es generar el guión de producción técnico: los bloques narrativos con sus líneas de dirección visual y audio.

VOZ EN OFF:
${voice_off.trim()}

ESTRUCTURA NARRATIVA: ${script.structure_name}
BRIEF ORIGINAL: ${script.brief}

REGLAS:
- Divide la voz en off en bloques según la estructura (HOOK, PROBLEMA, SOLUCIÓN, CTA, etc.)
- Cada línea debe corresponder exactamente a una frase o momento de la voz en off
- Tags disponibles: CÁMARA (creador hablando a cámara), B-ROLL (clip de apoyo — describe el clip en el texto), CLIP: [descripción] (material específico)
- Las duraciones de los bloques deben sumar entre 30 y 60 segundos en total
- Incluye 2 recomendaciones de música (music_a para apertura ~0-30s, music_b para cierre ~30-60s)

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional). Formato exacto:
${format}`;

    let parsed;
    try {
      ({ data: parsed } = await generateJson({
        label: "production-blocks",
        userMessage,
        brainContent: activeBrain?.content ?? undefined,
        clientContext: buildClientContext(client),
        model: MODEL_DEFAULT,
        maxTokens: 4096,
      }));
    } catch (e) {
      if (e instanceof AiJsonError) {
        return NextResponse.json(
          { error: "Error al parsear respuesta de IA", raw: e.rawText },
          { status: 500 }
        );
      }
      throw e;
    }

    return NextResponse.json({
      blocks: parsed.blocks ?? [],
      music_a: parsed.music_a ?? null,
      music_b: parsed.music_b ?? null,
    });
  } catch (e) {
    console.error("[production-blocks] Error:", e);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
