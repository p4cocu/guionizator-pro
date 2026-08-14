/**
 * `/portal/[clientId]/guiones/[scriptId]` — el guion completo, con comentarios
 * y aprobación (Fase D, etapa 5).
 *
 * Candado 2: revalida el flag `guiones`. Que el guion sea de ESTA marca se
 * chequea a mano además de la RLS — si no, `/portal/<marca-A>/guiones/<id-de-B>`
 * mostraría un guion de otra marca a alguien que tiene acceso a las dos.
 *
 * Lo interactivo (caja de comentario, botón de aprobar) vive en
 * `ScriptFeedback.tsx`; el guion en sí se dibuja en el server, que es lo pesado.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalClient, requirePortalSession } from "@/lib/portal/access";
import { listScriptComments } from "@/lib/portal/comments";
import { toScriptView, parseMarkup, type TextChunk } from "@/lib/portal/scriptView";
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

/** Texto con el markdown ligero del editor resuelto a JSX (sin innerHTML). */
function Rich({ text }: { text: string }) {
  return (
    <>
      {parseMarkup(text).map((chunk: TextChunk, i) => {
        if (chunk.bold) return <strong key={i}>{chunk.text}</strong>;
        if (chunk.mark) return <mark key={i}>{chunk.text}</mark>;
        if (chunk.underline) return <em key={i}>{chunk.text}</em>;
        return <span key={i}>{chunk.text}</span>;
      })}
    </>
  );
}

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

  const comments = await listScriptComments(supabase, script.id, user.id);
  const view = toScriptView(script.content, script.type);

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

      <article className={s.script}>
        {view.kind === "empty" && (
          <p className={s.emptyText}>
            Este guion todavía no tiene contenido escrito.
          </p>
        )}

        {view.kind === "reel" && (
          <>
            {view.voiceOff && (
              <section className={s.block}>
                <h3 className={s.blockTitle}>Voz en off</h3>
                <p className={s.voiceOff}>
                  <Rich text={view.voiceOff} />
                </p>
              </section>
            )}

            {view.blocks.map((b, i) => (
              <section key={i} className={s.block}>
                <h3 className={s.blockTitle}>
                  {b.name || `Bloque ${i + 1}`}
                  {b.duration && <span className={s.duration}>{b.duration}</span>}
                </h3>
                {b.lines.map((l, j) => (
                  <p key={j} className={s.line}>
                    {l.tag && <span className={s.tag}>{l.tag}</span>}
                    <Rich text={l.text} />
                  </p>
                ))}
              </section>
            ))}
          </>
        )}

        {view.kind === "carousel" && (
          <div className={s.slides}>
            {view.slides.map((slide) => (
              <section key={slide.number} className={s.slide}>
                <span className={s.slideNumber}>Slide {slide.number}</span>
                <p className={s.slideText}>
                  <Rich text={slide.text} />
                </p>
                {slide.body && (
                  <p className={s.slideBody}>
                    <Rich text={slide.body} />
                  </p>
                )}
                {slide.visual && <p className={s.slideVisual}>Visual: {slide.visual}</p>}
                {slide.microAnchor && (
                  <p className={s.slideAnchor}>{slide.microAnchor}</p>
                )}
              </section>
            ))}
          </div>
        )}
      </article>

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

      <ScriptFeedback
        clientId={client.id}
        scriptId={script.id}
        approvedAt={script.client_approved_at}
        canApprove={client.role !== "viewer"}
        comments={comments.map((c) => ({
          id: c.id,
          author: c.isMine ? "Tú" : (c.authorEmail ?? "Alguien del equipo"),
          body: c.body,
          createdAt: c.createdAt,
        }))}
      />
    </div>
  );
}
