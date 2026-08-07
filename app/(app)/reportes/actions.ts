"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteReport(reportId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("reports")
    .delete()
    .eq("id", reportId)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/reportes");
}
