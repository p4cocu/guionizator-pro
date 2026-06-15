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
  clients: { nombre: string } | null;
};

export type ClienteLite = { id: string; nombre: string; marca: string | null };

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
}): Promise<string> {
  const { supabase, user } = await getAuthUser();

  const url = input.url?.trim() || null;
  const text = input.text?.trim() || null;
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
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/recursos");
  return inserted.id as string;
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
