import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NuevoGuionForm from "./NuevoGuionForm";
import styles from "../guiones.module.css";

export default async function NuevoGuionPage({
  searchParams,
}: {
  searchParams: Promise<{ brief?: string; client_id?: string }>;
}) {
  const { brief, client_id } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: clientes } = await supabase
    .from("clients")
    .select("id, nombre, marca")
    .eq("owner_id", user!.id)
    .order("nombre");

  return (
    <div className={styles.formPage}>
      <div className={styles.formHeader}>
        <Link href="/guiones" className={styles.formBack}>
          ← Guiones
        </Link>
        <h1 className={styles.formTitle}>Nuevo guion</h1>
      </div>

      {!clientes?.length ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ marginBottom: 16, color: "var(--text-muted)" }}>
            Necesitas al menos un cliente para generar guiones.
          </p>
          <Link href="/clientes/nuevo" className="btn btn-primary">
            Crear cliente
          </Link>
        </div>
      ) : (
        <NuevoGuionForm
          clientes={clientes}
          initialBrief={brief}
          initialClientId={client_id}
        />
      )}
    </div>
  );
}
