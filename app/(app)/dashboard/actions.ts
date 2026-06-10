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
  brief: string | null;
  notes: string | null;
  cta_type: string | null;
  weekly_theme: string | null;
  created_at: string;
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
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
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
  revalidatePath("/dashboard");
}

export async function deleteCalendarEntry(id: string) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("content_calendar")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
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

  revalidatePath("/dashboard");
}
