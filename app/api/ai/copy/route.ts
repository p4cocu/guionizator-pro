import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiJsonError, generateJsonPlain } from "@/lib/ai/json";
import { buildClientContext } from "@/lib/ai/clientContext";
import {
  buildCopyPrompt,
  COPY_SYSTEM,
  isCopyPlatform,
  normalizeCopyResult,
  summarizeScriptContent,
  type CopyReference,
} from "@/lib/ai/copyPrompt";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Copy de una publicación, en DOS versiones (corta y desarrollada).
 *
 * El prompt vive en `lib/ai/copyPrompt.ts` y lo comparte con el portal — ver la
 * nota de ese archivo sobre por qué se dejó de duplicar.
 *
 * Tres entradas al prompt, y las tres importan:
 *   1. el contenido de la pieza (voz en off o slides),
 *   2. el perfil de la MARCA, para que el copy hable de su proyecto y no salga
 *      genérico,
 *   3. si el guion tiene `source_post_id`, el post de competencia que lo
 *      inspiró — SOLO como referencia de ángulo y ritmo (la regla dura contra
 *      copiar sus datos va dentro del prompt, pegada al texto ajeno).
 *
 * Como en `/api/ai/cover` (etapa 8), el contenido se lee de la base filtrando
 * `owner_id`: el body solo trae el id y la plataforma.
 */
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
    if (!isCopyPlatform(platform)) {
      return NextResponse.json(
        { error: `Todavía no hay copy para ${platform}.` },
        { status: 400 },
      );
    }

    const { data: script } = await supabase
      .from("scripts")
      .select("type, title, brief, content, client_id, source_post_id, is_external")
      .eq("id", script_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!script) {
      return NextResponse.json({ error: "Ese guion no existe o no es tuyo." }, { status: 404 });
    }

    const scriptType = (script.type as string | null) ?? "reel";

    // Perfil de la marca. Si falla la lectura, se genera igual (sin contexto) en
    // vez de romper: un copy genérico es peor que uno afinado, pero mucho mejor
    // que un error en la cara.
    const { data: client } = await supabase
      .from("clients")
      .select("nombre, marca, que_vende, cliente_ideal, nicho, dolor, deseo, tono, notas")
      .eq("id", script.client_id as string)
      .eq("owner_id", user.id)
      .maybeSingle();

    // La referencia de competencia, cuando el guion nació de un post ajeno
    // (`source_post_id`, migración 0002) o cuando Paco lo eligió a mano al
    // registrar una publicación externa.
    let reference: CopyReference | null = null;
    if (script.source_post_id) {
      const { data: post } = await supabase
        .from("competitor_posts")
        .select("username, caption, transcription")
        .eq("id", script.source_post_id as string)
        .eq("owner_id", user.id)
        .maybeSingle();
      if (post) {
        reference = {
          username: (post.username as string | null) ?? null,
          caption: (post.caption as string | null) ?? null,
          transcript: (post.transcription as string | null) ?? null,
        };
      }
    }

    const userPrompt = buildCopyPrompt({
      platform,
      scriptType,
      contentSummary: summarizeScriptContent(
        scriptType,
        (script.content as Record<string, unknown> | null) ?? {},
      ),
      brief: script.brief as string | null,
      title: script.title as string | null,
      brandContext: client ? buildClientContext(client) : null,
      reference,
      isExternal: script.is_external === true,
    });

    let result;
    try {
      const raw = await generateJsonPlain<{
        copy_short?: string;
        copy_long?: string;
        copy?: string;
        hashtags?: string;
      }>({
        label: "copy",
        model: "claude-haiku-4-5-20251001",
        // Dos versiones en la misma respuesta: 1024 tokens se quedaban cortos y
        // el corte por `max_tokens` dispara el reintento de `lib/ai/json.ts`,
        // que es justo lo que hay que evitar cerca del límite de Netlify.
        maxTokens: 2048,
        system: COPY_SYSTEM,
        userMessage: userPrompt,
      });
      result = normalizeCopyResult(raw);
    } catch (e) {
      if (e instanceof AiJsonError) {
        return NextResponse.json({ error: "IA no devolvió JSON válido" }, { status: 500 });
      }
      throw e;
    }

    return NextResponse.json({
      ...result,
      // `copy` se mantiene por compatibilidad con cualquier cliente viejo que
      // todavía lea el formato de una sola versión.
      copy: result.copy_long,
      used_reference: reference !== null,
    });
  } catch (err) {
    console.error("[copy API]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 },
    );
  }
}
