import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listClients } from "./actions";
import CompetenciaClient from "./CompetenciaClient";

export const metadata = { title: "Competencia — Guionizator Pro" };

export default async function CompetenciaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clients = await listClients();

  return <CompetenciaClient clients={clients} />;
}
