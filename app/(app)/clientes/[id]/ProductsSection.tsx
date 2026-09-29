"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  addProduct,
  deleteProduct,
  extractProductFromLanding,
  updateProduct,
} from "../productActions";
import {
  PRODUCT_FIELD_GROUPS,
  PRODUCT_FIELD_KEYS,
  productCompleteness,
  type Product,
  type ProductDetails,
  type ProductTipo,
} from "@/lib/products/fields";
import s from "../clientes.module.css";

type Props = {
  clientId: string;
  products: Product[];
};

/**
 * Productos y servicios de la marca + su ficha de oferta (migración `0016`).
 *
 * La lista vive en estado local y cada action devuelve la fila guardada: la
 * pantalla se inicializa desde props y `revalidatePath` no toca un `useState`
 * (el mismo bug que se vio con las notas de Competencia).
 */
export default function ProductsSection({ clientId, products: initial }: Props) {
  const [products, setProducts] = useState<Product[]>(initial);
  const [openId, setOpenId] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<ProductTipo>("servicio");
  const [addError, setAddError] = useState<string | null>(null);
  const [isPendingAdd, startAdd] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setAddError("El nombre es obligatorio.");
      return;
    }
    setAddError(null);
    startAdd(async () => {
      try {
        const created = await addProduct({ clientId, nombre, descripcion, tipo });
        setProducts((prev) => [...prev, created]);
        // Se abre sola: lo siguiente es llenar la ficha.
        setOpenId(created.id);
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
        Llena la ficha de cada uno (para quién es, cómo se inicia, objeciones, oferta…). La IA
        la usa cuando eliges ese servicio en <strong>Nuevo guion</strong> o al{" "}
        <strong>adaptar</strong> un post de Competencia.
      </p>

      {products.length > 0 && (
        <div className={s.productsList}>
          {products.map((p) => (
            <ProductCard
              key={p.id}
              clientId={clientId}
              product={p}
              open={openId === p.id}
              onToggle={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
              onSaved={(saved) => {
                setProducts((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
                setOpenId(null);
              }}
              onDeleted={() => {
                setProducts((prev) => prev.filter((x) => x.id !== p.id));
                setOpenId((cur) => (cur === p.id ? null : cur));
              }}
            />
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className={s.productForm}>
        <div className={s.productFormGrid}>
          <select
            className="input"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as ProductTipo)}
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
            placeholder="¿Qué es, en una oración?"
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
            {isPendingAdd ? "…" : "+ Agregar y llenar ficha"}
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

// ── Tarjeta + ficha editable ───────────────────────────────────────────────

function detailsOf(p: Product): ProductDetails {
  return Object.fromEntries(PRODUCT_FIELD_KEYS.map((k) => [k, p[k] ?? null])) as ProductDetails;
}

function ProductCard({
  clientId,
  product,
  open,
  onToggle,
  onSaved,
  onDeleted,
}: {
  clientId: string;
  product: Product;
  open: boolean;
  onToggle: () => void;
  onSaved: (p: Product) => void;
  onDeleted: () => void;
}) {
  const completeness = productCompleteness(product);

  // Borrado con doble clic (ventana de 4s), mismo patrón que la papelera del
  // portal: un servicio que ya no se da se borra, pero no por un clic suelto.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, []);

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setDeleteError(null);
    startDelete(async () => {
      try {
        await deleteProduct(product.id, clientId);
        onDeleted();
      } catch (e) {
        setConfirmDelete(false);
        setDeleteError(e instanceof Error ? e.message : "No se pudo borrar");
      }
    });
  }

  return (
    <div className={`${s.productItem} ${open ? s.productItemOpen : ""}`}>
      <div className={s.productRow}>
        <div className={s.productContent}>
          <div className={s.productHeader}>
            <span className={s.productTipoBadge} data-tipo={product.tipo}>
              {product.tipo === "producto" ? "Producto" : "Servicio"}
            </span>
            <p className={s.productNombre}>{product.nombre}</p>
          </div>
          {product.descripcion && !open && (
            <p className={s.productDescripcion}>{product.descripcion}</p>
          )}
          <div className={s.productMeter} title="Qué tan completa está la ficha">
            <div className={s.productMeterBar}>
              <div className={s.productMeterFill} style={{ width: `${completeness}%` }} />
            </div>
            <span className={s.productMeterLabel}>Ficha {completeness}%</span>
          </div>
        </div>
        <div className={s.productActions}>
          <button type="button" className="btn btn-secondary" onClick={onToggle} style={{ fontSize: 12, padding: "5px 12px" }}>
            {open ? "Cerrar" : completeness === 0 ? "Llenar ficha" : "Editar ficha"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className={`btn btn-ghost ${confirmDelete ? s.productDeleteConfirm : ""}`}
            style={{ fontSize: 12, padding: "5px 10px" }}
            aria-label={confirmDelete ? "Confirmar borrado" : "Borrar"}
            title={confirmDelete ? "Los guiones hechos para este servicio se conservan" : "Borrar"}
          >
            {isDeleting ? "…" : confirmDelete ? "¿Borrar? Clic otra vez" : "✕"}
          </button>
        </div>
      </div>
      {deleteError && <p className={s.formError}>{deleteError}</p>}

      {open && <ProductEditor clientId={clientId} product={product} onSaved={onSaved} onCancel={onToggle} />}
    </div>
  );
}

function ProductEditor({
  clientId,
  product,
  onSaved,
  onCancel,
}: {
  clientId: string;
  product: Product;
  onSaved: (p: Product) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(product.nombre);
  const [tipo, setTipo] = useState<ProductTipo>(product.tipo);
  const [descripcion, setDescripcion] = useState(product.descripcion ?? "");
  const [details, setDetails] = useState<ProductDetails>(() => detailsOf(product));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  // "Llenar desde landing"
  const [showLanding, setShowLanding] = useState(false);
  const [landingText, setLandingText] = useState("");
  const [landingMsg, setLandingMsg] = useState<string | null>(null);
  const [isExtracting, startExtract] = useTransition();
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  function setField(key: keyof ProductDetails, value: string) {
    setDetails((prev) => ({ ...prev, [key]: value }));
    setHighlighted((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function handleExtract() {
    setLandingMsg(null);
    setError(null);
    startExtract(async () => {
      try {
        const res = await extractProductFromLanding({ nombre, text: landingText });
        // Solo se llenan los campos que la IA encontró Y que están vacíos: lo
        // que ya escribiste a mano no se pisa.
        // Se calcula sobre el estado actual y no dentro de un updater: React
        // puede correr el updater después, y el conteo saldría en cero.
        const filledNow = new Set<string>();
        const next = { ...details };
        for (const k of PRODUCT_FIELD_KEYS) {
          const v = res.details[k];
          if (v && !(details[k] ?? "").trim()) {
            next[k] = v;
            filledNow.add(k);
          }
        }
        setDetails(next);
        if (res.descripcion && !descripcion.trim()) {
          setDescripcion(res.descripcion);
          filledNow.add("descripcion");
        }
        setHighlighted(filledNow);
        setLandingMsg(
          filledNow.size > 0
            ? `Se llenaron ${filledNow.size} campo${filledNow.size === 1 ? "" : "s"} (marcados en verde). Revísalos y guarda.`
            : "No encontré datos nuevos en ese texto para los campos vacíos.",
        );
        if (filledNow.size > 0) setShowLanding(false);
      } catch (e) {
        setLandingMsg(e instanceof Error ? e.message : "No se pudo leer el texto");
      }
    });
  }

  function handleSave() {
    setError(null);
    startSave(async () => {
      try {
        const saved = await updateProduct({
          productId: product.id,
          clientId,
          nombre,
          descripcion,
          tipo,
          details,
        });
        onSaved(saved);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar");
      }
    });
  }

  return (
    <div className={s.productEditor}>
      <div className={s.productFormGrid}>
        <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as ProductTipo)} style={{ fontSize: 13 }}>
          <option value="servicio">Servicio</option>
          <option value="producto">Producto</option>
        </select>
        <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ fontSize: 13 }} />
        <textarea
          className={`textarea ${highlighted.has("descripcion") ? s.productFieldFilled : ""}`}
          placeholder="¿Qué es, en una oración?"
          rows={2}
          value={descripcion}
          onChange={(e) => {
            setDescripcion(e.target.value);
            setHighlighted((prev) => {
              const next = new Set(prev);
              next.delete("descripcion");
              return next;
            });
          }}
          style={{ fontSize: 13, gridColumn: "1 / -1" }}
        />
      </div>

      <div className={s.productLanding}>
        {!showLanding ? (
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowLanding(true)}>
            ✦ Llenar desde el texto de tu landing
          </button>
        ) : (
          <>
            <label className="field-label">Pega el texto de tu landing o página de venta</label>
            <textarea
              className="textarea"
              rows={6}
              placeholder="Copia y pega todo el texto de la página: titulares, beneficios, precios, preguntas frecuentes…"
              value={landingText}
              onChange={(e) => setLandingText(e.target.value)}
              style={{ fontSize: 13 }}
            />
            <div className={s.productLandingActions}>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowLanding(false)} disabled={isExtracting}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 12 }}
                onClick={handleExtract}
                disabled={isExtracting || landingText.trim().length < 80}
              >
                {isExtracting ? "Leyendo…" : "Proponer ficha"}
              </button>
            </div>
            <p className={s.productHint}>
              Solo llena los campos vacíos y no guarda nada hasta que tú lo hagas.
            </p>
          </>
        )}
        {landingMsg && <p className={s.productHint}>{landingMsg}</p>}
      </div>

      {PRODUCT_FIELD_GROUPS.map((group) => (
        <fieldset key={group.id} className={s.productGroup}>
          <legend className={s.productGroupTitle}>
            {group.label}
            <span className={s.productGroupHint}>{group.hint}</span>
          </legend>
          <div className={s.productGroupFields}>
            {group.fields.map((f) => (
              <label key={f.key} className={s.productField}>
                <span className="field-label">{f.label}</span>
                <textarea
                  className={`textarea ${highlighted.has(f.key) ? s.productFieldFilled : ""}`}
                  rows={f.rows}
                  placeholder={f.placeholder}
                  value={details[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {error && <p className={s.formError}>{error}</p>}

      <div className={s.productEditorActions}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={isSaving} style={{ fontSize: 13 }}>
          Cancelar
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSaving || !nombre.trim()} style={{ fontSize: 13 }}>
          {isSaving ? "Guardando…" : "Guardar ficha"}
        </button>
      </div>
    </div>
  );
}
