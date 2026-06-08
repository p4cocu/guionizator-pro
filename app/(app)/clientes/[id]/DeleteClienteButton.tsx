"use client";

import { useState, useTransition } from "react";
import { deleteCliente } from "../actions";
import s from "../clientes.module.css";

export default function DeleteClienteButton({ clienteId }: { clienteId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(() => deleteCliente(clienteId));
  }

  return (
    <div className={s.dangerSection}>
      <p className={s.dangerTitle}>Zona de peligro</p>
      <p className={s.dangerText}>
        Eliminar este cliente borrará también toda su investigación y no hay vuelta atrás.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="btn btn-ghost"
          style={{
            color: "var(--flare)",
            borderColor: "rgba(255,111,97,0.3)",
            fontSize: 13,
          }}
        >
          {isPending ? "Eliminando…" : confirming ? "Sí, eliminar" : "Eliminar cliente"}
        </button>
        {confirming && !isPending && (
          <button
            onClick={() => setConfirming(false)}
            className="btn btn-ghost"
            style={{ fontSize: 13 }}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
