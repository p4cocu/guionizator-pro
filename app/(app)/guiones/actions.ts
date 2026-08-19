"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ScriptType = "reel" | "carousel";

export type ScriptStatus = "idea" | "preproduccion" | "produccion" | "listo" | "publicado" | "baul";

export type RecordingType =
  | "voz_off"
  | "actuacion"
  | "actuacion_compu"
  | "actuacion_cel"
  | "compu"
  | "cel";

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
  recording_type: RecordingType | null;
  source_post_permalink: string | null;
  source_post_id: string | null;
  featured: boolean;
  /**
   * Miembro del portal que generó este guion con el add-on de IA (migración
   * `0009`). `null` = lo hiciste vos desde el estudio. Se usa solo para el badge
   * "Generado por el cliente": el guion se trabaja igual que cualquier otro.
   */
  generated_by: string | null;
  clients: { nombre: string; marca: string | null } | null;
  has_resource?: boolean;
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
  source_post_permalink?: string | null;
  source_post_id?: string | null;
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
      source_post_permalink: data.source_post_permalink ?? null,
      source_post_id: data.source_post_id ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/guiones");
  return script.id;
}

/**
 * Guarda un guion nuevo Y crea una idea vinculada en el dashboard de
 * publicaciones (content_calendar). Se usa cuando el guion nace en la pestaña
 * Guiones (sin idea previa): dashboard y guiones quedan como dos vistas de lo
 * mismo. Entra con estatus "idea" en la primera semana del mes actual.
 */
