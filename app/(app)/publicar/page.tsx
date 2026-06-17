import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PublicarClient from "./PublicarClient";

export default async function PublicarPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: clients }, { data: accounts }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, nombre, marca")
      .eq("owner_id", user!.id)
      .order("nombre"),
    supabase
      .from("instagram_accounts")
      .select("id, ig_user_id, username, client_id")
      .eq("owner_id", user!.id)
      .order("username"),
  ]);

  return (
    <PublicarClient
      clients={clients ?? []}
      accounts={accounts ?? []}
    />
  );
}
