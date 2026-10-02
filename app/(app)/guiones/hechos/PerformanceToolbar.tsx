"use client";

/**
 * Barra de "Hechos" (0022): actualizar las métricas de todo lo vinculado y
 * filtrar a lo que funcionó. El filtro es un link (`?funciono=1`), no estado:
 * así sobrevive a recargar y se combina con los demás filtros de la URL.
 */

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { refreshIgMetrics } from "../rendimiento/actions";
import styles from "../guiones.module.css";

export default function PerformanceToolbar({
  clientId,
  workedCount,
  onlyWorked,
  toggleHref,
}: {
  clientId?: string;
  workedCount: number;
  onlyWorked: boolean;
  toggleHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await refreshIgMetrics(clientId);
      if (!res.ok) setMsg(res.error);
      else if (res.errors.length) setMsg(res.errors[0]);
      else setMsg(res.updated ? `${res.updated} guion${res.updated !== 1 ? "es" : ""} medido${res.updated !== 1 ? "s" : ""}.` : "No hay guiones vinculados a su post todavía.");
      router.refresh();
    } catch {
      setMsg("No se pudieron actualizar las métricas.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.perfToolbar}>
      <button className="btn btn-secondary" onClick={refresh} disabled={busy}>
        {busy ? "Actualizando…" : "Actualizar métricas"}
      </button>
      <Link href={toggleHref} className={`btn ${onlyWorked ? "btn-primary" : "btn-ghost"}`}>
        🔥 Solo lo que funcionó ({workedCount})
      </Link>
      {msg && <span className={styles.perfToolbarMsg}>{msg}</span>}
    </div>
  );
}
