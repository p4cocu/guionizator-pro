"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { ClientOption } from "./actions";
import styles from "./guiones.module.css";

export default function ClientFilter({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("cliente") ?? "";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      const url = val ? `/guiones?cliente=${val}` : "/guiones";
      router.push(url);
    },
    [router]
  );

  return (
    <select
      className={`input ${styles.clientSelect}`}
      value={current}
      onChange={handleChange}
    >
      <option value="">Todos los clientes</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nombre}
        </option>
      ))}
    </select>
  );
}
