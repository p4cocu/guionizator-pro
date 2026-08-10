import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClienteForm from "../ClienteForm";
import ResearchSection from "./ResearchSection";
import ProductsSection from "./ProductsSection";
import InstagramSection from "./InstagramSection";
import ApifySection from "./ApifySection";
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

  const [
    { data: cliente },
    { data: research },
    { data: products },
    { data: igAccount },
  ] = await Promise.all([
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
    supabase
      .from("client_products")
      .select("id, nombre, descripcion, tipo, created_at")
      .eq("client_id", id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("instagram_accounts")
      .select(
        "id, ig_user_id, username, token_expires_at, created_at, last_refresh_attempt_at, last_refresh_error",
      )
      .eq("client_id", id)
      .eq("owner_id", user.id)
      .maybeSingle(),
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
        <ProductsSection clientId={id} products={products ?? []} />
        {/* Solo el estado enmascarado: `apify_token_cipher` NUNCA cruza al cliente. */}
        <ApifySection
          clientId={id}
          initial={{
            last4: cliente.apify_token_last4 ?? null,
            valid: cliente.apify_token_valid ?? false,
            checkedAt: cliente.apify_token_checked_at ?? null,
          }}
        />
        <InstagramSection clientId={id} account={igAccount ?? null} />
        <ResearchSection clientId={id} entries={research ?? []} />
        <DeleteClienteButton clienteId={id} />
      </div>
    </div>
  );
}
