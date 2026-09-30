import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiJsonError, generateJsonPlain } from "@/lib/ai/json";
import { MODEL_FAST } from "@/lib/ai/anthropic";
import { loadProduct } from "@/lib/products/load";
// Prompt compartido con el portal (`lib/portal/scriptTools.ts`): una sola
// definición, así las portadas del cliente salen con el mismo criterio.
import {
  buildCoverPrompt,
  COVER_MAX_TOKENS,
  COVER_SYSTEM,
  coverProductLine,
  type CoverIdea,
} from "@/lib/ai/coverPrompt";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as { script_id?: string };

    if (!body.script_id) {
      return NextResponse.json({ error: "Missing script_id" }, { status: 400 });
    }

    // El guion se lee de la base filtrando `owner_id`, NO se acepta el
    // contenido del body (etapa 8). Antes cualquier usuario con sesión —un
    // miembro del portal incluido— podía mandar texto arbitrario y quemar
    // tokens sin pasar por ningún medidor.
    const { data: script } = await supabase
      .from("scripts")
      .select("type, brief, structure_name, content, client_id, product_id")
      .eq("id", body.script_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!script) {
      return NextResponse.json({ error: "Ese guion no existe o no es tuyo." }, { status: 404 });
    }

    // Servicio del guion (0016), en una sola línea.
    const product = await loadProduct(supabase, {
      productId: script.product_id as string | null,
      ownerId: user.id,
      clientId: script.client_id as string,
    });

    const userMessage = buildCoverPrompt({
      type: (script.type as string | null) ?? "reel",
      brief: script.brief as string | null,
      structureName: script.structure_name as string | null,
      content: (script.content as Record<string, unknown> | null) ?? {},
      productLine: coverProductLine(product),
    });

    let covers: CoverIdea[];
    try {
      covers = await generateJsonPlain<CoverIdea[]>({
        label: "cover",
        // Haiku 4.5: rápido y dentro del límite de ~26-30s de Netlify (funciones
        // síncronas). Sonnet generaba 3 conceptos + doc de conocimiento en ~30s y
        // provocaba 504 Gateway Timeout.
        model: MODEL_FAST,
        maxTokens: COVER_MAX_TOKENS,
        system: COVER_SYSTEM,
        userMessage,
      });
    } catch (e) {
      if (e instanceof AiJsonError) {
        return NextResponse.json({ error: "IA no devolvió JSON válido" }, { status: 500 });
      }
      throw e;
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
