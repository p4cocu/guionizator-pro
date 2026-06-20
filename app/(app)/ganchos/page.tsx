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

  const hooks = await getHooks();

  return <GanchosClient initialHooks={hooks} />;
}
