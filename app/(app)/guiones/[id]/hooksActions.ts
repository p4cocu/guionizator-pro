"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AiJsonError } from "@/lib/ai/json";
import { buildClientContext } from "@/lib/ai/clientContext";
import { normalizeChecks, type HookCheck } from "@/lib/hooks/criteria";
import { type HookReview, type LayeredHook } from "@/lib/hooks/prompts";
import { runHookReview, runLayeredHooks, scriptToText } from "@/lib/hooks/run";

/**
 * `hook_text` es la capa VERBAL. Las otras dos capas (`text_overlay`, `visual`)
 * y el checklist de 7 criterios llegaron con la migración `0018` — ver
 * `lib/hooks/criteria.ts`. Un gancho viejo (solo texto) sigue funcionando: sus
 * capas nuevas quedan en null y se puede "Revisar" para completarlas.
 */
export type ScriptHook = {
  id: string;
  hook_text: string;
  hook_id: string | null;
  position: number;
  created_at: string;
  text_overlay: string | null;
  visual: string | null;
  hook_type: string | null;
  checks: HookCheck[] | null;
  why: string | null;
};

const HOOK_COLUMNS =
  "id, hook_text, hook_id, position, created_at, text_overlay, visual, hook_type, checks, why";

type HookLayers = Partial<Pick<ScriptHook, "text_overlay" | "visual" | "hook_type" | "checks" | "why">>;

function normalizeRow(row: Record<string, unknown>): ScriptHook {
  const r = row as unknown as ScriptHook;
  return { ...r, checks: Array.isArray(r.checks) ? normalizeChecks(r.checks) : null };
}

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function getScriptHooks(scriptId: string): Promise<ScriptHook[]> {
  const { supabase, user } = await getAuthUser();
  const { data, error } = await supabase
    .from("script_hooks")
    .select(HOOK_COLUMNS)
    .eq("script_id", scriptId)
    .eq("owner_id", user.id)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => normalizeRow(r as Record<string, unknown>));
}

export async function addScriptHook(
  scriptId: string,
  hookText: string,
  hookId?: string | null,
  layers: HookLayers = {},
): Promise<ScriptHook> {
  const { supabase, user } = await getAuthUser();

  const { data: existing } = await supabase
    .from("script_hooks")
    .select("position")
    .eq("script_id", scriptId)
    .eq("owner_id", user.id)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = ((existing?.[0]?.position as number) ?? -1) + 1;

  const { data, error } = await supabase
    .from("script_hooks")
    .insert({
      owner_id: user.id,
      script_id: scriptId,
      hook_text: hookText.trim(),
      hook_id: hookId ?? null,
      position: nextPosition,
      text_overlay: layers.text_overlay?.trim() || null,
      visual: layers.visual?.trim() || null,
      hook_type: layers.hook_type ?? null,
      checks: layers.checks ?? null,
      why: layers.why?.trim() || null,
    })
    .select(HOOK_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/guiones/${scriptId}`);
  return normalizeRow(data as Record<string, unknown>);
}

export async function removeScriptHook(id: string, scriptId: string): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase
    .from("script_hooks")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/guiones/${scriptId}`);
}

export async function reorderScriptHooks(
  scriptId: string,
  orderedIds: string[]
): Promise<void> {
  const { supabase, user } = await getAuthUser();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("script_hooks")
        .update({ position: index })
        .eq("id", id)
        .eq("owner_id", user.id)
    )
  );
  revalidatePath(`/guiones/${scriptId}`);
}

// ── Ganchos de 3 capas (0018) ────────────────────────────────────────────────

