"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ScriptHook = {
  id: string;
  hook_text: string;
  hook_id: string | null;
  position: number;
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

export async function getScriptHooks(scriptId: string): Promise<ScriptHook[]> {
  const { supabase, user } = await getAuthUser();
  const { data, error } = await supabase
    .from("script_hooks")
    .select("id, hook_text, hook_id, position, created_at")
    .eq("script_id", scriptId)
    .eq("owner_id", user.id)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ScriptHook[];
}

export async function addScriptHook(
  scriptId: string,
  hookText: string,
  hookId?: string | null
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
    })
    .select("id, hook_text, hook_id, position, created_at")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/guiones/${scriptId}`);
  return data as ScriptHook;
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
