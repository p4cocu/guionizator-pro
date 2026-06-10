import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";
import { getCalendar } from "./actions";

type SearchParams = Promise<{ client?: string; month?: string; year?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date();
  const month = params.month ? parseInt(params.month) : now.getMonth() + 1;
  const year = params.year ? parseInt(params.year) : now.getFullYear();
  const selectedClientId = params.client ?? null;

  const [{ data: clients }, entries] = await Promise.all([
    supabase
      .from("clients")
      .select("id, nombre, marca")
      .eq("owner_id", user!.id)
      .order("nombre"),
    getCalendar(selectedClientId, month, year),
  ]);

  return (
    <DashboardClient
      clients={clients ?? []}
      initialEntries={entries}
      selectedClientId={selectedClientId}
      month={month}
      year={year}
    />
  );
}
