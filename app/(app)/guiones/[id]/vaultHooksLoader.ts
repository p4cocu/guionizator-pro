"use server";

import { createClient } from "@/lib/supabase/server";
import type { Hook } from "../../ganchos/actions";

export async function getVaultHooks(): Promise<Pick<Hook, "id" | "hook_template" | "category">[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("hooks")
    .select("id, hook_template, category")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []) as Pick<Hook, "id" | "hook_template" | "category">[];
}
