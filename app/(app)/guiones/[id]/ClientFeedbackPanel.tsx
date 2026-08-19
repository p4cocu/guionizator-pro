"use client";

/**
 * Panel "Feedback del cliente" al pie de `/guiones/[id]` (Fase D, etapa 5).
 *
 * Va como hermano de `ScriptDetailClient` y no adentro: ese componente ya es
 * enorme y meterle esto obligaría a enhebrar props por media pantalla. Acá el
 * acoplamiento es cero — recibe lo que el server ya cargó.
 *
 * Se dibuja **solo si hay algo que mostrar** (comentarios o una aprobación): un
 * bloque vacío en cada guion, cuando la mayoría de las marcas todavía no tienen
 * portal, sería ruido permanente.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replyToScriptComment } from "./feedbackActions";
import s from "./feedback.module.css";

type Comment = {
  id: string;
  author: string;
  isMine: boolean;
  body: string;
  createdAt: string;
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ClientFeedbackPanel({
  scriptId,
  clientId,
  approvedAt,
  lastClientEdit,
  comments,
}: {
  scriptId: string;
  clientId: string;
  approvedAt: string | null;
  /** Última edición hecha desde el portal (etapa 8). `null` si solo editaste vos. */
  lastClientEdit: { author: string; at: string; afterApproval: boolean } | null;
  comments: Comment[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function responder(e: React.FormEvent) {
    e.preventDefault();
    const texto = body.trim();
    if (!texto || saving) return;

    setSaving(true);
    setError(null);
    try {
      const res = await replyToScriptComment(scriptId, clientId, texto);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBody("");
      startTransition(() => router.refresh());
    } catch {
      setError("No se pudo enviar la respuesta. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={s.panel}>
      <div className={s.head}>
        <h2 className={s.title}>Feedback del cliente</h2>
        {approvedAt ? (
          <span className={s.approved}>✓ Aprobado el {formatWhen(approvedAt)}</span>
        ) : (
          <span className={s.pending}>Sin aprobar</span>
        )}
      </div>

      {/*
        Desde la etapa 8 el cliente puede editar el texto del guion, así que
        hace falta que se note: si no, Paco graba una versión que el cliente ya
        cambió. El aviso sube de tono cuando la edición fue DESPUÉS de aprobar.
      */}
      {lastClientEdit && (
        <p className={lastClientEdit.afterApproval ? s.editedWarn : s.edited}>
          ✎ {lastClientEdit.author} editó el texto el {formatWhen(lastClientEdit.at)}
          {lastClientEdit.afterApproval ? " — después de aprobarlo, conviene releerlo." : "."}
        </p>
      )}

      {comments.length === 0 ? (
        <p className={s.empty}>
          Todavía no comentó nada. Cuando lo haga desde su portal, aparece acá.
        </p>
      ) : (
        <ul className={s.comments}>
          {comments.map((c) => (
            <li key={c.id} className={`${s.comment} ${c.isMine ? s.mine : ""}`}>
              <div className={s.commentHead}>
                <span className={s.author}>{c.author}</span>
                <span className={s.date}>{formatWhen(c.createdAt)}</span>
              </div>
              <p className={s.body}>{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={responder} className={s.form}>
        <textarea
          className="textarea"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Responder al cliente…"
          maxLength={4000}
        />
        {error && <p className={s.error}>{error}</p>}
        <button
          type="submit"
          className="btn btn-secondary"
          disabled={saving || !body.trim()}
        >
          {saving ? "Enviando…" : "Responder"}
        </button>
      </form>
    </section>
  );
}
