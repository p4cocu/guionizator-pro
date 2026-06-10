"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ── Shared types ───────────────────────────────────────────────────────────────

export type SceneIdea = {
  voice_segment: string;
  scene_idea: string;
  scene_description: string;
};

export type GeneratedPrompt = {
  voice_segment: string;
  scene_idea: string;
  prompt_en: string;
  description_es: string;
  copied?: boolean;
};

export type SavedScriptPrompts = {
  id: string;
  script_id: string;
  style_id: string;
  style_name: string;
  scenes: SceneIdea[];
  prompts: GeneratedPrompt[];
  updated_at: string;
};

export type PromptStyle = {
  id: string;
  name: string;
  description: string | null;
  style_type: string;
  base_style: string | null;
  style_tokens: string | null;
  example_prompt: string | null;
  is_active: boolean;
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

export async function getPromptStyles(): Promise<PromptStyle[]> {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("prompt_styles")
    .select("*")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  return (data ?? []) as PromptStyle[];
}

export async function savePromptStyle(data: {
  name: string;
  description?: string;
  base_style?: string;
  style_tokens?: string;
  example_prompt?: string;
}): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase.from("prompt_styles").insert({
    owner_id: user.id,
    name: data.name.trim(),
    description: data.description?.trim() || null,
    style_type: "custom",
    base_style: data.base_style || "custom",
    style_tokens: data.style_tokens?.trim() || null,
    example_prompt: data.example_prompt?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/prompts");
}

export async function deletePromptStyle(id: string): Promise<void> {
  const { supabase, user } = await getAuthUser();
  await supabase
    .from("prompt_styles")
    .update({ is_active: false })
    .eq("id", id)
    .eq("owner_id", user.id);
  revalidatePath("/prompts");
}

export type RecentReel = {
  id: string;
  client_id: string;
  structure_name: string;
  brief: string;
  created_at: string;
  content: Record<string, unknown>;
  clients: { nombre: string; marca: string | null } | null;
};

export async function getRecentReels(limit = 5): Promise<RecentReel[]> {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("scripts")
    .select("id, client_id, structure_name, brief, created_at, content, clients(nombre, marca)")
    .eq("owner_id", user.id)
    .eq("type", "reel")
    .eq("is_latest", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as RecentReel[];
}

export async function getScriptById(id: string): Promise<RecentReel | null> {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("scripts")
    .select("id, client_id, structure_name, brief, created_at, content, clients(nombre, marca)")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();
  return data as unknown as RecentReel | null;
}

// ── Script prompts persistence ─────────────────────────────────────────────────

export async function getScriptPrompts(script_id: string): Promise<SavedScriptPrompts | null> {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("script_prompts")
    .select("*")
    .eq("script_id", script_id)
    .eq("owner_id", user.id)
    .single();
  return data as SavedScriptPrompts | null;
}

export async function saveScriptPrompts(data: {
  script_id: string;
  style_id: string;
  style_name: string;
  scenes: SceneIdea[];
  prompts: GeneratedPrompt[];
}): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase.from("script_prompts").upsert(
    {
      owner_id: user.id,
      script_id: data.script_id,
      style_id: data.style_id,
      style_name: data.style_name,
      scenes: data.scenes,
      prompts: data.prompts,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "script_id,owner_id" },
  );
  if (error) throw new Error(error.message);
}
