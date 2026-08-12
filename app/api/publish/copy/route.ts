import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODEL_DEFAULT } from "@/lib/ai/anthropic";
import { AiJsonError, generateJson } from "@/lib/ai/json";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { clientId, scriptId, contentType, feedback } = body as {
    clientId: string;
    scriptId?: string;
    contentType: "carousel" | "reel";
    feedback?: string;
  };

  // Fetch client profile
  const { data: client } = await supabase
    .from("clients")
    .select("nombre, marca, que_vende, cliente_ideal, nicho, dolor, deseo, tono, notas")
    .eq("id", clientId)
    .eq("owner_id", user.id)
    .single();

  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  const c = client as {
    nombre: string;
    marca: string | null;
    que_vende: string | null;
    cliente_ideal: string | null;
    nicho: string | null;
    dolor: string | null;
    deseo: string | null;
    tono: string | null;
    notas: string | null;
  };

  // Fetch script if provided
  let scriptContent = "";
  if (scriptId) {
    const { data: script } = await supabase
      .from("scripts")
      .select("title, content, type, brief, structure_name")
      .eq("id", scriptId)
      .eq("owner_id", user.id)
      .single();

    if (script) {
      scriptContent = `
## Guion de referencia
Título: ${script.title ?? "Sin título"}
Tipo: ${script.type}
Estructura: ${script.structure_name}
Brief: ${script.brief}
Contenido del guion:
${JSON.stringify(script.content, null, 2)}
`;
    }
  }

  const clientContext = `
## Perfil del cliente
Nombre: ${c.nombre}
Marca: ${c.marca ?? ""}
Qué vende: ${c.que_vende ?? ""}
Cliente ideal: ${c.cliente_ideal ?? ""}
Nicho: ${c.nicho ?? ""}
Dolor que resuelve: ${c.dolor ?? ""}
Deseo que activa: ${c.deseo ?? ""}
Tono de voz: ${c.tono ?? ""}
Notas adicionales: ${c.notas ?? ""}
${scriptContent}
`.trim();

  const contentLabel = contentType === "carousel" ? "carrusel de Instagram" : "Reel de Instagram";

  const feedbackLine = feedback
    ? `\n\nEl usuario revisó el copy anterior y pide este ajuste: "${feedback}". Incorpora este feedback manteniendo la esencia.`
    : "";

  const userMessage = `Eres un experto en copywriting para Instagram. Genera el copy de publicación para un ${contentLabel} de la marca "${c.marca ?? c.nombre}".

Usa el perfil del cliente y el guion de referencia (si existe) para escribir un caption auténtico, que suene humano y conecte con el público objetivo.

Devuelve EXACTAMENTE este formato JSON (sin markdown, sin explicaciones):
{
  "caption": "El texto del caption completo, con saltos de línea donde sea natural, emojis si encajan con el tono",
  "hashtags": "#hashtag1 #hashtag2 #hashtag3 ... (máximo 15 hashtags relevantes)"
}${feedbackLine}`;

  let parsed: { caption: string; hashtags: string };
  try {
    ({ data: parsed } = await generateJson<{ caption: string; hashtags: string }>({
      label: "publish-copy",
      userMessage,
      clientContext,
      model: MODEL_DEFAULT,
      maxTokens: 1024,
    }));
  } catch (e) {
    if (e instanceof AiJsonError) {
      return NextResponse.json({ error: "Claude no devolvió JSON válido", raw: e.rawText }, { status: 500 });
    }
    throw e;
  }

  return NextResponse.json({ caption: parsed.caption, hashtags: parsed.hashtags });
}
