import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTendencias } from "./actions";
import TendenciasClient from "./TendenciasClient";

export const metadata = { title: "Tendencias — Guionizator Pro" };

export default async function TendenciasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tendencias = await getTendencias();

  return <TendenciasClient initialTendencias={tendencias} />;
}
