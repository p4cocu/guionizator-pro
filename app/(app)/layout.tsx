import { redirect } from "next/navigation";
import ShellClient from "./ShellClient";
import PortalPending from "./PortalPending";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Miembro externo del portal: tiene membresías pero no es dueño de ninguna
  // marca. No le mostramos el shell interno (12 secciones que la RLS le deja
  // vacías). El conteo de membresías solo se pide si no tiene marcas propias,
  // así que para el dueño esto es una sola consulta indexada.
  const { count: ownedClients } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  if (!ownedClients) {
    const { count: memberships } = await supabase
      .from("client_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (memberships) return <PortalPending email={user.email} />;
  }

  return <ShellClient email={user.email}>{children}</ShellClient>;
}