async function loadScriptForHooks(scriptId: string) {
  const { supabase, user } = await getAuthUser();
  const { data: script } = await supabase
    .from("scripts")
    .select("type, brief, content, client_id")
    .eq("id", scriptId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!script) throw new Error("Ese guion no existe o no es tuyo.");
  const { data: client } = await supabase
    .from("clients")
    .select("nombre, marca, que_vende, cliente_ideal, nicho, dolor, deseo, tono, notas")
    .eq("id", script.client_id as string)
    .eq("owner_id", user.id)
    .maybeSingle();
  return {
    type: (script.type as string) === "carousel" ? ("carousel" as const) : ("reel" as const),
    brief: (script.brief as string | null) ?? "",
    text: scriptToText(script.type as string, script.content),
    brandContext: client ? buildClientContext(client) : "",
  };
}

export type LayeredHooksResult = { ok: true; hooks: LayeredHook[] } | { ok: false; error: string };

/**
 * "✦ 3 ganchos de 3 capas". Propone, no guarda: el usuario elige cuál agregar.
 * `MODEL_DEFAULT` porque el gancho es lo que más pesa en el video y la salida
 * es corta (~700 tokens, medido ~12-15s) — lejos del límite de Netlify.
 */
export async function generateLayeredHooks(scriptId: string): Promise<LayeredHooksResult> {
  try {
    const s = await loadScriptForHooks(scriptId);
    if (!s.text.trim()) return { ok: false, error: "El guion está vacío: escribe el guion primero." };
    const hooks = await runLayeredHooks({ brandContext: s.brandContext, type: s.type, brief: s.brief, scriptText: s.text });
    if (hooks.length === 0) return { ok: false, error: "La IA no devolvió ganchos. Intenta de nuevo." };
    return { ok: true, hooks };
  } catch (e) {
    if (e instanceof AiJsonError) return { ok: false, error: "La IA no devolvió ganchos válidos. Intenta de nuevo." };
    return { ok: false, error: e instanceof Error ? e.message : "No se pudieron generar ganchos." };
  }
}

export type ReviewResult = { ok: true; review: HookReview } | { ok: false; error: string };

/** "Revisar": califica un gancho ya agregado y guarda su checklist. */
export async function reviewScriptHook(hookId: string, scriptId: string): Promise<ReviewResult> {
  try {
    const { supabase, user } = await getAuthUser();
    const { data: hook } = await supabase
      .from("script_hooks")
      .select(HOOK_COLUMNS)
      .eq("id", hookId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!hook) return { ok: false, error: "Ese gancho ya no existe." };
    const s = await loadScriptForHooks(scriptId);

    const review = await runHookReview({
      brandContext: s.brandContext,
      verbal: hook.hook_text as string,
      textOverlay: (hook.text_overlay as string | null) ?? null,
      visual: (hook.visual as string | null) ?? null,
      context: `${s.brief}\n\n${s.text}`,
    });
    if (!review) return { ok: false, error: "La IA no devolvió una revisión válida. Intenta de nuevo." };

    await supabase.from("script_hooks").update({ checks: review.checks }).eq("id", hookId).eq("owner_id", user.id);
    return { ok: true, review };
  } catch (e) {
    if (e instanceof AiJsonError) return { ok: false, error: "La IA no devolvió una revisión válida. Intenta de nuevo." };
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo revisar el gancho." };
  }
}

/** "Usar versión mejorada": reemplaza las 3 capas del gancho. */
export async function updateScriptHookLayers(
  hookId: string,
  scriptId: string,
  layers: { hook_text: string } & HookLayers,
): Promise<ScriptHook> {
  const { supabase, user } = await getAuthUser();
  const { data, error } = await supabase
    .from("script_hooks")
    .update({
      hook_text: layers.hook_text.trim(),
      text_overlay: layers.text_overlay?.trim() || null,
      visual: layers.visual?.trim() || null,
      hook_type: layers.hook_type ?? null,
      checks: layers.checks ?? null,
      why: layers.why?.trim() || null,
    })
    .eq("id", hookId)
    .eq("owner_id", user.id)
    .select(HOOK_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/guiones/${scriptId}`);
  return normalizeRow(data as Record<string, unknown>);
}
