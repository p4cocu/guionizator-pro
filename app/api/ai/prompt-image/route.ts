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
    const full = path.join(process.cwd(), filePath);
    return fs.readFileSync(full, "utf-8");
  } catch {
    return "";
  }
}

const SYSTEM_PROMPT = `Eres un experto en generación de prompts profesionales para IA de imágenes (Flux, Midjourney, GPT-Image, Stable Diffusion).
Tu tarea es generar prompts de alta calidad siguiendo la estructura: [medium], [subject], [action/pose], [environment], [style/vibe], [technical specs].
Siempre devuelves un JSON válido. Genera el prompt en inglés (para los generadores de imagen) y también una descripción del resultado en español.`;

function buildUserMessage(
  fields: {
    medium: string;
    subject: string;
    action: string;
    environment: string;
    style_vibe: string;
    technical_specs: string;
  },
  styleKnowledge: string,
  styleTokens?: string,
) {
  const fieldsSummary = `
- Medio: ${fields.medium || "fotografía"}
- Sujeto: ${fields.subject}
- Acción/pose: ${fields.action || "ninguna específica"}
- Entorno: ${fields.environment || "neutro"}
- Estilo/vibe: ${fields.style_vibe || "realista"}
- Specs técnicos: ${fields.technical_specs || "ninguno"}
`;

  const knowledgeSection = styleKnowledge
    ? `\n\nCONOCIMIENTO DE ESTILO (referencia técnica):\n${styleKnowledge.slice(0, 4000)}\n`
    : "";

  const customTokens = styleTokens
    ? `\n\nTOKENS Y CARACTERÍSTICAS DEL ESTILO PERSONALIZADO:\n${styleTokens}\n`
    : "";

  return `Genera un prompt profesional para imagen IA con estos parámetros:
${fieldsSummary}${knowledgeSection}${customTokens}

Sigue estrictamente la estructura: [medium], [subject], [action/pose], [environment], [style/vibe], [technical specs]

Devuelve ÚNICAMENTE este JSON (sin markdown, sin explicaciones):
{
  "prompt_en": "el prompt completo en inglés, listo para pegar en cualquier generador de imágenes",
  "description_es": "descripción del resultado visual esperado en español (2-3 oraciones)"
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
      medium: string;
      subject: string;
      action: string;
      environment: string;
      style_vibe: string;
      technical_specs: string;
      base_style: string;
      style_tokens?: string;
    };

    // Load knowledge based on base_style
    let knowledge = "";
    if (body.base_style === "realistic") {
      knowledge = readKnowledge("knowledge/visual-directions/realistic.md");
    } else if (body.base_style === "pixar") {
      knowledge = readKnowledge("knowledge/visual-directions/pixar-3d.md");
    } else if (body.base_style === "cinematic") {
      knowledge = readKnowledge("knowledge/visual-directions/cinematic.md");
    }

    const userMessage = buildUserMessage(
      {
        medium: body.medium,
        subject: body.subject,
        action: body.action,
        environment: body.environment,
        style_vibe: body.style_vibe,
        technical_specs: body.technical_specs,
      },
      knowledge,
      body.style_tokens,
    );

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText =
      response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("") ?? "";

    let result: { prompt_en: string; description_es: string };
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
    console.error("[prompt-image API]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
