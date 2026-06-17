"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  classifyResource,
  type ClientLite,
  type ResourceCategory,
} from "@/lib/resources/classify";

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export type ResourceRow = {
  id: string;
  created_at: string;
  source_url: string | null;
  raw_text: string | null;
  category: string;
  title: string;
  summary: string | null;
  prompt_text: string | null;
  client_id: string | null;
  client_auto: boolean;
  tags: string[];
  ingest_source: string;
  source_name: string | null;
  script_id: string | null;
  clients: { nombre: string } | null;
};

export type OwnResourceRow = {
  id: string;
  created_at: string;
  title: string;
  drive_url: string;
  source_resource_id: string | null;
  script_id: string | null;
  keyword_trigger: string | null;
  tags: string[];
  resources: { title: string } | null;
  scripts: { title: string | null; structure_name: string } | null;
};

export type ClienteLite = { id: string; nombre: string; marca: string | null };
export type ScriptLite = { id: string; title: string | null; structure_name: string };

// ── Resources capturados ────────────────────────────────────────────────────

export async function getResources(): Promise<ResourceRow[]> {
  const { supabase, user } = await getAuthUser();
  const { data, error } = await supabase
    .from("resources")
    .select("*, clients(nombre)")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ResourceRow[];
}

export async function getClientesLite(): Promise<ClienteLite[]> {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("clients")
    .select("id, nombre, marca")
    .eq("owner_id", user.id)
    .order("nombre", { ascending: true });
  return (data ?? []) as ClienteLite[];
}

export async function getScriptsLite(): Promise<ScriptLite[]> {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("scripts")
    .select("id, title, structure_name")
    .eq("owner_id", user.id)
    .eq("is_latest", true)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as ScriptLite[];
}

/** Devuelve el token de ingesta del usuario; lo crea si no existe. */
export async function getIngestToken(): Promise<string> {
  const { supabase, user } = await getAuthUser();

  const { data: existing } = await supabase
    .from("ingest_tokens")
    .select("token")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existing?.token) return existing.token as string;

  const token = `gz_${randomBytes(24).toString("hex")}`;
  const { error } = await supabase
    .from("ingest_tokens")
    .insert({ owner_id: user.id, token });
  if (error) throw new Error(error.message);
  return token;
}

/** Regenera el token (invalida el anterior). */
export async function regenerateIngestToken(): Promise<string> {
  const { supabase, user } = await getAuthUser();
  const token = `gz_${randomBytes(24).toString("hex")}`;
  const { error } = await supabase
    .from("ingest_tokens")
    .upsert({ owner_id: user.id, token }, { onConflict: "owner_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/recursos");
  return token;
}

/** Agregar recurso a mano (pegar url o texto): clasifica con la misma IA. */
export async function addResourceManual(input: {
  url?: string;
  text?: string;
  source_name?: string | null;
}): Promise<string> {
  const { supabase, user } = await getAuthUser();

  const url = input.url?.trim() || null;
  const text = input.text?.trim() || null;
  const sourceName = input.source_name?.trim() || null;
  if (!url && !text) throw new Error("Pega un link o un texto.");

  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, nombre, nicho, que_vende, cliente_ideal, dolor, deseo")
    .eq("owner_id", user.id);
  const clients = (clientsData ?? []) as ClientLite[];

  const classified = await classifyResource({ url, text, clients });

  const { data: inserted, error } = await supabase
    .from("resources")
    .insert({
      owner_id: user.id,
      source_url: url,
      raw_text: text,
      category: classified.category,
      title: classified.title,
      summary: classified.summary,
      prompt_text: classified.prompt_text,
      client_id: classified.client_id,
      client_auto: classified.client_auto,
      tags: classified.tags,
      ingest_source: "manual",
      source_name: sourceName,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/recursos");
  return inserted.id as string;
}

export async function updateResourceSourceName(
  id: string,
  sourceName: string | null,
): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase
    .from("resources")
    .update({ source_name: sourceName?.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/recursos");
}

export async function updateResourceClient(
  id: string,
  clientId: string | null,
): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase
    .from("resources")
    .update({ client_id: clientId, client_auto: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/recursos");
}

export async function updateResourceCategory(
  id: string,
  category: string,
): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase
    .from("resources")
    .update({ category, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/recursos");
}

export async function updateResourceTags(id: string, tags: string[]): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const clean = tags.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12);
  const { error } = await supabase
    .from("resources")
    .update({ tags: clean, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/recursos");
}

export async function updateResourceScriptId(
  id: string,
  scriptId: string | null,
): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase
    .from("resources")
    .update({ script_id: scriptId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/recursos");
}

export async function deleteResource(id: string): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase
    .from("resources")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/recursos");
}

// ── Recursos propios ────────────────────────────────────────────────────────

export async function getOwnResources(): Promise<OwnResourceRow[]> {
  const { supabase, user } = await getAuthUser();
  const { data, error } = await supabase
    .from("own_resources")
    .select("*, resources(title), scripts(title, structure_name)")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OwnResourceRow[];
}

export async function createOwnResource(input: {
  title: string;
  drive_url: string;
  source_resource_id?: string | null;
  script_id?: string | null;
  keyword_trigger?: string | null;
  tags?: string[];
}): Promise<string> {
  const { supabase, user } = await getAuthUser();
  const { data, error } = await supabase
    .from("own_resources")
    .insert({
      owner_id: user.id,
      title: input.title.trim(),
      drive_url: input.drive_url.trim(),
      source_resource_id: input.source_resource_id || null,
      script_id: input.script_id || null,
      keyword_trigger: input.keyword_trigger?.trim() || null,
      tags: (input.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/recursos");
  return data.id as string;
}

export async function updateOwnResource(
  id: string,
  input: Partial<{
    title: string;
    drive_url: string;
    source_resource_id: string | null;
    script_id: string | null;
    keyword_trigger: string | null;
    tags: string[];
  }>,
): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.drive_url !== undefined) patch.drive_url = input.drive_url.trim();
  if ("source_resource_id" in input) patch.source_resource_id = input.source_resource_id || null;
  if ("script_id" in input) patch.script_id = input.script_id || null;
  if ("keyword_trigger" in input) patch.keyword_trigger = input.keyword_trigger?.trim() || null;
  if (input.tags !== undefined) patch.tags = input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  const { error } = await supabase
    .from("own_resources")
    .update(patch)
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/recursos");
}

export async function deleteOwnResource(id: string): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase
    .from("own_resources")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/recursos");
}
