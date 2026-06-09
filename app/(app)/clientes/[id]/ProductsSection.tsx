"use client";

import { useState, useTransition } from "react";
import { addProduct, deleteProduct } from "../actions";
import s from "../clientes.module.css";

type Product = {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: "producto" | "servicio";
  created_at: string;
};

type Props = {
  clientId: string;
  products: Product[];
};

export default function ProductsSection({ clientId, products }: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<"producto" | "servicio">("servicio");
  const [addError, setAddError] = useState<string | null>(null);
  const [isPendingAdd, startAdd] = useTransition();
  const [isPendingDel, startDel] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setAddError("El nombre es obligatorio.");
      return;
    }
    setAddError(null);
    startAdd(async () => {
      try {
        await addProduct(clientId, nombre, descripcion, tipo);
        setNombre("");
        setDescripcion("");
        setTipo("servicio");
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <div className={s.productsSection}>
      <h2 className={s.productsTitle}>Productos y servicios</h2>
      <p className={s.productsSubtitle}>
        Agregá los productos o servicios de este cliente para que la IA tenga
        contexto al generar guiones.
      </p>

      {products.length > 0 && (
        <div className={s.productsList}>
          {products.map((p) => (
            <div key={p.id} className={s.productItem}>
              <div className={s.productContent}>
                <div className={s.productHeader}>
                  <span className={s.productTipoBadge} data-tipo={p.tipo}>
                    {p.tipo === "producto" ? "Producto" : "Servicio"}
                  </span>
                  <p className={s.productNombre}>{p.nombre}</p>
                </div>
                {p.descripcion && (
                  <p className={s.productDescripcion}>{p.descripcion}</p>
                )}
              </div>
              <button
                onClick={() => startDel(() => deleteProduct(p.id, clientId))}
                disabled={isPendingDel}
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: "4px 10px", flexShrink: 0 }}
                aria-label="Eliminar"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className={s.productForm}>
        <div className={s.productFormGrid}>
          <select
            className="input"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "producto" | "servicio")}
            style={{ fontSize: 13 }}
          >
            <option value="servicio">Servicio</option>
            <option value="producto">Producto</option>
          </select>
          <input
            className="input"
            placeholder="Nombre del producto o servicio"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            style={{ fontSize: 13 }}
          />
          <textarea
            className="textarea"
            placeholder="¿Qué hace o qué problema resuelve?"
            rows={2}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            style={{ fontSize: 13, gridColumn: "1 / -1" }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isPendingAdd}
            style={{ fontSize: 13, justifySelf: "end", gridColumn: "1 / -1" }}
          >
            {isPendingAdd ? "…" : "+ Agregar"}
          </button>
        </div>
        {addError && (
          <p className={s.formError} style={{ marginTop: 8 }}>
            {addError}
          </p>
        )}
      </form>
    </div>
  );
}
