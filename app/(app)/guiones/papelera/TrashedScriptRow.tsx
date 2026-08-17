"use client";

import { useState, useTransition } from "react";
import { restoreScriptFromTrash, permanentlyDeleteScript, type TrashedScriptRow as Row } from "../actions";
import s from "./papelera.module.css";

const TYPE_LABELS: Record<string, string> = { reel: "Reel", carousel: "Carrusel" };

export default function TrashedScriptRow({ script, daysLeft }: { script: Row; daysLeft: number }) {
  const [hidden, setHidden] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function restore() {
    setError(null);
    startTransition(async () => {
      try {
        await restoreScriptFromTrash(script.id);
        setHidden(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo restaurar.");
      }
    });
  }

  function deleteForever() {
    setError(null);
    startTransition(async () => {
      try {
        await permanentlyDeleteScript(script.id);
        setHidden(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo borrar.");
      }
    });
  }

  if (hidden) return null;

  return (
    <div className={s.row}>
      <div className={s.info}>
        <div className={s.meta}>
          <span className={s.type}>{TYPE_LABELS[script.type] ?? script.type}</span>
          {script.clients && (
            <span className={s.client}>{script.clients.marca || script.clients.nombre}</span>
          )}
          <span className={s.days}>
            {daysLeft === 0 ? "se borra hoy" : `se borra en ${daysLeft} día${daysLeft === 1 ? "" : "s"}`}
          </span>
        </div>
        <p className={s.title}>{script.title || script.brief || script.structure_name}</p>
      </div>

      <div className={s.actions}>
        {confirmingDelete ? (
          <>
            <button
              type="button"
              className={s.deleteConfirmBtn}
              onClick={deleteForever}
              disabled={pending}
            >
              {pending ? "…" : "Confirmar borrado"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirmingDelete(false)}
              disabled={pending}
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" onClick={restore} disabled={pending}>
              ↩ Restaurar
            </button>
            <button
              type="button"
              className={s.deleteBtn}
              onClick={() => setConfirmingDelete(true)}
              disabled={pending}
            >
              Borrar ya
            </button>
          </>
        )}
      </div>

      {error && <p className={s.error}>{error}</p>}
    </div>
  );
}
