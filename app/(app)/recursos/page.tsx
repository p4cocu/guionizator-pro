import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientesLite, getIngestToken, getOwnResources, getResources, getScriptsLite } from "./actions";
import RecursosClient from "./RecursosClient";

export const metadata = { title: "Recursos — Guionizator Pro" };

export default async function RecursosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [resources, ownResources, clientes, scripts, ingestToken] = await Promise.all([
    getResources(),
    getOwnResources(),
    getClientesLite(),
    getScriptsLite(),
    getIngestToken(),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const ingestUrl = `${siteUrl}/api/resources/ingest`;

  return (
    <RecursosClient
      initialResources={resources}
      initialOwnResources={ownResources}
      clientes={clientes}
      scripts={scripts}
      ingestToken={ingestToken}
      ingestUrl={ingestUrl}
    />
  );
}
