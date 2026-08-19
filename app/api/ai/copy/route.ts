import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiJsonError, generateJsonPlain } from "@/lib/ai/json";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    const { script_id, platform } = (await req.json()) as {
      script_id?: string;
      platform?: string;
    };

    if (!script_id || !platform) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Igual que en `/api/ai/cover` (etapa 8): el contenido sale de la base
    // filtrando `owner_id`, no del body. Una ruta que solo pide sesión y
    // acepta el texto que le manden es una canilla de tokens abierta.
    const { data: script } = await supabase
      .from("scripts")
      .select("type, content")
      .eq("id", script_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!script) {
      return NextResponse.json({ error: "Ese guion no existe o no es tuyo." }, { status: 404 });
    }

    const userPrompt = buildPrompt(
      platform,
      (script.content as Record<string, unknown> | null) ?? {},
      (script.type as string | null) ?? "reel",
    );

    let result: { copy: string; hashtags: string };
    try {
      result = await generateJsonPlain<{ copy: string; hashtags: string }>({
        label: "copy",
        model: "claude-haiku-4-5-20251001",
        maxTokens: 1024,
        system: COPY_SYSTEM,
        userMessage: userPrompt,
      });
    } catch (e) {
      if (e instanceof AiJsonError) {
        return NextResponse.json({ error: "IA no devolvió JSON válido" }, { status: 500 });
      }
      throw e;
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
