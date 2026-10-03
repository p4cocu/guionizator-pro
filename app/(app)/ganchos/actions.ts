"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MODEL_FAST } from "@/lib/ai/anthropic";
import { AiJsonError, generateJsonPlain } from "@/lib/ai/json";
import { buildClientContext } from "@/lib/ai/clientContext";
import { type HookReview } from "@/lib/hooks/prompts";
import { runHookReview } from "@/lib/hooks/run";

export type HookCategory =
  | "pregunta_impactante"
  | "dato_sorpresa"
  | "historia_personal"
  | "afirmacion_contrarian"
  | "promesa_resultado"
  | "miedo_o_problema"
  | "curiosidad";

export type Hook = {
  id: string;
  source_post_id: string | null;
  source_username: string | null;
  source_permalink: string | null;
  hook_original: string;
  hook_template: string;
  category: string | null;
  created_at: string;
};

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

// ── Extracción con Claude ─────────────────────────────────────────────────────

export type ExtractResult =
  | { ok: true; hook_original: string; hook_template: string; category: string }
  | { ok: false; error: string };

export async function extractHook(transcription: string): Promise<ExtractResult> {
  if (!transcription.trim()) {
    return { ok: false, error: "La transcripción está vacía." };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "Falta ANTHROPIC_API_KEY." };
  }

  const userMessage = `Eres experto en hooks de video para Instagram Reels en español latinoamericano.

Analiza esta transcripción y extrae el gancho de apertura (primeras 1-3 oraciones, máx 5 segundos).

Categorías válidas: pregunta_impactante, dato_sorpresa, historia_personal, afirmacion_contrarian, promesa_resultado, miedo_o_problema, curiosidad

Devuelve ÚNICAMENTE este JSON (sin markdown, sin explicaciones):
{
  "hook_original": "el gancho exacto del video",
  "category": "una_categoria_valida",
  "hook_template": "el gancho como plantilla con [PLACEHOLDERS] en mayúsculas donde va el contenido específico"
}

Ejemplo de plantilla: "¿Sabías que [PORCENTAJE]% de [AUDIENCIA] nunca [ACCIÓN]? Esto cambia todo."

TRANSCRIPCIÓN:
${transcription.slice(0, 3000)}`;

  try {
    const parsed = await generateJsonPlain<{
      hook_original: string;
      category: string;
      hook_template: string;
    }>({
      label: "extract-hook",
      model: MODEL_FAST,
      maxTokens: 1024,
      userMessage,
    });
    return {
      ok: true,
      hook_original: parsed.hook_original?.trim() ?? "",
      category: parsed.category?.trim() ?? "curiosidad",
      hook_template: parsed.hook_template?.trim() ?? "",
    };
  } catch (e) {
    if (e instanceof AiJsonError) {
      return { ok: false, error: "Claude no devolvió un formato válido. Intenta de nuevo." };
    }
    console.error("[extract-hook] Error:", e);
    return { ok: false, error: "Error al conectar con la IA. Intenta de nuevo." };
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export type SaveHookInput = {
  source_post_id?: string | null;
  source_username?: string | null;
  source_permalink?: string | null;
  hook_original: string;
  hook_template: string;
  category?: string | null;
};

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveHook(input: SaveHookInput): Promise<SaveResult> {
  const { supabase, user } = await getAuthUser();

  const { data, error } = await supabase
    .from("hooks")
    .insert({
      owner_id: user.id,
      source_post_id: input.source_post_id ?? null,
      source_username: input.source_username ?? null,
      source_permalink: input.source_permalink ?? null,
      hook_original: input.hook_original.trim(),
      hook_template: input.hook_template.trim(),
      category: input.category ?? null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/ganchos");
  return { ok: true, id: data.id as string };
}

export async function updateHookTemplate(id: string, template: string): Promise<void> {
  const { supabase, user } = await getAuthUser();
  await supabase
    .from("hooks")
    .update({ hook_template: template.trim() })
    .eq("id", id)
    .eq("owner_id", user.id);
  revalidatePath("/ganchos");
}

export async function deleteHook(id: string): Promise<void> {
  const { supabase, user } = await getAuthUser();
  await supabase.from("hooks").delete().eq("id", id).eq("owner_id", user.id);
  revalidatePath("/ganchos");
}

export async function getHooks(): Promise<Hook[]> {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("hooks")
    .select("id, source_post_id, source_username, source_permalink, hook_original, hook_template, category, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  return (data ?? []) as Hook[];
}

// ── Revisor de ganchos (0018) ────────────────────────────────────────────────

export type ReviewHookInput = {
  verbal: string;
  text_overlay?: string | null;
  visual?: string | null;
  context?: string | null;
  client_id?: string | null;
};

export type ReviewHookResult = { ok: true; review: HookReview } | { ok: false; error: string };

/**
 * Califica un gancho escrito a mano con los 7 criterios de Andrea y propone una
 * versión de 3 capas. No guarda nada: guardar en el baúl es un paso aparte.
 * `MODEL_FAST` (~6s medido).
 */
export async function reviewHook(input: ReviewHookInput): Promise<ReviewHookResult> {
  const verbal = input.verbal.trim().slice(0, 500);
  const textOverlay = input.text_overlay?.trim().slice(0, 300) || null;
  if (!verbal && !textOverlay) return { ok: false, error: "Escribe al menos la frase o el texto en pantalla." };

  try {
    const { supabase, user } = await getAuthUser();
    let brandContext: string | null = null;
    if (input.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("nombre, marca, que_vende, cliente_ideal, nicho, dolor, deseo, tono, notas")
        .eq("id", input.client_id)
        .eq("owner_id", user.id)
        .maybeSingle();
      if (client) brandContext = buildClientContext(client);
    }

    const review = await runHookReview({
      brandContext,
      verbal,
      textOverlay,
      visual: input.visual?.trim().slice(0, 500) || null,
      context: input.context?.trim().slice(0, 2000) || null,
    });
    if (!review) return { ok: false, error: "La IA no devolvió una revisión válida. Intenta de nuevo." };
    return { ok: true, review };
  } catch (e) {
    if (e instanceof AiJsonError) return { ok: false, error: "La IA no devolvió una revisión válida. Intenta de nuevo." };
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo revisar el gancho." };
  }
}
