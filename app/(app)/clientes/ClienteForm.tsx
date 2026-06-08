"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createCliente, updateCliente, type ClienteFormData } from "./actions";
import s from "./clientes.module.css";

const COMPLETENESS_FIELDS: (keyof ClienteFormData)[] = [
  "que_vende",
  "cliente_ideal",
  "nicho",
  "dolor",
  "deseo",
  "tono",
];

function calcCompleteness(data: ClienteFormData): number {
  const filled = COMPLETENESS_FIELDS.filter(
    (f) => data[f]?.trim().length > 0,
  ).length;
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
}

function barColor(pct: number) {
  if (pct >= 67) return "var(--emerald)";
  if (pct >= 34) return "var(--signal)";
  return "var(--flare)";
}

type Props = {
  clienteId?: string;
  initial?: Partial<ClienteFormData>;
};

const EMPTY: ClienteFormData = {
  nombre: "",
  marca: "",
  que_vende: "",
  cliente_ideal: "",
  nicho: "",
  dolor: "",
  deseo: "",
  tono: "",
  notas: "",
};

export default function ClienteForm({ clienteId, initial }: Props) {
  const [form, setForm] = useState<ClienteFormData>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isEdit = !!clienteId;
  const completeness = calcCompleteness(form);

  function set(field: keyof ClienteFormData) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateCliente(clienteId, form);
        } else {
          await createCliente(form);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className={s.formPage}>
      <div className={s.formHeader}>
        <Link href="/clientes" className={s.formBack}>
          ← Clientes
        </Link>
        <h1 className={s.formTitle}>
          {isEdit ? "Editar cliente" : "Nuevo cliente"}
        </h1>
      </div>

      {/* Progress bar */}
      <div className={s.formProgress}>
        <span className={s.formProgressLabel}>Perfil completo</span>
        <div className={s.formProgressTrack}>
          <div
            className={s.formProgressBar}
            style={{
              width: `${completeness}%`,
              background: barColor(completeness),
            }}
          />
        </div>
        <span
          className={s.formProgressValue}
          style={{ color: barColor(completeness) }}
        >
          {completeness}%
        </span>
      </div>

      {/* Sección 1: Identidad */}
      <div className={`card ${s.section}`}>
        <p className={s.sectionTitle}>Identidad</p>
        <div className={s.fieldGrid}>
          <div className="field">
            <label className="field-label" htmlFor="nombre">
              Nombre del cliente <span style={{ color: "var(--flare)" }}>*</span>
            </label>
            <input
              id="nombre"
              className="input"
              placeholder="ej. María García"
              value={form.nombre}
              onChange={set("nombre")}
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="marca">
              Marca / Cuenta
            </label>
            <input
              id="marca"
              className="input"
              placeholder="ej. @mariacoach"
              value={form.marca}
              onChange={set("marca")}
            />
          </div>
          <div className={`field ${s.fieldFull}`}>
            <label className="field-label" htmlFor="que_vende">
              ¿Qué vende?
            </label>
            <input
              id="que_vende"
              className="input"
              placeholder="ej. Mentoría de fitness para madres ocupadas"
              value={form.que_vende}
              onChange={set("que_vende")}
            />
          </div>
        </div>
      </div>

      {/* Sección 2: Buyer persona */}
      <div className={`card ${s.section}`}>
        <p className={s.sectionTitle}>Buyer persona</p>
        <div className={s.fieldGrid}>
          <div className={`field ${s.fieldFull}`}>
            <label className="field-label" htmlFor="cliente_ideal">
              Cliente ideal
            </label>
            <textarea
              id="cliente_ideal"
              className="textarea"
              rows={3}
              placeholder="ej. Mujer 30–45, mamá de 2 hijos, trabaja medio tiempo, quiere bajar 10kg sin dietas extremas"
              value={form.cliente_ideal}
              onChange={set("cliente_ideal")}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="nicho">
              Nicho
            </label>
            <input
              id="nicho"
              className="input"
              placeholder="ej. Fitness para mamás"
              value={form.nicho}
              onChange={set("nicho")}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="tono">
              Tono de voz
            </label>
            <input
              id="tono"
              className="input"
              placeholder="ej. Cálido, motivador, directo"
              value={form.tono}
              onChange={set("tono")}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="dolor">
              Dolor principal
            </label>
            <textarea
              id="dolor"
              className="textarea"
              rows={2}
              placeholder="ej. No tiene tiempo ni energía para entrenar"
              value={form.dolor}
              onChange={set("dolor")}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="deseo">
              Deseo / Resultado
            </label>
            <textarea
              id="deseo"
              className="textarea"
              rows={2}
              placeholder="ej. Verse en forma sin sacrificar familia ni trabajo"
              value={form.deseo}
              onChange={set("deseo")}
            />
          </div>
        </div>
      </div>

      {/* Sección 3: Notas */}
      <div className={`card ${s.section}`}>
        <p className={s.sectionTitle}>Notas adicionales</p>
        <div className="field">
          <label className="field-label" htmlFor="notas">
            Contexto libre
          </label>
          <textarea
            id="notas"
            className="textarea"
            rows={4}
            placeholder="Cualquier detalle extra: objeciones comunes, colores de marca, competencia, estilo visual…"
            value={form.notas}
            onChange={set("notas")}
          />
        </div>
      </div>

      {error && <p className={s.formError}>{error}</p>}

      <div className={s.formActions}>
        <Link href="/clientes" className="btn btn-ghost">
          Cancelar
        </Link>
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}
