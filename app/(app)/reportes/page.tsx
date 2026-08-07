import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeleteReportButton from "./DeleteReportButton";
import s from "./reportes.module.css";

export const metadata = { title: "Reportes — Guionizator Pro" };

type ReportRow = {
  id: string;
  title: string;
  post_count: number;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  clients: { nombre: string; marca: string | null } | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ReportesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("reports")
    .select("id, title, post_count, period_start, period_end, created_at, clients(nombre, marca)")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const reports = (data ?? []) as unknown as ReportRow[];

  return (
    <div>
      <div className={s.header}>
        <div>
          <span className="eyebrow">Entregables</span>
          <h1 className={s.title}>Reportes</h1>
          <p className={s.subtitle}>
            Cada reporte congela sus datos al generarse, así que sigue completo aunque
            la limpieza de 40 días ya haya borrado los posts.
          </p>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className={s.empty}>
          <p className={s.emptyTitle}>Todavía no hay reportes</p>
          <p className={s.emptyText}>
            Ve a Competencia, marca los posts que quieras incluir y presiona
            &ldquo;Generar reporte&rdquo;.
          </p>
          <Link href="/competencia" className="btn btn-primary" style={{ fontSize: 13 }}>
            Ir a Competencia
          </Link>
        </div>
      ) : (
        <div className={s.list}>
          {reports.map((r) => (
            <div key={r.id} className={s.card}>
              <div className={s.cardMain}>
                <span className={s.cardClient}>
                  {r.clients?.marca || r.clients?.nombre || "Cliente eliminado"}
                </span>
                <h2 className={s.cardTitle}>{r.title}</h2>
                <p className={s.cardMeta}>
                  {r.post_count} post{r.post_count === 1 ? "" : "s"}
                  {r.period_start || r.period_end ? (
                    <> · {formatDate(r.period_start)} — {formatDate(r.period_end)}</>
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
                <DeleteReportButton reportId={r.id} title={r.title} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
