"use server";

import { createClient } from "@/lib/supabase/server";

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export type ScriptsByStatus = Record<string, number>;

export type ClientScriptCount = {
  id: string;
  nombre: string;
  marca: string | null;
  count: number;
};

export type DashboardMetrics = {
  scriptsByStatus: ScriptsByStatus;
  totalScripts: number;
  scriptsLast30: number;
  scriptsPrev30: number;
  topClients: ClientScriptCount[];
  totalHooks: number;
  igAccounts: number;
  publishedThisMonth: number;
  calendarByStatus: Record<string, number>;
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { supabase, user } = await getAuthUser();

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const [
    scriptsResult,
    scriptsLast30Result,
    scriptsPrev30Result,
    clientsResult,
    hooksResult,
    igResult,
    calendarResult,
  ] = await Promise.all([
    supabase
      .from("scripts")
      .select("status")
      .eq("owner_id", user.id),

    supabase
      .from("scripts")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .gte("created_at", thirtyDaysAgo),

    supabase
      .from("scripts")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .gte("created_at", sixtyDaysAgo)
      .lt("created_at", thirtyDaysAgo),

    supabase
      .from("clients")
      .select("id, nombre, marca")
      .eq("owner_id", user.id),

    supabase
      .from("script_hooks")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),

    supabase
      .from("instagram_accounts")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),

    supabase
      .from("content_calendar")
      .select("status")
      .eq("owner_id", user.id)
      .eq("month", month)
      .eq("year", year),
  ]);

  const scripts = scriptsResult.data ?? [];
  const scriptsByStatus: ScriptsByStatus = {};
  let totalScripts = 0;
  for (const s of scripts) {
    scriptsByStatus[s.status] = (scriptsByStatus[s.status] ?? 0) + 1;
    totalScripts++;
  }

  const calendarEntries = calendarResult.data ?? [];
  const calendarByStatus: Record<string, number> = {};
  let publishedThisMonth = 0;
  for (const e of calendarEntries) {
    calendarByStatus[e.status] = (calendarByStatus[e.status] ?? 0) + 1;
    if (e.status === "publicado") publishedThisMonth++;
  }

  // Re-query scripts with client_id for top clients
  const { data: scriptsWithClient } = await supabase
    .from("scripts")
    .select("client_id")
    .eq("owner_id", user.id)
    .not("client_id", "is", null);

  const clientCounts: Record<string, number> = {};
  for (const s of scriptsWithClient ?? []) {
    if (s.client_id) {
      clientCounts[s.client_id] = (clientCounts[s.client_id] ?? 0) + 1;
    }
  }

  const clients = clientsResult.data ?? [];
  const topClients: ClientScriptCount[] = clients
    .map((c) => ({ id: c.id, nombre: c.nombre, marca: c.marca, count: clientCounts[c.id] ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    scriptsByStatus,
    totalScripts,
    scriptsLast30: scriptsLast30Result.count ?? 0,
    scriptsPrev30: scriptsPrev30Result.count ?? 0,
    topClients,
    totalHooks: hooksResult.count ?? 0,
    igAccounts: igResult.count ?? 0,
    publishedThisMonth,
    calendarByStatus,
  };
}
