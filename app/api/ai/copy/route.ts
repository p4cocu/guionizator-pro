import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const COPY_SYSTEM = `Eres un experto en copywriting para redes sociales en español latinoamericano.
Tu tarea es transformar guiones de video/carrusel en copies optimizados para publicaciones en redes sociales.
Escribes en español latinoamericano, tuteo, sin tecnicismos innecesarios.
Siempre devuelves un JSON válido con la estructura indicada.`;

function buildPrompt(
  platform: string,
  scriptContent: Record<string, unknown>,
  scriptType: string,
) {
  const contentStr = JSON.stringify(scriptContent, null, 2);

  if (platform === "instagram") {
    return `Crea el copy para Instagram de este ${scriptType === "reel" ? "Reel" : "Carrusel"}.

GUION:
${contentStr}

El copy de Instagram debe:
- Tener un gancho en la primera línea (máximo 2 oraciones antes del "más")
- Cuerpo de 120-280 palabras que desarrolla el tema con valor real
- CTA claro al final
- Emojis estratégicos (no exagerados, 3-6 por copy)
- De 15 a 20 hashtags relevantes (mezcla nicho específico + amplio + marca)
- Tono conversacional y auténtico

Devuelve ÚNICAMENTE este JSON (sin markdown, sin explicaciones):
{"copy": "texto completo del copy con emojis y saltos de línea", "hashtags": "#hashtag1 #hashtag2 ... (todos los hashtags en una línea)"}`;
  }

  if (platform === "linkedin") {
    return `Crea el copy para LinkedIn de este ${scriptType === "reel" ? "video" : "carrusel"}.

GUION:
${contentStr}

El copy de LinkedIn debe:
- Gancho en la primera línea (frase directa, no clickbait)
- Storytelling profesional de 200-380 palabras
- Estructura con párrafos cortos (1-3 oraciones máximo por párrafo)
- Sin emojis excesivos (máximo 2-3 si aportan)
- CTA orientado a conversación o conexión profesional
- De 3 a 5 hashtags al final

Devuelve ÚNICAMENTE este JSON (sin markdown, sin explicaciones):
{"copy": "texto completo del copy con saltos de línea", "hashtags": "#hashtag1 #hashtag2 #hashtag3"}`;
  }

  return `Crea el copy para ${platform} del siguiente guion:
${contentStr}
Devuelve JSON: {"copy": "...", "hashtags": "..."}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { script_content, script_type, platform } = (await req.json()) as {
      script_content: Record<string, unknown>;
      script_type: string;
      platform: string;
    };

    if (!script_content || !platform) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const userPrompt = buildPrompt(platform, script_content, script_type);

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: COPY_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText =
      response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("") ?? "";

    let result: { copy: string; hashtags: string };
    try {
      result = JSON.parse(rawText.trim());
    } catch {
      const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        result = JSON.parse(match[1].trim());
      } else {
        return NextResponse.json({ error: "IA no devolvió JSON válido" }, { status: 500 });
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[copy API]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
