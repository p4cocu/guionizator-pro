"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ScriptType = "reel" | "carousel";

export type ScriptStatus = "idea" | "produccion" | "publicado";

export type ScriptRow = {
  id: string;
  client_id: string;
  type: ScriptType;
  brief: string;
  structure_name: string;
  title: string | null;
  content: Record<string, unknown>;
  brain_version_id: string | null;
  created_at: string;
  version_number: number;
  parent_id: string | null;
  is_latest: boolean;
  status: ScriptStatus;
  clients: { nombre: string; marca: string | null } | null;
};

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function saveScript(data: {
  client_id: string;
  type: ScriptType;
  brief: string;
  structure_name: string;
  title?: string | null;
  content: Record<string, unknown>;
  brain_version_id: string | null;
}) {
  const { supabase, user } = await getAuthUser();

  const { data: script, error } = await supabase
    .from("scripts")
    .insert({
      owner_id: user.id,
      client_id: data.client_id,
      type: data.type,
      brief: data.brief,
      structure_name: data.structure_name,
      title: data.title ?? null,
      content: data.content,
      brain_version_id: data.brain_version_id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/guiones");
  redirect(`/guiones/${script.id}`);
}

export async function saveScriptSilent(data: {
  client_id: string;
  type: ScriptType;
  brief: string;
  structure_name: string;
  title?: string | null;
  content: Record<string, unknown>;
  brain_version_id: string | null;
}): Promise<string> {
  const { supabase, user } = await getAuthUser();

  const { data: script, error } = await supabase
    .from("scripts")
    .insert({
      owner_id: user.id,
      client_id: data.client_id,
      type: data.type,
      brief: data.brief,
      structure_name: data.structure_name,
      title: data.title ?? null,
      content: data.content,
      brain_version_id: data.brain_version_id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/guiones");
  return script.id;
}

export async function updateScriptTitle(
  scriptId: string,
  title: string
): Promise<void> {
  const { supabase, user } = await getAuthUser();

  const trimmed = title.trim() || null;

  const { error } = await supabase
    .from("scripts")
    .update({ title: trimmed })
    .eq("id", scriptId)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);

  // Sync to any linked calendar entries
  if (trimmed) {
    await supabase
      .from("content_calendar")
      .update({ title: trimmed })
      .eq("script_id", scriptId)
      .eq("owner_id", user.id);
  }

  revalidatePath("/guiones");
  revalidatePath(`/guiones/${scriptId}`);
  revalidatePath("/dashboard");
}

export async function deleteScript(id: string) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("scripts")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/guiones");
  redirect("/guiones");
}

export async function getScripts(): Promise<ScriptRow[]> {
  const { supabase, user } = await getAuthUser();

  const { data, error } = await supabase
    .from("scripts")
    .select("*, clients(nombre, marca)")
    .eq("owner_id", user.id)
    .eq("is_latest", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ScriptRow[];
}

export async function getScript(id: string): Promise<ScriptRow | null> {
  const { supabase, user } = await getAuthUser();

  const { data } = await supabase
    .from("scripts")
    .select("*, clients(nombre, marca)")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  return (data ?? null) as ScriptRow | null;
}

export type ScriptVersion = Pick<
  ScriptRow,
  "id" | "version_number" | "is_latest" | "created_at" | "parent_id"
>;

export async function getScriptWithVersions(id: string): Promise<{
  script: ScriptRow;
  versions: ScriptVersion[];
} | null> {
  const { supabase, user } = await getAuthUser();

  const { data: script } = await supabase
    .from("scripts")
    .select("*, clients(nombre, marca)")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (!script) return null;

  const rootId = script.parent_id ?? script.id;

  const { data: versions } = await supabase
    .from("scripts")
    .select("id, version_number, is_latest, created_at, parent_id")
    .or(`id.eq.${rootId},parent_id.eq.${rootId}`)
    .eq("owner_id", user.id)
    .order("version_number", { ascending: true });

  return {
    script: script as ScriptRow,
    versions: (versions ?? []) as ScriptVersion[],
  };
}

export async function updateScriptStatus(
  scriptId: string,
  status: ScriptStatus
): Promise<void> {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("scripts")
    .update({ status })
    .eq("id", scriptId)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/guiones");
  revalidatePath(`/guiones/${scriptId}`);
}

export async function saveScriptVersion(
  scriptId: string,
  content: Record<string, unknown>
): Promise<string> {
  const { supabase, user } = await getAuthUser();

  const { data: current } = await supabase
    .from("scripts")
    .select("*")
    .eq("id", scriptId)
    .eq("owner_id", user.id)
    .single();

  if (!current) throw new Error("Guion no encontrado");

  const rootId = current.parent_id ?? current.id;

  const { data: maxRow } = await supabase
    .from("scripts")
    .select("version_number")
    .or(`id.eq.${rootId},parent_id.eq.${rootId}`)
    .eq("owner_id", user.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (maxRow?.version_number ?? 1) + 1;

  await supabase
    .from("scripts")
    .update({ is_latest: false })
    .or(`id.eq.${rootId},parent_id.eq.${rootId}`)
    .eq("owner_id", user.id);

  const { data: newScript, error } = await supabase
    .from("scripts")
    .insert({
      owner_id: user.id,
      client_id: current.client_id,
      type: current.type,
      brief: current.brief,
      structure_name: current.structure_name,
      title: current.title ?? null,
      content,
      brain_version_id: current.brain_version_id,
      parent_id: rootId,
      version_number: nextVersion,
      is_latest: true,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/guiones");
  revalidatePath(`/guiones/${scriptId}`);

  return newScript.id;
}

export type ScriptCopy = {
  id: string;
  platform: string;
  copy_text: string;
  hashtags: string | null;
  created_at: string;
};

export async function getScriptCopies(scriptId: string): Promise<ScriptCopy[]> {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("script_copies")
    .select("id, platform, copy_text, hashtags, created_at")
    .eq("script_id", scriptId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  return (data ?? []) as ScriptCopy[];
}

export async function saveScriptCopy(
  scriptId: string,
  platform: string,
  copyText: string,
  hashtags: string,
): Promise<void> {
  const { supabase, user } = await getAuthUser();

  // Upsert by script + platform (replace existing copy for same platform)
  await supabase
    .from("script_copies")
    .delete()
    .eq("script_id", scriptId)
    .eq("platform", platform)
    .eq("owner_id", user.id);

  const { error } = await supabase.from("script_copies").insert({
    owner_id: user.id,
    script_id: scriptId,
    platform,
    copy_text: copyText,
    hashtags: hashtags || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/guiones/${scriptId}`);
}

export async function linkScriptToCalendar(
  scriptId: string,
  calendarId: string,
): Promise<void> {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("content_calendar")
    .update({ script_id: scriptId, updated_at: new Date().toISOString() })
    .eq("id", calendarId)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function addScriptToCalendar(
  scriptId: string,
  data: {
    client_id: string | null;
    title: string;
    format: string;
    month: number;
    year: number;
    week_number: number;
    position_preference: "inicio" | "fin";
  },
): Promise<void> {
  const { supabase, user } = await getAuthUser();

  const { data: existing } = await supabase
    .from("content_calendar")
    .select("position")
    .eq("owner_id", user.id)
    .eq("month", data.month)
    .eq("year", data.year)
    .eq("week_number", data.week_number)
    .order("position", {
      ascending: data.position_preference === "fin",
    })
    .limit(1);

  const refPos = (existing?.[0]?.position ?? 0) as number;
  const position =
    data.position_preference === "inicio" ? refPos - 1 : refPos + 1;

  const { error } = await supabase.from("content_calendar").insert({
    owner_id: user.id,
    script_id: scriptId,
    client_id: data.client_id,
    title: data.title,
    format: data.format,
    platforms: ["instagram"],
    status: "produccion",
    month: data.month,
    year: data.year,
    week_number: data.week_number,
    position,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath(`/guiones/${scriptId}`);
}
