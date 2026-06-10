import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function readFile(filePath: string): string {
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
  que_vende?: string | null;
  cliente_ideal?: string | null;
  nicho?: string | null;
  dolor?: string | null;
  deseo?: string | null;
  tono?: string | null;
  notas?: string | null;
};

type ResearchEntry = {
  fuente?: string | null;
  resumen: string;
};

type ProductEntry = {
  nombre: string;
  descripcion?: string | null;
  tipo: string;
};

function buildClientContext(
  clientInfo: ClientInfo,
  research: ResearchEntry[],
  products: ProductEntry[],
): string {
  const lines: string[] = [
    `CLIENTE/MARCA: ${clientInfo.nombre}${clientInfo.marca ? ` (${clientInfo.marca})` : ""}`,
  ];

  if (clientInfo.que_vende) lines.push(`Qué vende: ${clientInfo.que_vende}`);
  if (clientInfo.cliente_ideal) lines.push(`Cliente ideal: ${clientInfo.cliente_ideal}`);
  if (clientInfo.nicho) lines.push(`Nicho: ${clientInfo.nicho}`);
  if (clientInfo.dolor) lines.push(`Dolor principal del cliente: ${clientInfo.dolor}`);
  if (clientInfo.deseo) lines.push(`Deseo/aspiración del cliente: ${clientInfo.deseo}`);
  if (clientInfo.tono) lines.push(`Tono de voz: ${clientInfo.tono}`);
  if (clientInfo.notas) lines.push(`Notas adicionales: ${clientInfo.notas}`);

  if (products.length > 0) {
    lines.push(`\nPRODUCTOS/SERVICIOS:`);
    for (const p of products) {
      lines.push(`- [${p.tipo}] ${p.nombre}${p.descripcion ? `: ${p.descripcion}` : ""}`);
    }
  }

  if (research.length > 0) {
    lines.push(`\nINVESTIGACIÓN DEL CLIENTE (insights clave):`);
    for (const r of research) {
      const fuenteLabel = r.fuente ? ` [${r.fuente}]` : "";
      lines.push(`-${fuenteLabel} ${r.resumen}`);
    }
  }

  return lines.join("\n");
}

function buildCalendarPrompt(
  period: "week" | "biweek" | "month",
  weekNumber: number | null,
  existingEntries: ExistingEntry[],
  clientInfo: ClientInfo | null,
  research: ResearchEntry[],
  products: ProductEntry[],
  knowledge: string,
  weeklyTheme: string | null,
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
    ? `\n${buildClientContext(clientInfo, research, products)}`
    : "";

  const weekContext =
    period === "week" && weekNumber
      ? `\nEsta es la Semana ${weekNumber} del mes. Genera contenido coherente con esa posición en el mes.`
      : "";

  const themeContext = weeklyTheme
    ? `\nTEMA / CONTEXTO DE LA SEMANA: "${weeklyTheme}"
INSTRUCCIÓN DE TEMA: Usa este tema como gancho y contexto para orientar el contenido. NO abandones los servicios, dolores y nicho del cliente — el tema es el vehículo, la marca es el destino. Busca ángulos creativos que conecten el tema con los problemas y soluciones reales del cliente.`
    : "";

  return `Genera un calendario de contenido para ${weeksCount} semana(s) con exactamente ${count} piezas de contenido.
${clientContext}${weekContext}${themeContext}

INSTRUCCIÓN CRÍTICA: Todo el contenido debe surgir del cliente específico descrito arriba —
su negocio, sus servicios, el dolor de su cliente ideal, su nicho. No generes contenido genérico
sobre crecimiento en Instagram. Cada pieza debe poder publicarse directamente en la cuenta
de este cliente sin sentirse fuera de lugar.

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
${knowledge.slice(0, 2000)}

Para cada pieza genera:
- title: título atractivo/gancho específico al cliente (máximo 80 caracteres)
- brief: descripción del ángulo, gancho y desarrollo (2-3 oraciones). Debe ser específico al cliente y sus servicios.
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
      weekly_theme?: string | null;
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

    // Load client info, research, and products if client selected
    let clientInfo: ClientInfo | null = null;
    let research: ResearchEntry[] = [];
    let products: ProductEntry[] = [];

    if (body.client_id) {
      const [clientRes, researchRes, productsRes] = await Promise.all([
        supabase
          .from("clients")
          .select("nombre, marca, que_vende, cliente_ideal, nicho, dolor, deseo, tono, notas")
          .eq("id", body.client_id)
          .eq("owner_id", user.id)
          .single(),
        supabase
          .from("client_research")
          .select("fuente, resumen")
          .eq("client_id", body.client_id)
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("client_products")
          .select("nombre, descripcion, tipo")
          .eq("client_id", body.client_id)
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true }),
      ]);

      if (clientRes.data) clientInfo = clientRes.data as ClientInfo;
      if (researchRes.data) research = researchRes.data as ResearchEntry[];
      if (productsRes.data) products = productsRes.data as ProductEntry[];
    }

    const knowledge = readFile(
      "knowledge/como-conseguir-100k-seguidores-metodo-cientifico.md",
    );

    // Load brain system prompt
    const brainPrompt = readFile("brain/system-prompt.md");
    const systemPrompt = brainPrompt
      ? `${brainPrompt}\n\n---\n\nPara esta tarea específica eres un estratega de contenido. Conoces profundamente los pilares: ${PILLARS.join(", ")}. Siempre devuelves JSON válido. No agregas explicaciones fuera del JSON.`
      : `Eres un estratega experto en contenido para redes sociales. Conoces profundamente los pilares de contenido: ${PILLARS.join(", ")}. Siempre devuelves JSON válido. No agregas explicaciones fuera del JSON.`;

    const userMessage = buildCalendarPrompt(
      body.period,
      body.week_number ?? null,
      (existingEntries ?? []) as ExistingEntry[],
      clientInfo,
      research,
      products,
      knowledge,
      body.weekly_theme ?? null,
    );

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
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
