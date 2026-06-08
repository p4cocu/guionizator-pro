import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWithBrain, MODEL_DEFAULT } from "@/lib/ai/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action, message, clientContext, model, content, instruction, type } =
    body as {
      action?: string;
      message?: string;
      clientContext?: string;
      model?: string;
      content?: Record<string, unknown>;
      instruction?: string;
      type?: string;
    };

  // Obtener brain activo del usuario; si no tiene, usar el del archivo
  const { data: activeBrain } = await supabase
    .from("brain_versions")
    .select("content")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .single();

  // ── Edición de guion por IA ──────────────────────────────────────────────
  if (action === "edit_script") {
    if (!instruction?.trim()) {
      return NextResponse.json(
        { error: "instruction is required" },
        { status: 400 }
      );
    }
    if (!content) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    const userMessage = `INSTRUCCIÓN DE EDICIÓN:
${instruction}

GUION ACTUAL (JSON — tipo: ${type ?? "reel"}):
${JSON.stringify(content, null, 2)}

Aplica el cambio indicado y devuelve ÚNICAMENTE el JSON actualizado del guion. Sin explicaciones, sin markdown, solo el JSON puro con exactamente la misma estructura.`;

    const result = await generateWithBrain({
      userMessage,
      brainContent: activeBrain?.content ?? undefined,
      model: model ?? MODEL_DEFAULT,
      maxTokens: 4096,
    });

    // Extraer JSON de la respuesta (puede venir con o sin bloques ```json```)
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(result.text.trim());
    } catch {
      const match = result.text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        parsed = JSON.parse(match[1].trim());
      } else {
        return NextResponse.json(
          { error: "La IA no devolvió un JSON válido" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      content: parsed,
      usage: {
        input: result.inputTokens,
        output: result.outputTokens,
        cacheRead: result.cacheReadTokens,
        cacheCreation: result.cacheCreationTokens,
      },
    });
  }

  // ── Generación estándar ──────────────────────────────────────────────────
  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const result = await generateWithBrain({
    userMessage: message,
    brainContent: activeBrain?.content ?? undefined,
    clientContext,
    model: model ?? MODEL_DEFAULT,
  });

  return NextResponse.json({
    text: result.text,
    usage: {
      input: result.inputTokens,
      output: result.outputTokens,
      cacheRead: result.cacheReadTokens,
      cacheCreation: result.cacheCreationTokens,
    },
  });
}
