import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientesLite, getIngestToken, getResources } from "./actions";
import RecursosClient from "./RecursosClient";

export const metadata = { title: "Recursos — Guionizator Pro" };

export default async function RecursosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [resources, clientes, ingestToken] = await Promise.all([
    getResources(),
    getClientesLite(),
    getIngestToken(),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const ingestUrl = `${siteUrl}/api/resources/ingest`;

  return (
    <RecursosClient
      initialResources={resources}
      clientes={clientes}
      ingestToken={ingestToken}
      ingestUrl={ingestUrl}
    />
  );
}
