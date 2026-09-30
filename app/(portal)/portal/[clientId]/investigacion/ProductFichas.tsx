"use client";

/**
 * "Qué vendes" en la Investigación del portal: cada servicio con su ficha de
 * oferta (migración `0016`).
 *
 * - Todos la ven. La ficha es lo que la IA usa para escribir los guiones de
 *   ese servicio, así que mostrarla es la forma de que el cliente detecte un
 *   dato equivocado antes de que salga en un guion.
 * - `collaborator` y dueño la editan (descripción + los diez campos). El
 *   nombre, el tipo, las altas y las bajas quedan en el estudio.
 *
 * La lista vive en estado local y la action devuelve la fila guardada:
 * `revalidatePath` no toca un `useState` inicializado desde props.
 */

import { useState } from "react";
import {
  PRODUCT_FIELD_GROUPS,
  PRODUCT_FIELD_KEYS,
  PRODUCT_FIELD_MAX,
  productCompleteness,
  type Product,
  type ProductDetails,
} from "@/lib/products/fields";
import { guardarFichaServicio } from "./actions";
import base from "./investigacion.module.css";
import s from "./fichas.module.css";

export default function ProductFichas({
  clientId,
  products: initial,
  canEdit,
}: {
  clientId: string;
  products: Product[];
  canEdit: boolean;
}) {
  const [products, setProducts] = useState<Product[]>(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (products.length === 0) {
    return <p className={base.empty}>Todavía no hay productos ni servicios cargados.</p>;
  }

  return (
    <div className={base.cards}>
      {products.map((p) => {
        const open = openId === p.id || editingId === p.id;
        const completeness = productCompleteness(p);
        return (
          <article key={p.id} className={base.card}>
            <div className={s.head}>
              <div className={s.headText}>
                <h4 className={base.cardTitle}>{p.nombre}</h4>
                <span className={base.tipo}>{p.tipo}</span>
              </div>
              <div className={s.headActions}>
                <span className={s.meter}>Ficha {completeness}%</span>
                {editingId !== p.id && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: "5px 10px" }}
                    onClick={() => setOpenId(open ? null : p.id)}
                  >
                    {open ? "Ocultar ficha" : "Ver ficha"}
                  </button>
                )}
                {canEdit && editingId !== p.id && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: "5px 12px" }}
                    onClick={() => setEditingId(p.id)}
                  >
                    Editar
                  </button>
                )}
              </div>
            </div>

            {p.descripcion && editingId !== p.id && <p className={base.cardBody}>{p.descripcion}</p>}

            {editingId === p.id ? (
              <FichaEditor
                clientId={clientId}
                product={p}
                onCancel={() => setEditingId(null)}
                onSaved={(saved) => {
                  setProducts((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
                  setEditingId(null);
                  setOpenId(saved.id);
                }}
              />
            ) : (
              open && <FichaView product={p} canEdit={canEdit} />
            )}
          </article>
        );
      })}
    </div>
  );
}

function FichaView({ product, canEdit }: { product: Product; canEdit: boolean }) {
  const filled = PRODUCT_FIELD_KEYS.some((k) => (product[k] ?? "").trim());
  if (!filled) {
    return (
      <p className={base.empty}>
        La ficha está vacía.{" "}
        {canEdit
          ? "Llénala con “Editar”: mientras más completa, mejores los guiones de este servicio."
          : "Pídele a tu equipo que la complete."}
      </p>
    );
  }
  return (
    <div className={s.view}>
      {PRODUCT_FIELD_GROUPS.map((group) => {
        const fields = group.fields.filter((f) => (product[f.key] ?? "").trim());
        if (fields.length === 0) return null;
        return (
          <div key={group.id} className={s.group}>
            <span className={s.groupTitle}>{group.label}</span>
            <dl className={s.list}>
              {fields.map((f) => (
                <div key={f.key} className={s.item}>
                  <dt>{f.label}</dt>
                  <dd>{product[f.key]}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

function FichaEditor({
  clientId,
  product,
  onCancel,
  onSaved,
}: {
  clientId: string;
  product: Product;
  onCancel: () => void;
  onSaved: (p: Product) => void;
}) {
  const [descripcion, setDescripcion] = useState(product.descripcion ?? "");
  const [details, setDetails] = useState<ProductDetails>(
    () => Object.fromEntries(PRODUCT_FIELD_KEYS.map((k) => [k, product[k] ?? null])) as ProductDetails,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await guardarFichaServicio({
        clientId,
        productId: product.id,
        descripcion,
        details,
      });
      if (res.ok) onSaved(res.product);
      else setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la ficha.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={s.editor}>
      <label className={s.field}>
        <span className="field-label">¿Qué es, en una oración?</span>
        <textarea
          className="textarea"
          rows={2}
          maxLength={PRODUCT_FIELD_MAX}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          disabled={saving}
        />
      </label>

      {PRODUCT_FIELD_GROUPS.map((group) => (
        <fieldset key={group.id} className={s.group}>
          <legend className={s.groupTitle}>
            {group.label}
            <span className={s.groupHint}>{group.hint}</span>
          </legend>
          <div className={s.grid}>
            {group.fields.map((f) => (
              <label key={f.key} className={s.field}>
                <span className="field-label">{f.label}</span>
                <textarea
                  className="textarea"
                  rows={f.rows}
                  maxLength={PRODUCT_FIELD_MAX}
                  placeholder={f.placeholder}
                  value={details[f.key] ?? ""}
                  onChange={(e) => setDetails((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  disabled={saving}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {error && <p className={s.error}>{error}</p>}

      <div className={s.actions}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar ficha"}
        </button>
      </div>
    </div>
  );
}
