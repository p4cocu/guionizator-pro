/**
 * `/portal/[clientId]/guiones` — los guiones de la marca.
 *
 * Candado 2: revalida el flag `guiones` antes de consultar.
 *
 * **Qué NO se le muestra al cliente**: los guiones en `idea` (apuntes crudos,
 * todavía no son un guion) y los del `baul` (buenos pero congelados — mostrarlos
 * genera la pregunta "¿y esto cuándo sale?" sin respuesta). Es la misma lógica
 * con la que `getScripts` esconde el baúl en la vista de Paco. Si algún día hay
 * que abrirlos, se cambia acá.
 *
 * Solo se listan las versiones vigentes (`is_latest`): el historial de versiones
 * es una herramienta de taller, no un entregable.
 */

import Link from "next/link";
import { requirePortalClient, requirePortalSession, portalClientLabel } from "@/lib/portal/access";
import { countCommentsByScript } from "@/lib/portal/comments";
import { toScriptView } from "@/lib/portal/scriptView";
import TrashButton from "./TrashButton";
import s from "./guiones.module.css";

/** Estados que el cliente sí ve, en el orden en que se listan. */
const VISIBLE_STATUSES = ["listo", "produccion", "preproduccion", "publicado"];

const STATUS_LABELS: Record<string, string> = {
  preproduccion: "En preparación",
  produccion: "En producción",
  listo: "Listo para grabar",
  publicado: "Publicado",
};

const TYPE_LABELS: Record<string, string> = {
  reel: "Reel",
  carousel: "Carrusel",
};

type ScriptRow = {
  id: string;
  type: string | null;
  title: string | null;
  brief: string | null;
  status: string;
  content: Record<string, unknown> | null;
  created_at: string;
  client_approved_at: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Primera línea con texto del guion: sirve de resumen en la tarjeta. */
function preview(row: ScriptRow): string {
  const view = toScriptView(row.content, row.type);
  const raw =
    view.kind === "reel"
      ? view.voiceOff || view.blocks.flatMap((b) => b.lines).map((l) => l.text)[0] || ""
      : view.kind === "carousel"
        ? view.slides[0]?.text ?? ""
        : "";
  const clean = raw.replace(/\*\*|==|_/g, "").split("\n")[0]?.trim() ?? "";
  return clean.length > 150 ? clean.slice(0, 147) + "…" : clean;
}

export default async function PortalGuionesPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { supabase, user } = await requirePortalSession();
  const client = await requirePortalClient(user.id, clientId, "guiones");

  const { data } = await supabase
    .from("scripts")
    .select("id, type, title, brief, status, content, created_at, client_approved_at")
    .eq("client_id", client.id)
    .eq("is_latest", true)
    .is("trashed_at", null)
    .in("status", VISIBLE_STATUSES)
    .order("created_at", { ascending: false });

  const scripts = (data ?? []) as ScriptRow[];
  const comments = await countCommentsByScript(
    supabase,
    scripts.map((x) => x.id),
  );

  const pendientes = scripts.filter((x) => !x.client_approved_at).length;

  return (
    <div>
      <div className={s.header}>
        <span className="eyebrow">{portalClientLabel(client)}</span>
        <h2 className={s.title}>Guiones</h2>
        <p className={s.subtitle}>
          Los guiones listos para tu marca. Ábrelos para leerlos completos, dejar
          comentarios con lo que quieras cambiar y aprobarlos cuando estén como
          los quieres.
          {pendientes > 0 && (
            <>
              {" "}
              <strong>{pendientes}</strong>{" "}
              {pendientes === 1 ? "está esperando" : "están esperando"} tu visto bueno.
            </>
          )}
        </p>
      </div>

      {scripts.length === 0 ? (
        <div className={s.empty}>
          <p className={s.emptyTitle}>Todavía no hay guiones</p>
          <p className={s.emptyText}>
            En cuanto haya un guion listo para tu marca, aparece en esta pantalla.
          </p>
        </div>
      ) : (
        <div className={s.list}>
          {scripts.map((x) => {
            const n = comments.get(x.id) ?? 0;
            return (
              <Link
                key={x.id}
                href={`/portal/${client.id}/guiones/${x.id}`}
                className={`${s.card} ${x.client_approved_at ? s.cardApproved : ""}`}
              >
                <div className={s.cardTop}>
                  <span className={s.type}>{TYPE_LABELS[x.type ?? ""] ?? x.type ?? "Guion"}</span>
                  <span className={s.status}>{STATUS_LABELS[x.status] ?? x.status}</span>
                </div>

                <h3 className={s.cardTitle}>{x.title || x.brief || "Guion sin título"}</h3>

                {preview(x) && <p className={s.preview}>{preview(x)}</p>}

                <div className={s.cardMeta}>
                  <span>{formatDate(x.created_at)}</span>
                  {n > 0 && (
                    <span>
                      💬 {n} comentario{n === 1 ? "" : "s"}
                    </span>
                  )}
                  {x.client_approved_at ? (
                    <span className={s.approved}>✓ Aprobado</span>
                  ) : (
                    <span className={s.pending}>Sin aprobar</span>
                  )}
                  <TrashButton clientId={client.id} scriptId={x.id} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
