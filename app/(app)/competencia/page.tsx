import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listClients } from "./actions";
import CompetenciaClient from "./CompetenciaClient";

export const metadata = { title: "Competencia — Guionizator Pro" };

// Tope de vida de la función en Vercel. Las server actions corren dentro de la
// función de esta página, y `startScrape` sigue scrapeando en `after()` después
// de responder (Apify sobre varias cuentas tarda minutos). 800 s = máximo de
// Vercel Pro con Fluid. Netlify lo ignora.
export const maxDuration = 800;

export default async function CompetenciaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clients = await listClients();

  return <CompetenciaClient clients={clients} />;
}
