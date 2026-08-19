/**
 * `/portal/[clientId]/calendario` — el plan de contenido del mes, solo lectura.
 *
 * Candado 2: revalida el flag `calendario` antes de consultar.
 *
 * Sin componente cliente: la navegación entre meses son `<Link>` con
 * `?month=&year=`, así que esta pantalla no manda una línea de JS al browser.
 * La de Paco (`/calendario`) sí es interactiva porque ahí se arrastra, se edita
 * y se generan ideas con IA; acá no hay nada que mutar.
 *
 * Las etiquetas de estado son distintas a las internas a propósito: "Etapa 0"
 * es jerga del taller y no le dice nada al cliente.
 *
 * Desde la etapa 9 la tarjeta **se abre** cuando esa pieza ya tiene guion y el
 * cliente puede verlo: linkea a `/portal/[clientId]/guiones/[id]`. Antes no
 * pasaba nada al hacer clic y parecía roto. Las que no tienen guion visible
 * siguen sin ser clicables — y se nota, porque no llevan la marca de "Ver el
 * guion".
 */

import Link from "next/link";
import { requirePortalClient, requirePortalSession, portalClientLabel } from "@/lib/portal/access";
import { hasFeature } from "@/lib/portal/features";
import s from "./calendario.module.css";

/**
 * Los mismos estados que lista `/portal/[clientId]/guiones`. Si el guion de la
 * pieza está en `idea` o en el baúl, la tarjeta no linkea: el portal esconde
 * esos dos a propósito y un link acá los dejaría entrar por la ventana.
 */
const VISIBLE_SCRIPT_STATUSES = ["listo", "produccion", "preproduccion", "publicado"];

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const FORMAT_LABELS: Record<string, string> = {
  reel: "Reel",
  carrusel: "Carrusel",
  post_texto: "Post de texto",
  story: "Story",
};

/** Espeja el CHECK de `content_calendar.status`, con palabras para el cliente. */
const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  etapa0: "En preparación",
  produccion: "En producción",
  publicado: "Publicado",
};

const STATUS_COLORS: Record<string, string> = {
  idea: "var(--text-dim)",
  etapa0: "var(--signal)",
  produccion: "var(--emerald)",
  publicado: "rgba(0,159,125,0.6)",
};

type Entry = {
  id: string;
  script_id: string | null;
  title: string;
  format: string;
  status: string;
  pillar: string | null;
  week_number: number | null;
  publish_date: string | null;
  brief: string | null;
  weekly_theme: string | null;
};

function shiftMonth(month: number, year: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso + "T00:00:00").toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
}

