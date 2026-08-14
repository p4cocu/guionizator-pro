import { redirect } from "next/navigation";
import ShellClient from "./ShellClient";
import { createClient } from "@/lib/supabase/server";
import { resolveLandingPath } from "@/lib/portal/access";

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
  // vacías) — se va a `/portal`, que es su casa. El conteo de membresías solo
  // se pide si no tiene marcas propias, así que para el dueño esto es una sola
  // consulta indexada.
  //
  // El dueño NO se redirige: puede entrar a `/portal` a mano para ver su marca
  // como la ve el cliente, pero su lugar por defecto sigue siendo el estudio.
  if ((await resolveLandingPath(supabase, user.id)) === "/portal") {
    redirect("/portal");
  }

  return <ShellClient email={user.email}>{children}</ShellClient>;
}
