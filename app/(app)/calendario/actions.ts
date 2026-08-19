"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CalendarEntry = {
  id: string;
  client_id: string | null;
  script_id: string | null;
  title: string;
  format: string;
  platforms: string[];
  status: string;
  pillar: string | null;
  month: number;
  year: number;
  week_number: number | null;
  position: number;
  publish_date: string | null;
  brief: string | null;
  notes: string | null;
  cta_type: string | null;
  weekly_theme: string | null;
  created_at: string;
  metrics_views: number | null;
  metrics_likes: number | null;
  metrics_comments: number | null;
  metrics_shares: number | null;
  metrics_saves: number | null;
  clients?: { nombre: string; marca: string | null } | null;
  scripts?: { id: string } | null;
};

export type CalendarEntryInput = {
  client_id?: string | null;
  title: string;
  format: string;
  platforms: string[];
  status: string;
  pillar?: string;
  month: number;
  year: number;
  week_number?: number | null;
  brief?: string;
  notes?: string;
  cta_type?: string;
  weekly_theme?: string;
  publish_date?: string | null;
};

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function getCalendar(
  clientId: string | null,
  month: number,
  year: number,
): Promise<CalendarEntry[]> {
  const { supabase, user } = await getAuthUser();

  let query = supabase
    .from("content_calendar")
    .select("*, clients(nombre, marca), scripts(id)")
    .eq("owner_id", user.id)
    .eq("month", month)
    .eq("year", year)
    .order("week_number", { ascending: true })
    .order("position", { ascending: true });

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CalendarEntry[];
}

