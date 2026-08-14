/**
 * `/portal/[clientId]/reportes` — los reportes de competencia de esa marca.
 *
 * **Candado 2**: `requirePortalClient(..., "reportes")` revalida el flag en el
 * server antes de consultar. Apagar el switch en `/clientes/[id]` deja esta ruta
 * en 404, no solo la esconde del menú.
 *
 * ⚠️ NO se hace join a `clients` (como sí hace `/reportes`, la pantalla de
 * Paco): un miembro del portal no tiene policy de select sobre esa tabla y el
 * join le vuelve `null`. El nombre de la marca viene de `portal_clients`, vía
 * `requirePortalClient`.
 *
 * El filtro `.eq("client_id", …)` es defensa en profundidad: la policy
 * `reports_member_select` (migración `0006`) ya limita a las marcas del usuario.
 */

import { requirePortalClient, requirePortalSession, portalClientLabel } from "@/lib/portal/access";
import s from "./reportes.module.css";

type ReportRow = {
  id: string;
  title: string;
  post_count: number;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PortalReportesPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { supabase, user } = await requirePortalSession();
  const client = await requirePortalClient(user.id, clientId, "reportes");

  const { data } = await supabase
    .from("reports")
    .select("id, title, post_count, period_start, period_end, created_at")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });

  const reports = (data ?? []) as ReportRow[];

  return (
    <div>
      <div className={s.header}>
        <span className="eyebrow">{portalClientLabel(client)}</span>
        <h2 className={s.title}>Reportes</h2>
        <p className={s.subtitle}>
          Cada reporte es una foto de lo que estaba funcionando en tu competencia
          ese día: qué se grabó, qué ganchos usaron y los guiones adaptados a tu
          marca. Descárgalo en Excel o PDF.
        </p>
      </div>

      {reports.length === 0 ? (
        <div className={s.empty}>
          <p className={s.emptyTitle}>Todavía no hay reportes</p>
          <p className={s.emptyText}>
            Cuando se genere el primero para tu marca, aparece acá y lo vas a
            poder descargar cuando quieras.
          </p>
        </div>
      ) : (
        <div className={s.list}>
          {reports.map((r) => (
            <div key={r.id} className={s.card}>
              <div className={s.cardMain}>
                <h3 className={s.cardTitle}>{r.title}</h3>
                <p className={s.cardMeta}>
                  {r.post_count} post{r.post_count === 1 ? "" : "s"}
                  {r.period_start || r.period_end ? (
                    <>
                      {" · "}
                      {formatDate(r.period_start)} — {formatDate(r.period_end)}
                    </>
                  ) : null}
                  {" · "}generado el {formatDate(r.created_at)}
                </p>
              </div>
              <div className={s.cardActions}>
                <a className="btn btn-primary" href={`/api/reports/${r.id}/xlsx`}>
                  Excel
                </a>
                <a className="btn btn-secondary" href={`/api/reports/${r.id}/pdf`}>
                  PDF
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
