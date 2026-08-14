/**
 * Raíz: decide a dónde va cada usuario según su rol.
 *
 * Es el **único** lugar que toma esa decisión. El login, el callback de Auth y
 * el middleware mandan todos a `/` en vez de a `/dashboard`, así que agregar un
 * rol nuevo se hace acá y en ningún otro lado.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveLandingPath } from "@/lib/portal/access";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  redirect(await resolveLandingPath(supabase, user.id));
}
