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

const SYSTEM_PROMPT = `Eres un experto en diseño de portadas de alto CTR para Reels y carruseles de Instagram.
Dominas neurociencia del scroll, copywriting de hooks y especificaciones técnicas de generadores de imagen IA (Flux, Midjourney, GPT-Image, Stable Diffusion).

Recibirás una guía de referencia sobre qué hace que una portada tenga alto CTR (safe zones, contraste, rostro vs. tipografía, regla de las 6 palabras, fórmulas de hook) y el contenido de un guion de Reel o carrusel.

Tu tarea: proponer EXACTAMENTE 3 conceptos de portada distintos entre sí, directamente relacionados con el contenido del guion, siguiendo la estructura de prompt:
[medium], [subject], [action/pose], [environment], [style/vibe], [technical specs]

Regla dura sobre personajes: de las 3 portadas, EXACTAMENTE 1 o 2 (nunca 0, nunca 3) deben incluir una referencia a colocar un personaje/rostro humano en la portada (con emoción extrema y clara, según la guía). El resto debe ser diseño tipográfico/color-block limpio, sin personaje.

Cada concepto debe traer también un "cover_text" (el texto que iría sobreimpreso en la portada, siguiendo la regla de las 6 palabras y alguna fórmula de hook de la guía) y una "rationale_es" breve (1-2 oraciones) explicando por qué esa portada es de alto CTR para este contenido específico.

Siempre devuelves un JSON válido. El prompt_en debe estar en inglés, listo para pegar en cualquier generador de imágenes. cover_text y rationale_es en español latinoamericano.`;

type CoverIdea = {
  has_character: boolean;
  medium: string;
  subject: string;
  action: string;
  environment: string;
  style_vibe: string;
  technical_specs: string;
  prompt_en: string;
  cover_text: string;
  rationale_es: string;
};

function buildUserMessage(
  scriptType: string,
  brief: string,
  structureName: string,
  contentSummary: string,
  knowledge: string,
) {
  return `GUÍA DE REFERENCIA — QUÉ HACE UNA PORTADA DE ALTO CTR:
${knowledge}

---

GUION A CUBRIR:
Tipo: ${scriptType === "reel" ? "Reel (formato 9:16 vertical)" : "Carrusel (primera diapositiva, formato 4:5)"}
Estructura narrativa: ${structureName}
Brief: ${brief}

Contenido del guion:
${contentSummary}

---

Genera EXACTAMENTE 3 conceptos de portada para este contenido, relacionados directamente con él, siguiendo la estructura [medium], [subject], [action/pose], [environment], [style/vibe], [technical specs]. Recuerda: 1 o 2 (no 0, no 3) deben tener personaje/rostro humano.

Devuelve ÚNICAMENTE este JSON (sin markdown, sin explicaciones), un array de 3 objetos:
[
  {
    "has_character": true o false,
    "medium": "...",
    "subject": "...",
    "action": "...",
    "environment": "...",
    "style_vibe": "...",
    "technical_specs": "...",
    "prompt_en": "el prompt completo en inglés ensamblando los 6 campos anteriores, listo para pegar en un generador de imágenes",
    "cover_text": "texto corto sugerido para sobreimprimir en la portada (5-6 palabras, en español)",
    "rationale_es": "por qué esta portada es de alto CTR para este contenido específico"
  }
]`;
}

function summarizeContent(scriptType: string, content: Record<string, unknown>): string {
  if (scriptType === "reel") {
    const voiceOff = typeof content.voice_off === "string" ? content.voice_off : "";
    return voiceOff.slice(0, 2000);
  }
  const slides = Array.isArray(content.slides) ? content.slides : [];
  return slides
    .map((s: unknown) => {
      const slide = s as { number?: number; text?: string; body?: string };
      return `Slide ${slide.number ?? "?"}: ${slide.text ?? ""}${slide.body ? ` — ${slide.body}` : ""}`;
    })
    .join("\n")
    .slice(0, 2000);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as {
      script_type: string;
      brief: string;
      structure_name: string;
      content: Record<string, unknown>;
    };

    if (!body.content || !body.script_type) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const knowledge = readKnowledge("knowledge/portadas-reels-carruseles-alto-ctr.md");
    const contentSummary = summarizeContent(body.script_type, body.content);
    const userMessage = buildUserMessage(
      body.script_type,
      body.brief ?? "",
      body.structure_name ?? "",
      contentSummary,
      knowledge,
    );

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText =
      response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("") ?? "";

    let covers: CoverIdea[];
    try {
      covers = JSON.parse(rawText.trim());
    } catch {
      const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        covers = JSON.parse(match[1].trim());
      } else {
        return NextResponse.json({ error: "IA no devolvió JSON válido" }, { status: 500 });
      }
    }

    if (!Array.isArray(covers) || covers.length !== 3) {
      return NextResponse.json({ error: "La IA no devolvió exactamente 3 portadas" }, { status: 500 });
    }

    return NextResponse.json({ covers });
  } catch (err) {
    console.error("[cover API]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
