"use client";

/**
 * "Enviar a la papelera" desde el portal (Fase D, etapa 7).
 *
 * Doble clic para evitar un tirón sin querer: el primer clic no manda nada,
 * solo cambia el botón a "¿Seguro?" / "Cancelar" un rato; recién el segundo
 * clic (sobre "¿Seguro?") llama a la server action. Se autocancela a los 4s si
 * no se confirma, para no dejar el botón en un estado raro colgado.
 *
 * La tarjeta es un `<Link>` (como `StarButton.tsx`): hay que frenar la
 * navegación en cada clic, incluido el de cancelar.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { trashScript } from "./actions";
import s from "./guiones.module.css";

const CONFIRM_WINDOW_MS = 4000;

export default function TrashButton({ clientId, scriptId }: { clientId: string; scriptId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
    return () => clearTimeout(t);
  }, [confirming]);

  function stop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function firstClick(e: React.MouseEvent) {
    stop(e);
    setError(null);
    setConfirming(true);
  }

  function cancel(e: React.MouseEvent) {
    stop(e);
    setConfirming(false);
  }

  function confirm(e: React.MouseEvent) {
    stop(e);
    startTransition(async () => {
      const res = await trashScript(clientId, scriptId);
      if (res.ok) {
        router.refresh();
      } else {
        setConfirming(false);
        setError(res.error);
      }
    });
  }

  if (confirming) {
    return (
      <span className={s.trashConfirm} onClick={stop}>
        <button type="button" className={s.trashConfirmBtn} onClick={confirm} disabled={pending}>
          {pending ? "…" : "¿Seguro? Tirar a la basura"}
        </button>
        <button type="button" className={s.trashCancelBtn} onClick={cancel} disabled={pending}>
          Cancelar
        </button>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className={s.trashBtn}
        onClick={firstClick}
        aria-label="Enviar a la papelera"
        title="Enviar a la papelera"
      >
        🗑
      </button>
      {error && <p className={s.trashError}>{error}</p>}
    </>
  );
}
