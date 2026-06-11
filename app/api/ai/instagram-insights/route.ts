import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWithBrain, MODEL_QUALITY } from "@/lib/ai/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Forma mínima que el dashboard manda por post (recortada para ahorrar tokens). */
type PostPayload = {
  caption?: string;
  media_type?: string;
  timestamp?: string;
  permalink?: string;
  insights?: Record<string, number>;
  /** Reservado para Etapa transcripción (faster-whisper). Hoy llega vacío. */
  transcript?: string;
};

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

/** Tasa de engagement aproximada para rankear (interacciones / alcance). */
function engagementScore(i: Record<string, number> = {}): number {
  const interactions =
    (i.likes ?? 0) + (i.comments ?? 0) + (i.shares ?? 0) + (i.saved ?? 0);
  const base = i.reach ?? i.views ?? 0;
  return base > 0 ? interactions / base : interactions;
}

function renderPost(p: PostPayload, i: number): string {
  const ins = p.insights ?? {};
  const date = p.timestamp ? p.timestamp.slice(0, 10) : "?";
  const metrics = [
    ins.reach != null && `alcance ${ins.reach}`,
    ins.views != null && `vistas ${ins.views}`,
    ins.likes != null && `likes ${ins.likes}`,
    ins.comments != null && `comentarios ${ins.comments}`,
    ins.shares != null && `compartidos ${ins.shares}`,
    ins.saved != null && `guardados ${ins.saved}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const caption = (p.caption ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
  const lines = [
    `### Post ${i + 1} — ${p.media_type ?? "?"} — ${date} — eng ${engagementScore(ins).toFixed(3)}`,
    `Métricas: ${metrics || "sin datos"}`,
    caption ? `Caption: ${caption}` : `Caption: (sin texto)`,
  ];
  if (p.transcript?.trim()) lines.push(`Transcripción: ${p.transcript.trim().slice(0, 1200)}`);
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { posts, client_id } = (await req.json()) as {
      posts: PostPayload[];
      client_id?: string | null;
    };

    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json(
        { error: "No hay posts para analizar." },
        { status: 400 },
      );
    }

    // Contexto de cliente (opcional): hace las ideas específicas a su nicho/audiencia.
    let clientContext: string | undefined;
    if (client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("*")
        .eq("id", client_id)
        .eq("owner_id", user.id)
        .single();
      if (client) clientContext = buildClientContext(client);
    }

    // Rankeamos por engagement y mandamos top 20 + bottom 5 para contraste.
    const ranked = [...posts].sort(
      (a, b) => engagementScore(b.insights) - engagementScore(a.insights),
    );
    const top = ranked.slice(0, 20);
    const bottom = ranked.length > 25 ? ranked.slice(-5) : [];

    const userMessage = `Eres analista de contenido de Instagram. Abajo están los posts publicados de esta cuenta con sus métricas reales (rankeados por tasa de engagement). Tu trabajo es entender QUÉ está funcionando y POR QUÉ, y proponer ideas accionables.

## Mejores posts (mayor engagement)
${top.map(renderPost).join("\n\n")}
${
  bottom.length
    ? `\n## Posts de menor rendimiento (para contraste)\n${bottom.map(renderPost).join("\n\n")}`
    : ""
}

Analiza patrones reales basados en la evidencia (ganchos, temas, formatos, longitud, tono, llamados a la acción). No inventes métricas que no estén arriba. Cuando afirmes un patrón, cita posts o métricas concretas como evidencia.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional):
{
  "resumen": "1-2 frases: qué está funcionando en esta cuenta ahora mismo",
  "patrones": [
    { "titulo": "patrón corto", "porque": "por qué funciona, con evidencia (posts/métricas)" }
  ],
  "ideas": [
    { "titulo": "idea de contenido", "gancho": "primera línea / hook concreto", "formato": "Reel" | "Carrusel", "porque": "por qué encaja con lo que ya funciona" }
  ]
}

Da entre 3 y 5 patrones y entre 4 y 6 ideas. Español latinoamericano, tuteo.`;

    const result = await generateWithBrain({
      userMessage,
      clientContext,
      model: MODEL_QUALITY,
      maxTokens: 2500,
    });

    let parsed;
    try {
      const cleaned = result.text
        .replace(/^```(?:json)?\n?/m, "")
        .replace(/\n?```$/m, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Error al parsear respuesta de IA", raw: result.text },
        { status: 500 },
      );
    }

    return NextResponse.json(parsed);
  } catch (e) {
    console.error("[instagram-insights] Error:", e);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
