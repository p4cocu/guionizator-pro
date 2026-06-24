"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { ClientOption } from "./actions";
import styles from "./guiones.module.css";

const STATUS_PILLS: { value: string; label: string; activeColor: string; textColor: string }[] = [
  { value: "idea",         label: "Idea",           activeColor: "rgba(120,120,140,0.22)", textColor: "var(--text-dim)" },
  { value: "preproduccion",label: "Preproducción",   activeColor: "rgba(82,183,136,0.2)",  textColor: "#52b788" },
  { value: "produccion",   label: "En producción",  activeColor: "rgba(255,210,58,0.18)", textColor: "var(--signal)" },
  { value: "listo",        label: "Listo",          activeColor: "rgba(99,179,237,0.2)",  textColor: "#63b3ed" },
  { value: "publicado",    label: "Publicado",      activeColor: "rgba(0,159,125,0.2)",   textColor: "var(--emerald)" },
];

export default function ClientFilter({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const currentCliente = params.get("cliente") ?? "";
  const currentTipo = params.get("tipo") ?? "";
  const currentEstados = params.getAll("estado");

  const navigate = useCallback(
    (cliente: string, tipo: string, estados: string[]) => {
      const p = new URLSearchParams();
      if (cliente) p.set("cliente", cliente);
      if (tipo) p.set("tipo", tipo);
      estados.forEach((e) => p.append("estado", e));
      const qs = p.toString();
      router.push(qs ? `/guiones?${qs}` : "/guiones");
    },
    [router]
  );

  function toggleEstado(valor: string) {
    const next = currentEstados.includes(valor)
      ? currentEstados.filter((e) => e !== valor)
      : [...currentEstados, valor];
    navigate(currentCliente, currentTipo, next);
  }

  return (
    <>
      <select
        className={`input ${styles.clientSelect}`}
        value={currentCliente}
        onChange={(e) => navigate(e.target.value, currentTipo, currentEstados)}
      >
        <option value="">Todos los clientes</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>

      <select
        className={`input ${styles.clientSelect}`}
        value={currentTipo}
        onChange={(e) => navigate(currentCliente, e.target.value, currentEstados)}
      >
        <option value="">Reels y carruseles</option>
        <option value="reel">Solo reels</option>
        <option value="carousel">Solo carruseles</option>
      </select>

      <div className={styles.statusPills}>
        {STATUS_PILLS.map((s) => {
          const active = currentEstados.includes(s.value);
          return (
            <button
              key={s.value}
              className={styles.statusPill}
              style={active ? { background: s.activeColor, color: s.textColor, borderColor: s.textColor } : {}}
              onClick={() => toggleEstado(s.value)}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
