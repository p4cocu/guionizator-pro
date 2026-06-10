import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function readKnowledge(filePath: string): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), filePath), "utf-8");
  } catch {
    return "";
  }
}

const PILLARS = [
  "Detrás de cámaras",
  "Espejo del dolor",
  "Construcción en vivo",
  "Educación sin jerga",
  "Voz del mercado",
  "CTA directo",
];

const SYSTEM_PROMPT = `Eres un estratega experto en contenido para redes sociales (Instagram y LinkedIn).
Tu especialidad es crear calendarios de contenido basados en metodología científica de crecimiento.
Conoces profundamente los pilares de contenido: ${PILLARS.join(", ")}.
Siempre devuelves JSON válido. No agregas explicaciones fuera del JSON.`;

type ExistingEntry = {
  title: string;
  format: string;
  pillar?: string | null;
  cta_type?: string | null;
  metrics_views?: number | null;
  metrics_likes?: number | null;
  metrics_saves?: number | null;
  status: string;
};

type ClientInfo = {
  nombre: string;
  marca?: string | null;
  descripcion?: string | null;
  publico_objetivo?: string | null;
  propuesta_valor?: string | null;
};

function buildCalendarPrompt(
  period: "week" | "biweek" | "month",
  weekNumber: number | null,
  existingEntries: ExistingEntry[],
  clientInfo: ClientInfo | null,
  knowledge: string,
): string {
  const count = period === "week" ? 5 : period === "biweek" ? 10 : 20;
  const weeksCount = period === "week" ? 1 : period === "biweek" ? 2 : 4;

  const publishedWithMetrics = existingEntries.filter(
    (e) => e.status === "publicado" && (e.metrics_views || e.metrics_saves),
  );
  const bestPerformers = publishedWithMetrics
    .sort((a, b) => (b.metrics_saves ?? 0) - (a.metrics_saves ?? 0))
    .slice(0, 5);

  const existingTitles = existingEntries.map((e) => e.title).join(", ");
  const bestPerformersText =
    bestPerformers.length > 0
      ? `\nPiezas con mejor rendimiento (ordenadas por guardados en IG):\n${bestPerformers.map((e) => `- "${e.title}" | ${e.format} | pilar: ${e.pillar} | vistas: ${e.metrics_views ?? 0} | guardados: ${e.metrics_saves ?? 0}`).join("\n")}`
      : "";

  const clientContext = clientInfo
    ? `\nCLIENTE/MARCA: ${clientInfo.nombre}${clientInfo.marca ? ` (${clientInfo.marca})` : ""}
${clientInfo.descripcion ? `Descripción: ${clientInfo.descripcion}` : ""}
${clientInfo.publico_objetivo ? `Público objetivo: ${clientInfo.publico_objetivo}` : ""}
${clientInfo.propuesta_valor ? `Propuesta de valor: ${clientInfo.propuesta_valor}` : ""}`
    : "";

  const weekContext =
    period === "week" && weekNumber
      ? `\nEsta es la Semana ${weekNumber} del mes. Genera contenido coherente con esa posición en el mes.`
      : "";

  return `Genera un calendario de contenido para ${weeksCount} semana(s) con exactamente ${count} piezas de contenido.
${clientContext}${weekContext}

METODOLOGÍA (aplica estrictamente):
- Mix de formatos: equilibra reels, carruseles y posts de texto
- Mix de CTAs: mayoría fríos/tibios al inicio del mes, calientes al final
- Mix de pilares: usa variedad, no repitas el mismo pilar consecutivo
- 80% viralidad/enganche + 20% valor profundo
- Progresión: el contenido debe construir narrativa a lo largo de las semanas

CONTENIDO YA EXISTENTE (NO repetir estos temas/ángulos):
${existingTitles || "Ninguno aún — es la primera generación"}
${bestPerformersText}

CONOCIMIENTO DE ESTRATEGIA:
${knowledge.slice(0, 3000)}

Para cada pieza genera:
- title: título atractivo/gancho (máximo 80 caracteres)
- brief: descripción del ángulo, gancho y desarrollo (2-3 oraciones)
- format: "reel" | "carrusel" | "post_texto" | "story"
- platforms: array con "instagram" y/o "linkedin"
- pillar: uno de [${PILLARS.map((p) => `"${p}"`).join(", ")}]
- cta_type: "frio" | "tibio" | "caliente"
- week_number: número de semana (1 a ${weeksCount})
- weekly_theme: tema general de esa semana (todos los de la misma semana comparten tema)

Devuelve ÚNICAMENTE este JSON (sin markdown, sin explicaciones):
{
  "weeks": [
    {
      "week_number": 1,
      "theme": "Tema de la semana 1",
      "entries": [
        {
          "title": "...",
          "brief": "...",
          "format": "reel",
          "platforms": ["instagram"],
          "pillar": "...",
          "cta_type": "frio",
          "week_number": 1,
          "weekly_theme": "Tema de la semana 1"
        }
      ]
    }
  ]
}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as {
      period: "week" | "biweek" | "month";
      week_number?: number | null;
      month: number;
      year: number;
      client_id?: string | null;
    };

    // Load existing entries for this month/client
    let entriesQuery = supabase
      .from("content_calendar")
      .select("title, format, pillar, cta_type, metrics_views, metrics_likes, metrics_saves, status")
      .eq("owner_id", user.id)
      .eq("month", body.month)
      .eq("year", body.year);

    if (body.client_id) entriesQuery = entriesQuery.eq("client_id", body.client_id);

    const { data: existingEntries } = await entriesQuery;

    // Load client info if provided
    let clientInfo: ClientInfo | null = null;
    if (body.client_id) {
      const { data: clientData } = await supabase
        .from("clients")
        .select("nombre, marca, descripcion, publico_objetivo, propuesta_valor")
        .eq("id", body.client_id)
        .eq("owner_id", user.id)
        .single();
      if (clientData) clientInfo = clientData as ClientInfo;
    }

    const knowledge = readKnowledge(
      "knowledge/como-conseguir-100k-seguidores-metodo-cientifico.md",
    );

    const userMessage = buildCalendarPrompt(
      body.period,
      body.week_number ?? null,
      (existingEntries ?? []) as ExistingEntry[],
      clientInfo,
      knowledge,
    );

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText =
      response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

    let result: { weeks: { week_number: number; theme: string; entries: unknown[] }[] };
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
    console.error("[calendar API]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
