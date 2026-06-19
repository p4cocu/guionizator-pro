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
  const currentEstado = params.get("estado") ?? "";

  const navigate = useCallback(
    (cliente: string, tipo: string, estado: string) => {
      const p = new URLSearchParams();
      if (cliente) p.set("cliente", cliente);
      if (tipo) p.set("tipo", tipo);
      if (estado) p.set("estado", estado);
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
        onChange={(e) => navigate(e.target.value, currentTipo, currentEstado)}
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
        onChange={(e) => navigate(currentCliente, e.target.value, currentEstado)}
      >
        <option value="">Reels y carruseles</option>
        <option value="reel">Solo reels</option>
        <option value="carousel">Solo carruseles</option>
      </select>
      <select
        className={`input ${styles.clientSelect}`}
        value={currentEstado}
        onChange={(e) => navigate(currentCliente, currentTipo, e.target.value)}
      >
        <option value="">Todos los estados</option>
        <option value="idea">Solo ideas</option>
        <option value="produccion">En producción</option>
        <option value="activos">Ideas + En producción</option>
        <option value="publicado">Publicados</option>
      </select>
    </>
  );
}
