import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiJsonError, generateJsonPlain } from "@/lib/ai/json";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Eres un director creativo especialista en producción de videos cortos (Reels de Instagram).
Tu tarea es analizar la voz en off de un guion y proponer ideas visuales específicas para cada escena.
Las ideas deben ser concretas, visuales y filmables. Piensa en términos de encuadre, acción, metáfora visual o recurso cinematográfico.
Siempre devuelves JSON válido sin explicaciones adicionales.`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as {
      voice_off: string;
      script_title?: string;
      regenerate_index?: number;
      existing_scenes?: { voice_segment: string; scene_idea: string; scene_description: string }[];
    };

    const isRegenerate = body.regenerate_index !== undefined && body.existing_scenes;

    let userMessage: string;

    if (isRegenerate && body.existing_scenes) {
      const scene = body.existing_scenes[body.regenerate_index!];
      userMessage = `Regenera UNA SOLA idea de escena diferente para este fragmento de voz en off:

FRAGMENTO: "${scene.voice_segment}"

La idea anterior era: "${scene.scene_idea}" — "${scene.scene_description}"
Propón algo DIFERENTE y creativo.

Devuelve ÚNICAMENTE este JSON:
{
  "scene_idea": "idea visual muy breve (máximo 10 palabras)",
  "scene_description": "descripción detallada de la escena para el prompt de imagen (2-3 oraciones: qué se ve, ángulo de cámara, ambiente, acción)"
}`;
    } else {
      userMessage = `Analiza esta voz en off de un Reel y divide el texto en escenas lógicas (entre 4 y 8 escenas).
Para cada escena, propón una idea visual específica y filmable.

GUION: "${body.script_title ?? "Reel"}"

VOZ EN OFF:
${body.voice_off}

Instrucciones:
- Divide el texto en fragmentos lógicos (oraciones o grupos de oraciones relacionadas)
- Para cada fragmento: propón una idea visual concreta que refuerce o contraste con lo que se dice
- Las ideas deben ser variadas: close-ups, planos generales, metáforas visuales, b-roll, animaciones de texto, etc.
- Piensa en qué imagen generada por IA quedaría bien en cada momento

Devuelve ÚNICAMENTE este JSON:
{
  "scenes": [
    {
      "voice_segment": "fragmento exacto del texto de voz en off",
      "scene_idea": "idea visual muy breve (máximo 10 palabras)",
      "scene_description": "descripción detallada de la escena para generar el prompt de imagen (2-3 oraciones: qué se ve, ángulo de cámara, ambiente, acción)"
    }
  ]
}`;
    }

    let result: unknown;
    try {
      result = await generateJsonPlain({
        label: "scene-ideas",
        model: "claude-sonnet-4-6",
        maxTokens: 2048,
        system: SYSTEM_PROMPT,
        userMessage,
      });
    } catch (e) {
      if (e instanceof AiJsonError) {
        return NextResponse.json({ error: "IA no devolvió JSON válido" }, { status: 500 });
      }
      throw e;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[scene-ideas API]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
