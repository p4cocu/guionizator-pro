import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ClientesList from "./ClientesList";
import s from "./clientes.module.css";

export const metadata = { title: "Clientes — Guionizator Pro" };

export default async function ClientesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: clientes } = await supabase
    .from("clients")
    .select("id, nombre, marca, nicho, tono, completeness")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className={s.header}>
        <div>
          <p className="eyebrow">CRM-lite</p>
          <h1 className={s.title}>Clientes</h1>
          <p className={s.subtitle}>
            {clientes?.length ?? 0} cliente{(clientes?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/clientes/nuevo" className="btn btn-primary">
          + Nuevo cliente
        </Link>
      </div>

      <ClientesList clientes={clientes ?? []} />
    </div>
  );
}
