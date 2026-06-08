"use client";

import { useState, useTransition } from "react";
import { addResearch, deleteResearch } from "../actions";
import s from "../clientes.module.css";

type ResearchEntry = {
  id: string;
  fuente: string;
  resumen: string;
  created_at: string;
};

type Props = {
  clientId: string;
  entries: ResearchEntry[];
};

export default function ResearchSection({ clientId, entries }: Props) {
  const [fuente, setFuente] = useState("");
  const [resumen, setResumen] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isPendingAdd, startAdd] = useTransition();
  const [isPendingDel, startDel] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!resumen.trim()) {
      setAddError("El resumen es obligatorio.");
      return;
    }
    setAddError(null);
    startAdd(async () => {
      try {
        await addResearch(clientId, fuente, resumen);
        setFuente("");
        setResumen("");
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <div className={s.researchSection}>
      <h2 className={s.researchTitle}>Investigación</h2>
      <p className={s.researchSubtitle}>
        Apuntes, entrevistas, URLs o datos útiles sobre este cliente.
      </p>

      {entries.length > 0 && (
        <div className={s.researchList}>
          {entries.map((e) => (
            <div key={e.id} className={s.researchItem}>
              <div className={s.researchContent}>
                {e.fuente && <p className={s.researchFuente}>{e.fuente}</p>}
                <p className={s.researchResumen}>{e.resumen}</p>
                <p className={s.researchDate}>
                  {new Date(e.created_at).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={() => startDel(() => deleteResearch(e.id, clientId))}
                disabled={isPendingDel}
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: "4px 10px", flexShrink: 0 }}
                aria-label="Eliminar entrada"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className={s.researchForm}>
        <div className={s.researchFormRow}>
          <input
            className="input"
            placeholder="Fuente (URL, entrevista…)"
            value={fuente}
            onChange={(e) => setFuente(e.target.value)}
            style={{ fontSize: 13 }}
          />
          <textarea
            className="textarea"
            placeholder="¿Qué aprendiste? Pega el dato, la cita, el insight…"
            rows={2}
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            style={{ fontSize: 13 }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isPendingAdd}
            style={{ alignSelf: "flex-end", fontSize: 13 }}
          >
            {isPendingAdd ? "…" : "+ Agregar"}
          </button>
        </div>
        {addError && <p className={s.formError} style={{ marginTop: 8 }}>{addError}</p>}
      </form>
    </div>
  );
}
