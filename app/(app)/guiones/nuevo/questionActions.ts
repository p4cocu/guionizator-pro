"use server";

import { createClient } from "@/lib/supabase/server";
import { MODEL_FAST } from "@/lib/ai/anthropic";
import { AiJsonError, generateJsonPlain } from "@/lib/ai/json";
import { buildClientContext } from "@/lib/ai/clientContext";
import { isCopyPlatform } from "@/lib/ai/copyPrompt";
import {
  COPY_QUESTIONS_SYSTEM,
  buildCopyQuestionsPrompt,
  normalizeCopyQuestions,
  type CopyQuestion,
} from "@/lib/ai/copyQuestions";

/**
 * Las 1-2 preguntas opcionales del formulario "Ya grabé el video".
 *
 * Va con `MODEL_FAST` y un presupuesto de tokens chico a propósito: corre
 * dentro de la Netlify Function, que se muere a los ~26-30s, y el usuario está
 * esperando con el cursor en el formulario. Con Sonnet este tipo de llamada
 * síncrona ya dio 504 antes (ver el comentario de `/api/ai/cover`).
 *
 * **Nunca lanza por culpa del modelo**: si la IA falla o devuelve algo
 * inservible se devuelve una lista vacía y el formulario sigue funcionando
 * exactamente como antes de esta mejora. Las preguntas son un plus, no un paso
 * obligatorio — por eso tampoco se guarda nada en la base acá: las respuestas
 * viajan pegadas al contexto en `createExternalPublication`.
 */
export async function suggestCopyQuestions(input: {
  client_id: string;
  type: "reel" | "carousel";
  title?: string | null;
  context: string;
  platform: string;
}): Promise<CopyQuestion[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const context = input.context.trim();
  if (!context || !input.client_id) return [];
  if (!isCopyPlatform(input.platform)) return [];

  // El perfil de la marca es lo que evita preguntas obvias ("¿a quién le
  // hablas?" cuando el cliente ideal ya está cargado). Se filtra por `owner_id`
  // porque el `client_id` viene del browser.
  const { data: client } = await supabase
    .from("clients")
    .select("nombre, marca, que_vende, cliente_ideal, nicho, dolor, deseo, tono, notas")
    .eq("id", input.client_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!client) throw new Error("Esa marca no existe o no es tuya.");

  try {
    const raw = await generateJsonPlain<{ questions?: unknown }>({
      label: "copy-questions",
      model: MODEL_FAST,
      maxTokens: 600,
      system: COPY_QUESTIONS_SYSTEM,
      userMessage: buildCopyQuestionsPrompt({
        platform: input.platform,
        scriptType: input.type,
        context,
        title: (input.title ?? "").trim() || null,
        brandContext: buildClientContext(client),
      }),
    });
    return normalizeCopyQuestions(raw);
  } catch (e) {
    // `generateJsonPlain` ya reintentó una vez. Un segundo fallo no vale
    // frenarle el formulario a nadie.
    if (e instanceof AiJsonError) return [];
    throw e;
  }
}