export async function saveScriptWithNewIdea(data: {
  client_id: string;
  type: ScriptType;
  brief: string;
  structure_name: string;
  title?: string | null;
  content: Record<string, unknown>;
  brain_version_id: string | null;
  source_post_permalink?: string | null;
  source_post_id?: string | null;
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
      source_post_permalink: data.source_post_permalink ?? null,
      source_post_id: data.source_post_id ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: existing } = await supabase
    .from("content_calendar")
    .select("position")
    .eq("owner_id", user.id)
    .eq("month", month)
    .eq("year", year)
    .eq("week_number", 1)
    .order("position", { ascending: false })
    .limit(1);

  const maxPos = (existing?.[0]?.position ?? -1) as number;

  const { error: calError } = await supabase.from("content_calendar").insert({
    owner_id: user.id,
    client_id: data.client_id,
    script_id: script.id,
    title: data.title?.trim() || data.structure_name,
    format: data.type === "carousel" ? "carrusel" : "reel",
    platforms: ["instagram"],
    status: "idea",
    month,
    year,
    week_number: 1,
    position: maxPos + 1,
    brief: data.brief || null,
  });

  if (calError) throw new Error(calError.message);

  revalidatePath("/guiones");
  revalidatePath("/calendario");
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
  revalidatePath("/calendario");
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

export async function getScripts(
  clientId?: string,
  type?: ScriptType,
  estados?: string[],
): Promise<ScriptRow[]> {
  const { supabase, user } = await getAuthUser();

  let query = supabase
    .from("scripts")
    .select("*, clients(nombre, marca)")
    .eq("owner_id", user.id)
    .eq("is_latest", true)
    // La papelera (etapa 7) es transversal a cualquier status, incluido baúl:
    // se ve solo desde `getTrashedScripts`, nunca acá.
    .is("trashed_at", null)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (clientId) query = query.eq("client_id", clientId);
  if (type) query = query.eq("type", type);
  if (estados && estados.length > 0) {
    query = query.in("status", estados);
  } else {
    // Por defecto (sin filtro de estado) ocultamos el Baúl: son ideas congeladas
    // que no deben estorbar en la vista principal. Solo aparecen si se filtran
    // explícitamente por "baul".
    query = query.neq("status", "baul");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const scripts = (data ?? []) as ScriptRow[];
  if (scripts.length === 0) return scripts;

  const scriptIds = scripts.map((s) => s.id);
  const [{ data: rIds }, { data: orIds }] = await Promise.all([
    supabase.from("resources").select("script_id").eq("owner_id", user.id).in("script_id", scriptIds),
    supabase.from("own_resources").select("script_id").eq("owner_id", user.id).in("script_id", scriptIds),
  ]);

  const withResource = new Set([
    ...(rIds ?? []).map((r) => r.script_id as string),
    ...(orIds ?? []).map((r) => r.script_id as string),
  ]);

  return scripts.map((s) => ({ ...s, has_resource: withResource.has(s.id) }));
}

export type OwnResourceForScript = {
  id: string;
  title: string;
  drive_url: string;
  keyword_trigger: string | null;
};

export async function getOwnResourcesForScript(scriptId: string): Promise<OwnResourceForScript[]> {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("own_resources")
    .select("id, title, drive_url, keyword_trigger")
    .eq("owner_id", user.id)
    .eq("script_id", scriptId)
    .order("created_at", { ascending: false });
  return (data ?? []) as OwnResourceForScript[];
}

export type ClientOption = { id: string; nombre: string };

export async function getClientOptions(): Promise<ClientOption[]> {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("clients")
    .select("id, nombre")
    .eq("owner_id", user.id)
    .order("nombre", { ascending: true });
  return (data ?? []) as ClientOption[];
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
      source_post_permalink: (current as ScriptRow).source_post_permalink ?? null,
      // La liga al post original se arrastra entre versiones: si no, editar un
      // guion adaptado lo desconectaría del post en el reporte.
      source_post_id: (current as ScriptRow).source_post_id ?? null,
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

export type ScriptCoverIdea = {
  has_character: boolean;
  medium: string;
  subject: string;
  action: string;
  environment: string;
  style_vibe: string;
  technical_specs: string;
  prompt_en: string;
  cover_text: string;
  rationale_es: string;
};

export type SavedScriptCovers = {
  id: string;
  script_id: string;
  covers: ScriptCoverIdea[];
  updated_at: string;
};

export async function getScriptCovers(scriptId: string): Promise<SavedScriptCovers | null> {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("script_covers")
    .select("*")
    .eq("script_id", scriptId)
    .eq("owner_id", user.id)
    .single();
  return data as SavedScriptCovers | null;
}

export async function saveScriptCovers(
  scriptId: string,
  covers: ScriptCoverIdea[],
): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase.from("script_covers").upsert(
    {
      owner_id: user.id,
      script_id: scriptId,
      covers,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "script_id,owner_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/guiones/${scriptId}`);
}

/**
 * Vuelve a una versión anterior del guion (etapa 9).
 *
 * "La versión vigente" es la fila con `is_latest` dentro de la cadena
 * (`parent_id ?? id` y sus hijas). Restaurar es mover esa marca, no copiar ni
 * borrar nada: la v3 sigue en la tabla y se puede volver a ella igual de fácil.
 *
 * A propósito NO crea una versión nueva con el contenido viejo (que sería la
 * otra forma de hacerlo): eso llenaría la cadena de duplicados cada vez que
 * comparás dos versiones, y la lista de versiones dejaría de contar la historia
 * real de lo que se escribió.
 *
 * ⚠️ Como efecto colateral útil, deja siempre la cadena consistente: si por un
 * fallo anterior ninguna fila tenía `is_latest` (pasó con 6 cadenas al
 * 2026-08-19, y esos guiones desaparecían de `/guiones`), llamar acá la
 * repara.
 */
export async function restoreScriptVersion(scriptId: string): Promise<void> {
  const { supabase, user } = await getAuthUser();

  const { data: target } = await supabase
    .from("scripts")
    .select("id, parent_id")
    .eq("id", scriptId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!target) throw new Error("Ese guion no existe o no es tuyo.");

  const rootId = (target.parent_id as string | null) ?? (target.id as string);

  const { error: clearError } = await supabase
    .from("scripts")
    .update({ is_latest: false })
    .or(`id.eq.${rootId},parent_id.eq.${rootId}`)
    .eq("owner_id", user.id);
  if (clearError) throw new Error(clearError.message);

  const { error } = await supabase
    .from("scripts")
    .update({ is_latest: true })
    .eq("id", scriptId)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/guiones");
  revalidatePath(`/guiones/${scriptId}`);
  revalidatePath("/calendario");
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
  revalidatePath("/calendario");
}

/** Marca/desmarca un guion como destacado (para desarrollar a la brevedad). */
export async function toggleScriptFeatured(
  scriptId: string,
  featured: boolean,
): Promise<void> {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("scripts")
    .update({ featured })
    .eq("id", scriptId)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/guiones");
  revalidatePath(`/guiones/${scriptId}`);
}

export async function updateScriptRecordingType(
  scriptId: string,
  recordingType: RecordingType | null
): Promise<void> {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("scripts")
    .update({ recording_type: recordingType })
    .eq("id", scriptId)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/guiones");
  revalidatePath(`/guiones/${scriptId}`);
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
  revalidatePath("/calendario");
  revalidatePath(`/guiones/${scriptId}`);
}

// ─── Papelera (Fase D, etapa 7) ───────────────────────────────────────────────
// Un guion llega acá cuando un miembro del portal lo tira (server action con
// service role, `lib/portal/trash.ts` — un `viewer` no tiene `update` sobre
// `scripts` con su propia sesión). Vos sos el único que ve esta lista: sirve
// para deshacer un tiro por error antes de que el cron lo borre en firme a los
// 30 días (`netlify/functions/cleanup-scripts-trash-scheduled.ts`).

export type TrashedScriptRow = {
  id: string;
  title: string | null;
  brief: string | null;
  structure_name: string;
  type: ScriptType;
  trashed_at: string;
  clients: { nombre: string; marca: string | null } | null;
};

export async function getTrashedScripts(): Promise<TrashedScriptRow[]> {
  const { supabase, user } = await getAuthUser();

  const { data, error } = await supabase
    .from("scripts")
    .select("id, title, brief, structure_name, type, trashed_at, clients(nombre, marca)")
    .eq("owner_id", user.id)
    .eq("is_latest", true)
    .not("trashed_at", "is", null)
    .order("trashed_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TrashedScriptRow[];
}

export async function restoreScriptFromTrash(id: string): Promise<void> {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("scripts")
    .update({ trashed_at: null })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/guiones");
}

/**
 * Borra en firme desde la papelera. A diferencia de `deleteScript` (el botón
 * del detalle, que redirige) esta no navega a ningún lado: se llama desde la
 * lista de la papelera, que se queda en la misma pantalla.
 */
export async function permanentlyDeleteScript(id: string): Promise<void> {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("scripts")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .not("trashed_at", "is", null);

  if (error) throw new Error(error.message);
  revalidatePath("/guiones");
}
