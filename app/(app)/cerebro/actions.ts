"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveBrainVersion(content: string, label?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Desactivar versión actual
  await supabase
    .from("brain_versions")
    .update({ is_active: false })
    .eq("owner_id", user.id)
    .eq("is_active", true);

  // Obtener número de versión siguiente
  const { count } = await supabase
    .from("brain_versions")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", user.id);

  const nextVersion = (count ?? 0) + 1;

  const { error } = await supabase.from("brain_versions").insert({
    owner_id: user.id,
    version: nextVersion,
    content,
    label: label || null,
    is_active: true,
    origin: "manual",
  });

  if (error) throw new Error(error.message);

  revalidatePath("/cerebro");
}

export async function restoreBrainVersion(versionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Desactivar versión actual
  await supabase
    .from("brain_versions")
    .update({ is_active: false })
    .eq("owner_id", user.id)
    .eq("is_active", true);

  // Activar la versión seleccionada
  const { error } = await supabase
    .from("brain_versions")
    .update({ is_active: true })
    .eq("id", versionId)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/cerebro");
}
