"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
