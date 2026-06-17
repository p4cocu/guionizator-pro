"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { ClientOption } from "./actions";
import styles from "./guiones.module.css";

export default function ClientFilter({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const currentCliente = params.get("cliente") ?? "";
  const currentTipo = params.get("tipo") ?? "";

  const navigate = useCallback(
    (cliente: string, tipo: string) => {
      const p = new URLSearchParams();
      if (cliente) p.set("cliente", cliente);
      if (tipo) p.set("tipo", tipo);
      const qs = p.toString();
      router.push(qs ? `/guiones?${qs}` : "/guiones");
    },
    [router]
  );

  return (
    <>
      <select
        className={`input ${styles.clientSelect}`}
        value={currentCliente}
        onChange={(e) => navigate(e.target.value, currentTipo)}
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
        onChange={(e) => navigate(currentCliente, e.target.value)}
      >
        <option value="">Reels y carruseles</option>
        <option value="reel">Solo reels</option>
        <option value="carousel">Solo carruseles</option>
      </select>
    </>
  );
}
