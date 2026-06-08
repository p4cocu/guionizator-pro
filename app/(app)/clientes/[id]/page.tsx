import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClienteForm from "../ClienteForm";
import ResearchSection from "./ResearchSection";
import DeleteClienteButton from "./DeleteClienteButton";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("nombre")
    .eq("id", id)
    .single();
  return { title: data ? `${data.nombre} — Guionizator Pro` : "Cliente" };
}

export default async function ClienteDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: cliente }, { data: research }] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single(),
    supabase
      .from("client_research")
      .select("id, fuente, resumen, created_at")
      .eq("client_id", id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!cliente) notFound();

  return (
    <div>
      <ClienteForm
        clienteId={id}
        initial={{
          nombre: cliente.nombre ?? "",
          marca: cliente.marca ?? "",
          que_vende: cliente.que_vende ?? "",
          cliente_ideal: cliente.cliente_ideal ?? "",
          nicho: cliente.nicho ?? "",
          dolor: cliente.dolor ?? "",
          deseo: cliente.deseo ?? "",
          tono: cliente.tono ?? "",
          notas: cliente.notas ?? "",
        }}
      />
      <div style={{ maxWidth: 760 }}>
        <ResearchSection clientId={id} entries={research ?? []} />
        <DeleteClienteButton clienteId={id} />
      </div>
    </div>
  );
}
