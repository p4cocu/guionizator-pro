"use client";

/**
 * El guion del portal, con modo lectura y modo edición (Fase D, etapa 8).
 *
 * Hasta la etapa 7 esta pantalla era de solo lectura: la policy
 * `scripts_member_update` existía desde `0006` pero nunca se había construido
 * la UI. Ahora un `collaborator` corrige el texto acá mismo, en vez de dejar un
 * comentario para que Paco lo transcriba.
 *
 * - **Solo texto** (voz en off / titular y cuerpo de cada slide). El porqué
 *   está en `lib/portal/scriptEdit.ts`.
 * - **Un `viewer` no ve el botón**, y si llegara igual a la action, la action
 *   lo rechaza con un mensaje (no con un error de servidor).
 * - La action va con `try/catch` y error en línea: una mutación sin capturar
 *   tumba la página entera (regla dura de `CLAUDE.md`).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ScriptBody from "@/components/portal/ScriptBody";
import ScriptTextEditor from "@/components/portal/ScriptTextEditor";
import {
  applyTextDraft,
  draftChanged,
  isEditableDraft,
  toTextDraft,
  type ScriptTextDraft,
} from "@/lib/portal/scriptEdit";
import { updateScriptText } from "../actions";
import s from "../guiones.module.css";

export default function ScriptEditorPanel({
  clientId,
  scriptId,
  content,
  type,
  canEdit,
}: {
  clientId: string;
  scriptId: string;
  content: Record<string, unknown> | null;
  type: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const original = toTextDraft(content, type);

  const [draft, setDraft] = useState<ScriptTextDraft>(original);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const [, startTransition] = useTransition();

  const editable = canEdit && isEditableDraft(original);
  const dirty = draftChanged(original, draft);

  function cancel() {
    setDraft(original);
    setEditing(false);
    setError(null);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await updateScriptText(clientId, scriptId, draft);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 3000);
      startTransition(() => router.refresh());
    } catch {
      setError("No se pudieron guardar los cambios. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {editable && (
        <div className={s.editBar}>
          {editing ? (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancel}
                disabled={saving}
              >
                Descartar cambios
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={save}
                disabled={saving || !dirty}
              >
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </>
          ) : (
            <>
              {savedNote && <span className={s.editSaved}>✓ Cambios guardados</span>}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing(true)}
              >
                ✎ Editar el texto
              </button>
            </>
          )}
        </div>
      )}

      {editing ? (
        <article className={s.script}>
          <ScriptTextEditor draft={draft} onChange={setDraft} disabled={saving} />
        </article>
      ) : (
        <ScriptBody
          // Mientras no se recarga la página, lo que se muestra es el borrador
          // ya guardado: `router.refresh()` puede tardar y ver el texto viejo
          // después de guardar se lee como que no se guardó.
          content={applyTextDraft(content, draft)}
          type={type}
        />
      )}

      {error && <p className={s.error}>{error}</p>}
    </>
  );
}