export async function createCalendarEntry(data: CalendarEntryInput) {
  const { supabase, user } = await getAuthUser();

  const { data: existing } = await supabase
    .from("content_calendar")
    .select("position")
    .eq("owner_id", user.id)
    .eq("month", data.month)
    .eq("year", data.year)
    .eq("week_number", data.week_number ?? null)
    .order("position", { ascending: false })
    .limit(1);

  const maxPos = (existing?.[0]?.position ?? -1) as number;

  const { error } = await supabase.from("content_calendar").insert({
    owner_id: user.id,
    client_id: data.client_id || null,
    title: data.title.trim(),
    format: data.format,
    platforms: data.platforms,
    status: data.status,
    pillar: data.pillar?.trim() || null,
    month: data.month,
    year: data.year,
    week_number: data.week_number ?? null,
    position: maxPos + 1,
    brief: data.brief?.trim() || null,
    notes: data.notes?.trim() || null,
    cta_type: data.cta_type || null,
    weekly_theme: data.weekly_theme?.trim() || null,
    publish_date: data.publish_date || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/calendario");
}

export async function updateCalendarDate(id: string, date: string | null) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("content_calendar")
    .update({ publish_date: date, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/calendario");
}

export async function updateCalendarEntry(
  id: string,
  data: Partial<CalendarEntryInput>,
) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("content_calendar")
    .update({
      client_id: data.client_id ?? undefined,
      title: data.title?.trim(),
      format: data.format,
      platforms: data.platforms,
      status: data.status,
      pillar: data.pillar?.trim() || null,
      brief: data.brief?.trim() || null,
      notes: data.notes?.trim() || null,
      cta_type: data.cta_type || null,
      week_number: data.week_number ?? undefined,
      weekly_theme: data.weekly_theme?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);

  // Sync title to linked script
  if (data.title?.trim()) {
    const { data: entry } = await supabase
      .from("content_calendar")
      .select("script_id")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();
    if (entry?.script_id) {
      await supabase
        .from("scripts")
        .update({ title: data.title.trim() })
        .eq("id", entry.script_id)
        .eq("owner_id", user.id);
    }
  }

  revalidatePath("/calendario");
  revalidatePath("/guiones");
}

export async function deleteCalendarEntry(id: string) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("content_calendar")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/calendario");
}

export async function updateCalendarMetrics(
  id: string,
  metrics: {
    metrics_views?: number | null;
    metrics_likes?: number | null;
    metrics_comments?: number | null;
    metrics_shares?: number | null;
    metrics_saves?: number | null;
  },
) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("content_calendar")
    .update({
      ...metrics,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/calendario");
}

export async function postponeCalendarEntry(id: string, to: "week" | "month") {
  const { supabase, user } = await getAuthUser();

  const { data: entry } = await supabase
    .from("content_calendar")
    .select("month, year, week_number")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (!entry) return;

  let newMonth = entry.month as number;
  let newYear = entry.year as number;
  let newWeek = (entry.week_number as number) ?? 1;

  if (to === "week") {
    if (newWeek < 4) {
      newWeek += 1;
    } else {
      newWeek = 1;
      if (newMonth === 12) { newMonth = 1; newYear += 1; }
      else newMonth += 1;
    }
  } else {
    if (newMonth === 12) { newMonth = 1; newYear += 1; }
    else newMonth += 1;
  }

  const { error } = await supabase
    .from("content_calendar")
    .update({ month: newMonth, year: newYear, week_number: newWeek, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/calendario");
}

export async function sendToProduction(id: string): Promise<void> {
  const { supabase, user } = await getAuthUser();

  const { data: entry } = await supabase
    .from("content_calendar")
    .select("status")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (!entry) return;

  const newStatus = entry.status === "etapa0" ? "idea" : entry.status;

  const { error } = await supabase
    .from("content_calendar")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/calendario");
}

export async function reorderCalendarEntry(
  id: string,
  direction: "up" | "down",
) {
  const { supabase, user } = await getAuthUser();

  const { data: entry } = await supabase
    .from("content_calendar")
    .select("position, week_number, month, year")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (!entry) return;

  const targetPos =
    direction === "up" ? entry.position - 1 : entry.position + 1;

  const { data: adjacent } = await supabase
    .from("content_calendar")
    .select("id, position")
    .eq("owner_id", user.id)
    .eq("month", entry.month)
    .eq("year", entry.year)
    .eq("week_number", entry.week_number)
    .eq("position", targetPos)
    .single();

  if (!adjacent) return;

  await Promise.all([
    supabase
      .from("content_calendar")
      .update({ position: adjacent.position })
      .eq("id", id)
      .eq("owner_id", user.id),
    supabase
      .from("content_calendar")
      .update({ position: entry.position })
      .eq("id", adjacent.id)
      .eq("owner_id", user.id),
  ]);

  revalidatePath("/calendario");
}

/**
 * El guion vinculado a una entrada del calendario (etapa 8).
 *
 * La vista "Calendario" (grilla del mes) abre un modal que solo editaba los
 * campos del calendario: para leer el guion había que cambiar a la vista
 * "Semanas", que sí tiene su link. Esto lo carga bajo demanda —al abrir el
 * modal— en vez de traer el `content` de todos los guiones del mes en el
 * server component, que es jsonb pesado y casi nunca se mira.
 *
 * `owner_id` filtrado a mano además de la RLS: el `script_id` viene del
 * cliente, y un id de otro dueño tiene que devolver `null`, no una fila.
 */
export type CalendarScript = {
  id: string;
  type: string | null;
  title: string | null;
  brief: string | null;
  status: string | null;
  content: Record<string, unknown> | null;
  version_number: number | null;
  /** `true` si `content_calendar.script_id` apuntaba a una versión anterior. */
  resolved_from_older: boolean;
};

/**
 * ⚠️ El `script_id` del calendario apunta a la fila que existía cuando se creó
 * la entrada, y **guardar una versión nueva crea una fila nueva**
 * (`saveScriptVersion`: `parent_id` = raíz, `is_latest` en la última). Sin
 * resolver la cadena, el modal mostraba la v1 y el botón "Editar guion" abría
 * una versión vieja, sin ningún aviso. Al 2026-08-19 le pasaba a 10 de las 20
 * entradas vinculadas.
 *
 * No se corrige el `script_id` guardado a propósito: la entrada sigue
 * apuntando a la raíz de la cadena, que es estable, y la versión vigente se
 * resuelve en cada lectura. Escribirlo obligaría a mantenerlo sincronizado en
 * cada `saveScriptVersion`.
 */
export async function getCalendarScript(scriptId: string): Promise<CalendarScript | null> {
  const { supabase, user } = await getAuthUser();

  const COLUMNS = "id, type, title, brief, status, content, version_number, parent_id, is_latest";

  const { data: linked } = await supabase
    .from("scripts")
    .select(COLUMNS)
    .eq("id", scriptId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!linked) return null;

  const row = linked as CalendarScript & { parent_id: string | null; is_latest: boolean };
  if (row.is_latest) return { ...row, resolved_from_older: false };

  // Misma cadena que `getScriptWithVersions`: la raíz es `parent_id ?? id`, y
  // las versiones son ella misma más sus hijas.
  const rootId = row.parent_id ?? row.id;
  const { data: latest } = await supabase
    .from("scripts")
    .select(COLUMNS)
    .eq("owner_id", user.id)
    .or(`id.eq.${rootId},parent_id.eq.${rootId}`)
    .eq("is_latest", true)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Si la cadena quedó sin `is_latest` (dato viejo), mejor la fila vinculada
  // que una pantalla vacía.
  return { ...((latest as CalendarScript | null) ?? row), resolved_from_older: Boolean(latest) };
}

/**
 * Guiones que se pueden vincular a una entrada del calendario (etapa 9).
 *
 * La mayoría de las entradas no tiene guion: las que salen del generador de
 * calendario nacen sin él, y un guion escrito después vive por su cuenta. Al
 * 2026-08-19, las 6 entradas de agosto no tenían ninguno.
 *
 * Solo versiones vigentes y fuera de la papelera, mismo criterio que
 * `getScripts`. Se traen también los ya vinculados a otra entrada, marcados,
 * porque a veces es justo lo que se quiere (mover un guion de fecha).
 */
export type LinkableScript = {
  id: string;
  title: string | null;
  type: string | null;
  status: string | null;
  created_at: string;
  client_label: string | null;
  /** Ya está vinculado a otra entrada del calendario. */
  linked_elsewhere: boolean;
};

export async function getLinkableScripts(
  clientId: string | null,
): Promise<LinkableScript[]> {
  const { supabase, user } = await getAuthUser();

  let query = supabase
    .from("scripts")
    .select("id, title, type, status, created_at, client_id, clients(nombre, marca)")
    .eq("owner_id", user.id)
    .eq("is_latest", true)
    .is("trashed_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  // Si la entrada tiene marca, se acota a esa marca: vincular el guion de otra
  // sería casi siempre un error de tipeo. Sin marca, se listan todos con su
  // etiqueta.
  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    id: string;
    title: string | null;
    type: string | null;
    status: string | null;
    created_at: string;
    clients: { nombre: string; marca: string | null } | null;
  }[];

  const { data: taken } = await supabase
    .from("content_calendar")
    .select("script_id")
    .eq("owner_id", user.id)
    .not("script_id", "is", null);

  const linked = new Set(
    ((taken ?? []) as { script_id: string }[]).map((r) => r.script_id),
  );

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    status: r.status,
    created_at: r.created_at,
    client_label: r.clients ? r.clients.marca?.trim() || r.clients.nombre : null,
    linked_elsewhere: linked.has(r.id),
  }));
}

/**
 * Vincula (o desvincula, con `scriptId = null`) un guion a una entrada.
 *
 * `owner_id` filtrado a mano en las dos tablas además de la RLS: los dos ids
 * vienen del cliente. Si el guion no es del dueño, no se escribe nada.
 */
export async function setCalendarScript(
  calendarId: string,
  scriptId: string | null,
): Promise<void> {
  const { supabase, user } = await getAuthUser();

  if (scriptId) {
    const { data: script } = await supabase
      .from("scripts")
      .select("id")
      .eq("id", scriptId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!script) throw new Error("Ese guion no existe o no es tuyo.");
  }

  const { error } = await supabase
    .from("content_calendar")
    .update({ script_id: scriptId, updated_at: new Date().toISOString() })
    .eq("id", calendarId)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/calendario");
}
