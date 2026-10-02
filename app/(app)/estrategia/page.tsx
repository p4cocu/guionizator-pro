import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  IDEA_COLUMNS,
  STRATEGY_COLUMNS,
  normalizeStrategyRow,
  type ContentIdea,
} from "@/lib/strategy/pillars";
import { sanitizeTestAnswers } from "@/lib/strategy/test";
import EstrategiaClient from "./EstrategiaClient";
import styles from "./estrategia.module.css";

export const metadata = { title: "Estrategia — Guionizator Pro" };

/** Sin la `0017` aplicada, PostgREST no encuentra la tabla. */
function isMissingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /could not find the table|does not exist/i.test(error.message ?? "")
  );
}

function readTest(row: Record<string, unknown> | null) {
  if (!row?.test_answers) return null;
  return {
    answers: sanitizeTestAnswers(row.test_answers),
    completedAt: typeof row.test_completed_at === "string" ? row.test_completed_at : null,
  };
}

/**
 * Estrategia de contenido por marca (migración `0017`): cliente ideal, pilares,
 * generador de ideas y banco. La marca va por `?cliente=` para que el link se
 * pueda compartir y recargar sin perderla.
 */
export default async function EstrategiaPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: clientes } = await supabase
    .from("clients")
    .select("id, nombre, marca")
    .eq("owner_id", user.id)
    .order("nombre");

  if (!clientes?.length) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Estrategia de contenido</h1>
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ marginBottom: 16, color: "var(--text-muted)" }}>
            Necesitas al menos un cliente para definir su estrategia.
          </p>
          <Link href="/clientes/nuevo" className="btn btn-primary">
            Crear cliente
          </Link>
        </div>
      </div>
    );
  }

  const selected = clientes.find((c) => c.id === cliente) ?? clientes[0];

  const [strategyRes, ideasRes] = await Promise.all([
    supabase
      .from("content_strategies")
      // `test_*` (0019): las respuestas del último test, del cliente o tuyas.
      .select(`${STRATEGY_COLUMNS}, test_answers, test_completed_at`)
      .eq("client_id", selected.id)
      .eq("owner_id", user.id)
      .maybeSingle(),
    supabase
      .from("content_ideas")
      .select(IDEA_COLUMNS)
      .eq("client_id", selected.id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (isMissingTable(strategyRes.error) || isMissingTable(ideasRes.error)) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Estrategia de contenido</h1>
        <div className="card" style={{ padding: 24 }}>
          <p style={{ margin: 0 }}>
            Falta aplicar la migración <code>0017_estrategia_contenido.sql</code> en el SQL Editor de
            Supabase. Después recarga esta página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <EstrategiaClient
      key={selected.id}
      clientes={clientes}
      clientId={selected.id}
      initialStrategy={normalizeStrategyRow(strategyRes.data as Record<string, unknown> | null, selected.id)}
      initialIdeas={(ideasRes.data ?? []) as unknown as ContentIdea[]}
      initialTest={readTest(strategyRes.data as Record<string, unknown> | null)}
    />
  );
}
