"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteCliente } from "./actions";
import s from "./clientes.module.css";

type Props = {
  id: string;
  nombre: string;
  marca: string | null;
  nicho: string | null;
  tono: string | null;
  completeness: number;
};

function completenessBarClass(pct: number) {
  if (pct >= 67) return s.barHigh;
  if (pct >= 34) return s.barMid;
  return s.barLow;
}

function completenessColor(pct: number) {
  if (pct >= 67) return "var(--emerald)";
  if (pct >= 34) return "var(--signal)";
  return "var(--flare)";
}

export default function ClienteCard({
  id,
  nombre,
  marca,
  nicho,
  tono,
  completeness,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(() => deleteCliente(id));
  }

  return (
    <div className={`card ${s.card}`}>
      <div className={s.cardHeader}>
        <div>
          <p className={s.cardName}>{nombre}</p>
          {marca && <p className={s.cardMarca}>{marca}</p>}
        </div>
        <div className={s.cardActions}>
          <Link href={`/clientes/${id}`} className="btn btn-ghost" style={{ fontSize: 13, padding: "6px 12px" }}>
            Editar
          </Link>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="btn btn-ghost"
            style={{
              fontSize: 13,
              padding: "6px 12px",
              color: confirming ? "var(--flare)" : undefined,
              borderColor: confirming ? "rgba(255,111,97,0.4)" : undefined,
            }}
          >
            {isPending ? "…" : confirming ? "¿Seguro?" : "Eliminar"}
          </button>
          {confirming && !isPending && (
            <button
              onClick={() => setConfirming(false)}
              className="btn btn-ghost"
              style={{ fontSize: 13, padding: "6px 12px" }}
            >
              No
            </button>
          )}
        </div>
      </div>

      <div className={s.cardChips}>
        {nicho && <span className={s.chip}>{nicho}</span>}
        {tono && <span className={s.chip}>{tono}</span>}
      </div>

      <div className={s.completeness}>
        <div className={s.completenessMeta}>
          <span className={s.completenessLabel}>Perfil completo</span>
          <span
            className={s.completenessValue}
            style={{ color: completenessColor(completeness) }}
          >
            {completeness}%
          </span>
        </div>
        <div className={s.completenessTrack}>
          <div
            className={`${s.completenessBar} ${completenessBarClass(completeness)}`}
            style={{ width: `${completeness}%` }}
          />
        </div>
      </div>
    </div>
  );
}
