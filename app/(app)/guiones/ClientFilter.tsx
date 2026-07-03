"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientOption } from "./actions";
import styles from "./guiones.module.css";

const STATUS_OPTIONS = [
  { value: "idea",          label: "Idea",          textColor: "var(--text-dim)" },
  { value: "preproduccion", label: "Preproducción",  textColor: "#52b788" },
  { value: "produccion",    label: "En producción", textColor: "var(--signal)" },
  { value: "listo",         label: "Listo",         textColor: "#63b3ed" },
  { value: "publicado",     label: "Publicado",     textColor: "var(--emerald)" },
  { value: "baul",          label: "Baúl",          textColor: "#9d8ec9" },
];

const LS_KEY = "guionizator_estados_filter";

function buildLabel(estados: string[]) {
  if (estados.length === 0) return "Todos los estados";
  const names = estados.map((e) => STATUS_OPTIONS.find((s) => s.value === e)?.label ?? e);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

export default function ClientFilter({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const currentCliente = params.get("cliente") ?? "";
  const currentTipo = params.get("tipo") ?? "";
  const currentEstados = params.getAll("estado");

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string[]>(currentEstados);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // On first load with no URL estado, restore from localStorage
  useEffect(() => {
    if (currentEstados.length === 0) {
      try {
        const saved = localStorage.getItem(LS_KEY);
        if (saved) {
          const parsed: string[] = JSON.parse(saved);
          if (parsed.length > 0) navigate(currentCliente, currentTipo, parsed);
        }
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync pending selection when dropdown opens
  useEffect(() => {
    if (open) setPending(currentEstados);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

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

  function handleSave() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(pending)); } catch {}
    navigate(currentCliente, currentTipo, pending);
    setOpen(false);
  }

  const hasFilter = currentEstados.length > 0;

  return (
    <>
      <select
        className={`input ${styles.clientSelect}`}
        value={currentCliente}
        onChange={(e) => navigate(e.target.value, currentTipo, currentEstados)}
      >
        <option value="">Todos los clientes</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
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

      {/* Estado multi-select dropdown */}
      <div ref={dropdownRef} style={{ position: "relative" }}>
        <button
          className={`input ${styles.clientSelect} ${styles.estadoFilterBtn}`}
          onClick={() => setOpen((o) => !o)}
          style={hasFilter ? { color: "var(--emerald)", borderColor: "rgba(0,159,125,0.45)" } : {}}
        >
          <span className={styles.estadoFilterLabel}>{buildLabel(currentEstados)}</span>
          <span className={styles.estadoFilterCaret} style={open ? { transform: "rotate(180deg)" } : {}}>▾</span>
        </button>

        {open && (
          <div className={styles.estadoDropdown}>
            <div className={styles.estadoDropdownList}>
              {STATUS_OPTIONS.map((s) => {
                const checked = pending.includes(s.value);
                return (
                  <label
                    key={s.value}
                    className={styles.estadoOption}
                    style={checked ? { color: s.textColor } : {}}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setPending((prev) =>
                          prev.includes(s.value)
                            ? prev.filter((e) => e !== s.value)
                            : [...prev, s.value]
                        )
                      }
                    />
                    {s.label}
                  </label>
                );
              })}
            </div>
            <div className={styles.estadoDropdownFooter}>
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, padding: "7px 0", width: "100%" }}
                onClick={handleSave}
              >
                Guardar selección
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
