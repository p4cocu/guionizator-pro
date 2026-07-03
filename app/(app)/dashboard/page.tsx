import Link from "next/link";
import { getDashboardMetrics } from "./actions";
import s from "./dashboard.module.css";

const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  preproduccion: "Preproducción",
  produccion: "Producción",
  listo: "Listo",
  publicado: "Publicado",
  baul: "Baúl",
};

const STATUS_COLORS: Record<string, string> = {
  idea: "var(--text-dim)",
  preproduccion: "rgba(178,242,187,0.9)",
  produccion: "rgba(255,210,58,0.9)",
  listo: "rgba(255,235,150,0.9)",
  publicado: "var(--emerald)",
  baul: "rgba(157,142,201,0.9)",
};

const CAL_STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  etapa0: "Etapa 0",
  produccion: "En producción",
  publicado: "Publicado",
};

const CAL_STATUS_COLORS: Record<string, string> = {
  idea: "var(--text-dim)",
  etapa0: "var(--signal)",
  produccion: "var(--emerald)",
  publicado: "rgba(0,159,125,0.7)",
};

const SCRIPT_STATUS_ORDER = ["idea", "preproduccion", "produccion", "listo", "publicado", "baul"];
const CAL_STATUS_ORDER = ["idea", "etapa0", "produccion", "publicado"];

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();

  const {
    scriptsByStatus,
    totalScripts,
    scriptsLast30,
    scriptsPrev30,
    topClients,
    totalHooks,
    igAccounts,
    publishedThisMonth,
    calendarByStatus,
  } = metrics;

  const publishedTotal = scriptsByStatus["publicado"] ?? 0;
  const publicationRate = totalScripts > 0 ? Math.round((publishedTotal / totalScripts) * 100) : 0;

  const velocityDelta = scriptsLast30 - scriptsPrev30;
  const maxClientCount = topClients[0]?.count ?? 1;

  const now = new Date();
  const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const currentMonth = MONTHS[now.getMonth()];

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <p className="eyebrow">Resumen</p>
          <h2 className={s.title}>Dashboard</h2>
        </div>
        {igAccounts > 0 && (
          <div className={s.igPill}>
            <span className={s.igDot} />
            <span className={s.igLabel}>{igAccounts} cuenta{igAccounts !== 1 ? "s" : ""} IG conectada{igAccounts !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* ── Guiones por estado ── */}
      <div className={s.section}>
        <p className={s.sectionTitle}>Guiones por estado</p>
        <div className={s.statGrid}>
          {SCRIPT_STATUS_ORDER.map((status) => {
            const count = scriptsByStatus[status] ?? 0;
            return (
              <div key={status} className={`card ${s.statCard}`}>
                <span
                  className={s.statCount}
                  style={{ color: STATUS_COLORS[status] }}
                >
                  {count}
                </span>
                <span className={s.statLabel}>{STATUS_LABELS[status]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className={s.section}>
        <p className={s.sectionTitle}>Indicadores clave</p>
        <div className={s.kpiRow}>
          <div className={`card ${s.kpiCard}`}>
            <span className={s.kpiValue}>{totalScripts}</span>
            <span className={s.kpiLabel}>Guiones en total</span>
          </div>
          <div className={`card ${s.kpiCard}`}>
            <span className={s.kpiValue}>{scriptsLast30}</span>
            <span className={s.kpiLabel}>Guiones últimos 30 días</span>
            {scriptsPrev30 > 0 || scriptsLast30 > 0 ? (
              <span
                className={`${s.kpiTrend} ${
                  velocityDelta > 0
                    ? s.kpiTrendUp
                    : velocityDelta < 0
                    ? s.kpiTrendDown
                    : s.kpiTrendNeutral
                }`}
              >
                {velocityDelta > 0 ? "+" : ""}{velocityDelta} vs mes anterior
              </span>
            ) : null}
          </div>
          <div className={`card ${s.kpiCard}`}>
            <span className={s.kpiValue}>{publicationRate}%</span>
            <span className={s.kpiLabel}>Tasa de publicación</span>
            <span className={s.kpiTrend + " " + s.kpiTrendNeutral}>
              {publishedTotal} de {totalScripts} publicados
            </span>
          </div>
        </div>
      </div>

      {/* ── Top clientes + Ganchos ── */}
      <div className={s.twoCol}>
        <div className={s.section}>
          <p className={s.sectionTitle}>Top clientes por guiones</p>
          {topClients.length === 0 ? (
            <p className={s.emptyHint}>Sin clientes con guiones aún.</p>
          ) : (
            <div className={s.clientList}>
              {topClients.map((c) => (
                <div key={c.id} className={`card ${s.clientRow}`}>
                  <span className={s.clientName}>
                    {c.nombre}
                    {c.marca ? (
                      <span className={s.clientMarca}> · {c.marca}</span>
                    ) : null}
                  </span>
                  <div className={s.clientBar}>
                    <div
                      className={s.clientBarFill}
                      style={{ width: `${Math.round((c.count / maxClientCount) * 100)}%` }}
                    />
                  </div>
                  <span className={s.clientCount}>{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={s.section}>
          <p className={s.sectionTitle}>Ganchos</p>
          <div className={`card ${s.hooksSummary}`}>
            <span className={s.hooksNumber}>{totalHooks}</span>
            <span className={s.hooksLabel}>
              {totalHooks === 1 ? "gancho asignado" : "ganchos asignados a guiones"}
            </span>
            {totalHooks === 0 && (
              <span className={s.emptyHint}>
                Asigna ganchos desde la ficha de cada guión.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Calendario este mes ── */}
      <div className={s.section}>
        <p className={s.sectionTitle}>Calendario — {currentMonth}</p>
        <div className={s.twoCol}>
          <div className={`card ${s.calSummary}`}>
            {CAL_STATUS_ORDER.map((status) => {
              const count = calendarByStatus[status] ?? 0;
              return (
                <div key={status} className={s.calRow}>
                  <span
                    className={s.calStatusDot}
                    style={{ background: CAL_STATUS_COLORS[status] }}
                  />
                  <span className={s.calStatusLabel}>{CAL_STATUS_LABELS[status]}</span>
                  <span className={s.calStatusCount}>{count}</span>
                </div>
              );
            })}
          </div>
          <div className={`card ${s.kpiCard}`}>
            <span className={s.kpiValue} style={{ color: "var(--emerald)" }}>
              {publishedThisMonth}
            </span>
            <span className={s.kpiLabel}>
              Publicados en {currentMonth}
            </span>
            <Link
              href="/calendario"
              style={{
                fontSize: 12,
                color: "var(--emerald)",
                textDecoration: "none",
                opacity: 0.8,
                marginTop: 4,
                display: "inline-block",
              }}
            >
              Ver calendario →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
