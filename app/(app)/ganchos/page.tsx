import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHooks } from "./actions";
import GanchosClient from "./GanchosClient";

export const metadata = { title: "Baúl de Ganchos — Guionizator Pro" };

export default async function GanchosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [hooks, { data: clientes }] = await Promise.all([
    getHooks(),
    supabase.from("clients").select("id, nombre").eq("owner_id", user.id).order("nombre"),
  ]);

  return <GanchosClient initialHooks={hooks} clientes={clientes ?? []} />;
}
