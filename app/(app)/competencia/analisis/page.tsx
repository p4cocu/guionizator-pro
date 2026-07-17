import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listClients } from "../actions";
import AnalisisClient from "./AnalisisClient";

export const metadata = { title: "Análisis de Competencia — Guionizator Pro" };

export default async function AnalisisPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clients = await listClients();
  const { client } = await searchParams;

  return <AnalisisClient clients={clients} initialClientId={client ?? null} />;
}
