import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODEL_FAST } from "@/lib/ai/anthropic";
import { AiJsonError, generateJson } from "@/lib/ai/json";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { script_id, script_content } = (await req.json()) as {
      script_id: string;
      script_content: string;
    };

    if (!script_id || !script_content?.trim()) {
      return NextResponse.json(
        { error: "script_id y script_content son requeridos" },
        { status: 400 }
      );
    }

    const { data: script } = await supabase
      .from("scripts")
      .select("brief, structure_name, type, client_id")
      .eq("id", script_id)
      .eq("owner_id", user.id)
      .single();

    if (!script) return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });

    // Fetch up to 40 hooks from the user's baúl
    const { data: vaultHooks } = await supabase
      .from("hooks")
      .select("id, hook_template, category")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40);

    const hooksText =
      (vaultHooks ?? [])
        .map((h, i) => `${i + 1}. [${h.category ?? "general"}] ${h.hook_template} (id: ${h.id})`)
        .join("\n") || "No hay ganchos en el baúl todavía.";

    const userMessage = `Analiza el siguiente guion de ${script.type === "reel" ? "Reel" : "Carrusel"} de Instagram y recomienda los 5 ganchos más relevantes del baúl para usarlo como apertura del video.

BRIEF: ${script.brief}
ESTRUCTURA: ${script.structure_name}

CONTENIDO DEL GUION:
${script_content.trim()}

GANCHOS DISPONIBLES EN EL BAÚL:
${hooksText}

INSTRUCCIONES:
- Elige los 5 más relevantes para este guion específico
- Si no hay suficientes relevantes en el baúl, puedes sugerir hasta 2 ganchos libres (sin id, con hook_id: null)
- Para ganchos del baúl, incluye el id exacto tal como aparece
- La razón debe ser concisa (1 oración) y específica para este guion

Responde ÚNICAMENTE con JSON válido (sin markdown). Formato exacto:
[
  {"hook_id": "uuid-del-baul-o-null", "hook_text": "texto adaptado del gancho para este guion", "razon": "por qué encaja aquí"}
]`;

    let suggestions: { hook_id: string | null; hook_text: string; razon: string }[];
    try {
      ({ data: suggestions } = await generateJson<
        { hook_id: string | null; hook_text: string; razon: string }[]
      >({
        label: "suggest-hooks",
        userMessage,
        model: MODEL_FAST,
        maxTokens: 1024,
      }));
    } catch (e) {
      if (e instanceof AiJsonError) {
        return NextResponse.json(
          { error: "Error al parsear respuesta de IA", raw: e.rawText },
          { status: 500 }
        );
      }
      throw e;
    }

    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("[suggest-hooks] Error:", e);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
