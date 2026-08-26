/**
 * `/portal/[clientId]/guiones/[scriptId]` — el guion completo, con comentarios
 * y aprobación (Fase D, etapa 5).
 *
 * Candado 2: revalida el flag `guiones`. Que el guion sea de ESTA marca se
 * chequea a mano además de la RLS — si no, `/portal/<marca-A>/guiones/<id-de-B>`
 * mostraría un guion de otra marca a alguien que tiene acceso a las dos.
 *
 * Lo interactivo (caja de comentario, botón de aprobar) vive en
 * `ScriptFeedback.tsx`. Desde la etapa 8 el guion también es interactivo —un
 * `collaborator` puede editar el texto— así que se dibuja en
 * `ScriptEditorPanel.tsx`, que envuelve al mismo `ScriptBody` compartido.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalClient, requirePortalSession } from "@/lib/portal/access";
import { listScriptComments } from "@/lib/portal/comments";
import { getClientOwnerId, getGenerationState } from "@/lib/portal/generate";
import { hasFeature, AI_FEATURE_SLUG } from "@/lib/portal/features";
import { loadCopies, loadCovers } from "@/lib/portal/scriptTools";
import { OWNER_FALLBACK_LABEL, UNKNOWN_AUTHOR_LABEL } from "@/lib/portal/profiles";
import ScriptActions from "./ScriptActions";
import ScriptEditorPanel from "./ScriptEditorPanel";
import ScriptToolsPanel from "./ScriptToolsPanel";
import ScriptFeedback from "./ScriptFeedback";
import s from "../guiones.module.css";

const TYPE_LABELS: Record<string, string> = { reel: "Reel", carousel: "Carrusel" };

const STATUS_LABELS: Record<string, string> = {
  preproduccion: "En preparación",
  produccion: "En producción",
  listo: "Listo para grabar",
  publicado: "Publicado",
};

type ScriptRow = {
  id: string;
  client_id: string;
  type: string | null;
  title: string | null;
  brief: string | null;
  status: string;
  content: Record<string, unknown> | null;
  created_at: string;
  client_approved_at: string | null;
  source_post_permalink: string | null;
};

export default async function PortalGuionDetallePage({
  params,
}: {
  params: Promise<{ clientId: string; scriptId: string }>;
}) {
  const { clientId, scriptId } = await params;
  const { supabase, user } = await requirePortalSession();
  const client = await requirePortalClient(user.id, clientId, "guiones");

  const { data } = await supabase
    .from("scripts")
    .select(
      "id, client_id, type, title, brief, status, content, created_at, client_approved_at, source_post_permalink",
    )
    .eq("id", scriptId)
    .eq("client_id", client.id)
    .maybeSingle();

  if (!data) notFound();
  const script = data as ScriptRow;

  // El dueño de la marca se resuelve con service role (el miembro no puede leer
  // `clients`) solo para saber cuál de los autores es "el equipo". Si falla, los
  // comentarios se siguen mostrando: cae a la etiqueta genérica.
  const ownerId = await getClientOwnerId(client.id).catch(() => undefined);
  const comments = await listScriptComments(supabase, script.id, user.id, ownerId);

  // Portadas y copy solo con el add-on prendido: las dos llaman a la IA y
  // gastan el mismo cupo que generar un guion (etapa 8). Todo lo de esta tanda
  // se lee con service role — `script_covers` y `script_copies` quedaron
  // owner-only en `0006`— y se degrada a vacío si algo falla: son un extra, no
  // el guion.
  const canUseAi = hasFeature(client.features, AI_FEATURE_SLUG);
  const [covers, copies, aiUsage] = canUseAi
    ? await Promise.all([
        loadCovers(script.id).catch(() => null),
        loadCopies(script.id).catch(() => []),
        ownerId
          ? getGenerationState(client.id, ownerId, client.aiGenerationLimit).catch(() => null)
          : Promise.resolve(null),
      ])
    : [null, [], null];

  return (
    <div className={s.detail}>
      <Link href={`/portal/${client.id}/guiones`} className={s.back}>
        ← Todos los guiones
      </Link>

      <div className={s.detailHead}>
        <div className={s.cardTop}>
          <span className={s.type}>
            {TYPE_LABELS[script.type ?? ""] ?? script.type ?? "Guion"}
          </span>
          <span className={s.status}>{STATUS_LABELS[script.status] ?? script.status}</span>
        </div>
        <h2 className={s.detailTitle}>
          {script.title || script.brief || "Guion sin título"}
        </h2>
        {script.title && script.brief && <p className={s.brief}>{script.brief}</p>}
      </div>

      {/*
        Editable para el rol `collaborator` (etapa 8): la policy
        `scripts_member_update` lo permite desde `0006`, pero no había pantalla.
        Un `viewer` recibe el mismo guion sin botón de editar.
      */}
      <ScriptEditorPanel
        clientId={client.id}
        scriptId={script.id}
        content={script.content}
        type={script.type}
        canEdit={client.role !== "viewer"}
      />

      <ScriptActions
        content={script.content}
        type={script.type}
        title={script.title || script.brief || "guion"}
      />

      {script.source_post_permalink && (
        <p className={s.sourceNote}>
          Este guion se inspiró en{" "}
          <a
            href={script.source_post_permalink}
            target="_blank"
            rel="noopener noreferrer"
            className={s.sourceLink}
          >
            una publicación de tu competencia ↗
          </a>
        </p>
      )}

      {canUseAi && (
        <ScriptToolsPanel
          clientId={client.id}
          scriptId={script.id}
          initialCovers={covers}
          initialCopies={copies}
          initialRemaining={aiUsage?.remaining ?? null}
          creditBalance={aiUsage?.creditBalance ?? 0}
        />
      )}

      <ScriptFeedback
        clientId={client.id}
        scriptId={script.id}
        approvedAt={script.client_approved_at}
        canApprove={client.role !== "viewer"}
        comments={comments.map((c) => ({
          id: c.id,
          // Nunca el email (etapa 8): hasta la 7 el cliente veía la dirección
          // personal de quien le contestaba. El nombre sale de
          // `portal_profiles`; si esa persona todavía no eligió uno, va una
          // etiqueta genérica.
          author: c.isMine
            ? "Tú"
            : (c.authorName ?? (c.isOwner ? OWNER_FALLBACK_LABEL : UNKNOWN_AUTHOR_LABEL)),
          body: c.body,
          createdAt: c.createdAt,
        }))}
      />
    </div>
  );
}
