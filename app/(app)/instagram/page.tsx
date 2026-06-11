import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listInstagramAccounts } from "./actions";
import InstagramDashboard from "./InstagramDashboard";

export const metadata = { title: "Instagram — Guionizator Pro" };

export default async function InstagramPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const accounts = await listInstagramAccounts();

  return <InstagramDashboard accounts={accounts} />;
}
