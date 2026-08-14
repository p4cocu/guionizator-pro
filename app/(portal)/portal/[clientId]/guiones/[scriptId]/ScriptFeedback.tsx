"use client";

/**
 * Comentarios + aprobación de un guion, del lado del cliente.
 *
 * Las dos server actions van con `try/catch` y mensaje en línea (regla dura de
 * `CLAUDE.md`): un action de mutación sin capturar tumba la página entera con
 * el "This page couldn't load". Acá, además, `setScriptApproval` puede devolver
 * `{ ok: false }` sin lanzar — un `viewer` no tiene permiso de aprobar — así que
 * hay que mirar el resultado, no solo el catch.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postScriptComment, setScriptApproval } from "../actions";
import s from "../guiones.module.css";

type Comment = {
  id: string;
  author: string;
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

export default function ScriptFeedback({
  clientId,
  scriptId,
  approvedAt,
  canApprove,
  comments,
}: {
  clientId: string;
  scriptId: string;
  approvedAt: string | null;
  canApprove: boolean;
  comments: Comment[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = body.trim();
    if (!texto || saving) return;

    setSaving(true);
    setError(null);
    try {
      const res = await postScriptComment(clientId, scriptId, texto);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBody("");
      startTransition(() => router.refresh());
    } catch {
      setError("No se pudo enviar el comentario. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function aprobar(valor: boolean) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await setScriptApproval(clientId, scriptId, valor);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={s.feedback}>
      <div className={s.approvalBox}>
        {approvedAt ? (
          <>
            <p className={s.approvalState}>
              <span className={s.approved}>✓ Aprobado</span> el {formatWhen(approvedAt)}
            </p>
            {canApprove && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => aprobar(false)}
                disabled={saving}
              >
                Quitar aprobación
              </button>
            )}
          </>
        ) : (
          <>
            <p className={s.approvalState}>
              {canApprove
                ? "¿Está como lo quieres? Apruébalo y lo mandamos a grabar."
                : "Este guion todavía no está aprobado."}
            </p>
            {canApprove && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => aprobar(true)}
                disabled={saving}
              >
                {saving ? "Guardando…" : "Aprobar guion"}
              </button>
            )}
          </>
        )}
      </div>

      <h3 className={s.commentsTitle}>
        Comentarios{comments.length > 0 ? ` (${comments.length})` : ""}
      </h3>

      {comments.length === 0 ? (
        <p className={s.commentsEmpty}>
          Todavía no hay comentarios. Si quieres cambiar algo —una frase, el
          gancho, el cierre— escríbelo acá y queda anotado en el guion.
        </p>
      ) : (
        <ul className={s.comments}>
          {comments.map((c) => (
            <li key={c.id} className={s.comment}>
              <div className={s.commentHead}>
                <span className={s.commentAuthor}>{c.author}</span>
                <span className={s.commentDate}>{formatWhen(c.createdAt)}</span>
              </div>
              <p className={s.commentBody}>{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={enviar} className={s.commentForm}>
        <label className="field-label" htmlFor="nuevo-comentario">
          Dejar un comentario
        </label>
        <textarea
          id="nuevo-comentario"
          className="textarea"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ej: el gancho me gusta, pero el cierre lo haría más directo."
          maxLength={4000}
        />
        {error && <p className={s.error}>{error}</p>}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || pending || !body.trim()}
        >
          {saving ? "Enviando…" : "Enviar comentario"}
        </button>
      </form>
    </div>
  );
}
