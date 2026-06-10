import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWithBrain, MODEL_FAST } from "@/lib/ai/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { big_idea, brief } = (await req.json()) as {
      big_idea: string;
      brief: string;
    };

    if (!big_idea?.trim() || !brief?.trim()) {
      return NextResponse.json({ error: "big_idea y brief son requeridos" }, { status: 400 });
    }

    const userMessage = `Big Idea del guion: "${big_idea.trim()}"
Brief: "${brief.trim()}"

Genera 3 micro-historias cotidianas para abrir un guion al estilo Julian Alborna.

REGLAS CRÍTICAS:
- Cada micro-historia es una situación del día a día que casi todo el mundo ha vivido (ej: quedarse en silencio en un ascensor con un desconocido, buscar las llaves en los bolsillos frente a la puerta, esperar que cargue una pantalla lenta)
- Deben conectar de forma NATURAL y ORGÁNICA (no forzada) con la Big Idea — la conexión temática debe sentirse obvia al terminar de leerla, no explicada
- Son 2 a 4 oraciones en primera persona, tono conversacional
- NO son historias complejas, son momentos simples y universales
- Cada una debe evocar una emoción diferente: curiosidad, incomodidad, nostalgia, tensión, etc.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional):
{
  "stories": [
    {"id": 1, "title": "nombre corto del momento (3-5 palabras)", "text": "la micro-historia en 2-4 oraciones"},
    {"id": 2, "title": "...", "text": "..."},
    {"id": 3, "title": "...", "text": "..."}
  ]
}`;

    const result = await generateWithBrain({
      userMessage,
      model: MODEL_FAST,
      maxTokens: 800,
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
    console.error("[micro-stories] Error:", e);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