export default async function PortalCalendarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { clientId } = await params;
  const sp = await searchParams;
  const { supabase, user } = await requirePortalSession();
  const client = await requirePortalClient(user.id, clientId, "calendario");

  const now = new Date();
  // Un `?month=abc` no puede tumbar la página: cae al mes actual.
  const parsedMonth = Number(sp.month);
  const parsedYear = Number(sp.year);
  const month =
    Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : now.getMonth() + 1;
  const year =
    Number.isInteger(parsedYear) && parsedYear >= 2020 && parsedYear <= 2100
      ? parsedYear
      : now.getFullYear();

  const { data } = await supabase
    .from("content_calendar")
    .select("id, script_id, title, format, status, pillar, week_number, publish_date, brief, weekly_theme")
    .eq("client_id", client.id)
    .eq("month", month)
    .eq("year", year)
    .order("week_number", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true });

  const entries = (data ?? []) as Entry[];

  // ── Guion de cada pieza ──
  //
  // ⚠️ `content_calendar.script_id` apunta a la fila que existía cuando se creó
  // la entrada, y guardar una versión crea una fila NUEVA (`parent_id` = raíz,
  // `is_latest` en la última). Sin resolver la cadena, la mitad de las piezas
  // linkearían a la primera versión. Se traen todas las filas de la marca de
  // una vez (son decenas) y se resuelve en memoria.
  const puedeVerGuiones = hasFeature(client.features, "guiones");
  const scriptByEntry = new Map<string, string>();

  if (puedeVerGuiones && entries.some((e) => e.script_id)) {
    const { data: scriptRows } = await supabase
      .from("scripts")
      .select("id, parent_id, is_latest, status, trashed_at")
      .eq("client_id", client.id);

    const rows = (scriptRows ?? []) as {
      id: string;
      parent_id: string | null;
      is_latest: boolean;
      status: string;
      trashed_at: string | null;
    }[];

    const byId = new Map(rows.map((r) => [r.id, r]));
    const latestByRoot = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      if (r.is_latest) latestByRoot.set(r.parent_id ?? r.id, r);
    }

    for (const e of entries) {
      if (!e.script_id) continue;
      const linked = byId.get(e.script_id);
      if (!linked) continue;
      const vigente = latestByRoot.get(linked.parent_id ?? linked.id) ?? linked;
      if (vigente.trashed_at) continue;
      if (!VISIBLE_SCRIPT_STATUSES.includes(vigente.status)) continue;
      scriptByEntry.set(e.id, vigente.id);
    }
  }

  const weeks = new Map<number | null, Entry[]>();
  for (const e of entries) {
    const arr = weeks.get(e.week_number) ?? [];
    arr.push(e);
    weeks.set(e.week_number, arr);
  }

  const prev = shiftMonth(month, year, -1);
  const next = shiftMonth(month, year, 1);
  const base = `/portal/${client.id}/calendario`;

  return (
    <div>
      <div className={s.header}>
        <span className="eyebrow">{portalClientLabel(client)}</span>
        <h2 className={s.title}>Calendario</h2>
        <p className={s.subtitle}>
          Lo que está planeado para tu marca este mes: qué se publica, en qué
          formato y en qué punto va cada pieza.
        </p>
      </div>

      <div className={s.nav}>
        <Link className="btn btn-secondary" href={`${base}?month=${prev.month}&year=${prev.year}`}>
          ← {MONTHS[prev.month - 1]}
        </Link>
        <span className={s.navCurrent}>
          {MONTHS[month - 1]} {year}
        </span>
        <Link className="btn btn-secondary" href={`${base}?month=${next.month}&year=${next.year}`}>
          {MONTHS[next.month - 1]} →
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className={s.empty}>
          <p className={s.emptyTitle}>No hay nada planeado para este mes</p>
          <p className={s.emptyText}>
            Cuando se arme el plan de {MONTHS[month - 1]}, lo vas a ver acá.
            Mientras tanto puedes revisar otros meses con las flechas de arriba.
          </p>
        </div>
      ) : (
        <div className={s.weeks}>
          {[...weeks.entries()].map(([week, items]) => (
            <section key={week ?? "sin"} className={s.week}>
              <div className={s.weekHead}>
                <h3 className={s.weekTitle}>
                  {week ? `Semana ${week}` : "Sin semana asignada"}
                </h3>
                {items[0]?.weekly_theme && (
                  <span className={s.weekTheme}>{items[0].weekly_theme}</span>
                )}
              </div>

              <div className={s.list}>
                {items.map((e) => {
                  const scriptId = scriptByEntry.get(e.id);
                  const cuerpo = (
                    <>
                      <div className={s.entryTop}>
                        <span className={s.format}>
                          {FORMAT_LABELS[e.format] ?? e.format}
                        </span>
                        <span
                          className={s.status}
                          style={{ color: STATUS_COLORS[e.status] ?? "var(--text-dim)" }}
                        >
                          ● {STATUS_LABELS[e.status] ?? e.status}
                        </span>
                      </div>

                      <h4 className={s.entryTitle}>{e.title}</h4>

                      {e.brief && <p className={s.brief}>{e.brief}</p>}

                      <div className={s.entryMeta}>
                        {formatDate(e.publish_date) && <span>{formatDate(e.publish_date)}</span>}
                        {e.pillar && <span>{e.pillar}</span>}
                        {scriptId && <span className={s.entryLink}>Ver el guion →</span>}
                      </div>
                    </>
                  );

                  return scriptId ? (
                    <Link
                      key={e.id}
                      href={`/portal/${client.id}/guiones/${scriptId}`}
                      className={`${s.entry} ${s.entryClickable}`}
                    >
                      {cuerpo}
                    </Link>
                  ) : (
                    <article key={e.id} className={s.entry}>
                      {cuerpo}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
