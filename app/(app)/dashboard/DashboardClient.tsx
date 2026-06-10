"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { CalendarEntry, CalendarEntryInput } from "./actions";
import {
  createCalendarEntry,
  updateCalendarEntry,
  deleteCalendarEntry,
  reorderCalendarEntry,
} from "./actions";
import s from "./dashboard.module.css";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const FORMAT_LABELS: Record<string, string> = {
  reel: "Reel",
  carrusel: "Carrusel",
  post_texto: "Post texto",
  story: "Story",
};

const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  etapa0: "Etapa 0",
  produccion: "Producción",
  publicado: "Publicado",
};

const STATUS_COLORS: Record<string, string> = {
  idea: "var(--text-dim)",
  etapa0: "var(--signal)",
  produccion: "var(--emerald)",
  publicado: "rgba(0,159,125,0.5)",
};

const PILLARS = [
  "Detrás de cámaras",
  "Espejo del dolor",
  "Construcción en vivo",
  "Educación sin jerga",
  "Voz del mercado",
  "CTA directo",
];

const EMPTY_FORM: CalendarEntryInput = {
  client_id: null,
  title: "",
  format: "reel",
  platforms: ["instagram"],
  status: "idea",
  pillar: "",
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  week_number: 1,
  brief: "",
  notes: "",
  cta_type: "",
  weekly_theme: "",
};

type Client = { id: string; nombre: string; marca: string | null };

type Props = {
  clients: Client[];
  initialEntries: CalendarEntry[];
  selectedClientId: string | null;
  month: number;
  year: number;
};

export default function DashboardClient({
  clients,
  initialEntries,
  selectedClientId,
  month,
  year,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null);
  const [form, setForm] = useState<CalendarEntryInput>({ ...EMPTY_FORM, month, year });
  const [error, setError] = useState<string | null>(null);

  function navigate(clientId: string | null, m: number, y: number) {
    const params = new URLSearchParams();
    if (clientId) params.set("client", clientId);
    params.set("month", String(m));
    params.set("year", String(y));
    router.push(`${pathname}?${params.toString()}`);
  }

  function prevMonth() {
    const d = new Date(year, month - 2);
    navigate(selectedClientId, d.getMonth() + 1, d.getFullYear());
  }

  function nextMonth() {
    const d = new Date(year, month);
    navigate(selectedClientId, d.getMonth() + 1, d.getFullYear());
  }

  function openNew(weekNumber: number) {
    setEditingEntry(null);
    setForm({
      ...EMPTY_FORM,
      month,
      year,
      week_number: weekNumber,
      client_id: selectedClientId,
    });
    setError(null);
    setShowModal(true);
  }

  function openEdit(entry: CalendarEntry) {
    setEditingEntry(entry);
    setForm({
      client_id: entry.client_id,
      title: entry.title,
      format: entry.format,
      platforms: entry.platforms,
      status: entry.status,
      pillar: entry.pillar ?? "",
      month: entry.month,
      year: entry.year,
      week_number: entry.week_number,
      brief: entry.brief ?? "",
      notes: entry.notes ?? "",
      cta_type: entry.cta_type ?? "",
      weekly_theme: entry.weekly_theme ?? "",
    });
    setError(null);
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("El título es obligatorio."); return; }
    setError(null);
    startTransition(async () => {
      try {
        if (editingEntry) {
          await updateCalendarEntry(editingEntry.id, form);
        } else {
          await createCalendarEntry(form);
        }
        setShowModal(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta pieza del calendario?")) return;
    startTransition(async () => {
      await deleteCalendarEntry(id);
      router.refresh();
    });
  }

  function handleReorder(id: string, dir: "up" | "down") {
    startTransition(async () => {
      await reorderCalendarEntry(id, dir);
      router.refresh();
    });
  }

  function togglePlatform(p: string) {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(p)
        ? prev.platforms.filter((x) => x !== p)
        : [...prev.platforms, p],
    }));
  }

  // Stats
  const stats = {
    idea: initialEntries.filter((e) => e.status === "idea").length,
    etapa0: initialEntries.filter((e) => e.status === "etapa0").length,
    produccion: initialEntries.filter((e) => e.status === "produccion").length,
    publicado: initialEntries.filter((e) => e.status === "publicado").length,
  };

  // Group by week
  const byWeek: Record<number, CalendarEntry[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const e of initialEntries) {
    const w = e.week_number ?? 1;
    if (w >= 1 && w <= 4) byWeek[w].push(e);
  }

  const weekThemes: Record<number, string> = {};
  for (const e of initialEntries) {
    if (e.weekly_theme && e.week_number) {
      weekThemes[e.week_number] = e.weekly_theme;
    }
  }

  return (
    <div className={s.page}>
      {/* Header */}
      <div className={s.header}>
        <div>
          <p className="eyebrow">Publicaciones</p>
          <h2 className={s.title}>Dashboard de publicaciones</h2>
        </div>
        <div className={s.headerControls}>
          <select
            className={`input ${s.clientSelect}`}
            value={selectedClientId ?? ""}
            onChange={(e) => navigate(e.target.value || null, month, year)}
          >
            <option value="">Todos los clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}{c.marca ? ` · ${c.marca}` : ""}
              </option>
            ))}
          </select>
          <div className={s.monthNav}>
            <button onClick={prevMonth} className="btn btn-ghost" style={{ padding: "8px 12px" }}>←</button>
            <span className={s.monthLabel}>{MONTHS[month - 1]} {year}</span>
            <button onClick={nextMonth} className="btn btn-ghost" style={{ padding: "8px 12px" }}>→</button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className={s.stats}>
        {[
          { key: "idea", label: "Ideas", count: stats.idea, color: "var(--text-dim)" },
          { key: "etapa0", label: "Etapa 0", count: stats.etapa0, color: "var(--signal)" },
          { key: "produccion", label: "En producción", count: stats.produccion, color: "var(--emerald)" },
          { key: "publicado", label: "Publicados", count: stats.publicado, color: "rgba(0,159,125,0.6)" },
        ].map((stat) => (
          <div key={stat.key} className={`card ${s.statCard}`}>
            <span className={s.statCount} style={{ color: stat.color }}>{stat.count}</span>
            <span className={s.statLabel}>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Weeks */}
      {[1, 2, 3, 4].map((week) => {
        const entries = byWeek[week];
        const theme = weekThemes[week] ?? "";
        return (
          <div key={week} className={s.week}>
            <div className={s.weekHeader}>
              <div className={s.weekMeta}>
                <span className={s.weekLabel}>Semana {week}</span>
                {theme && <span className={s.weekTheme}>"{theme}"</span>}
              </div>
              <button
                className={`btn btn-ghost ${s.addBtn}`}
                onClick={() => openNew(week)}
              >
                + Agregar
              </button>
            </div>

            {entries.length === 0 ? (
              <div className={s.emptyWeek}>
                <span>Sin contenido planeado</span>
                <button className={s.emptyAddLink} onClick={() => openNew(week)}>
                  + Agregar primera pieza
                </button>
              </div>
            ) : (
              <div className={s.entries}>
                {entries.map((entry, idx) => (
                  <div key={entry.id} className={`card ${s.entryCard}`}>
                    <div className={s.entryTop}>
                      <div className={s.entryBadges}>
                        <span className={`badge ${s.formatBadge}`}>
                          {FORMAT_LABELS[entry.format] ?? entry.format}
                        </span>
                        {entry.platforms.map((p) => (
                          <span key={p} className={s.platformBadge}>
                            {p === "instagram" ? "IG" : p === "linkedin" ? "LI" : p === "youtube" ? "YT" : p}
                          </span>
                        ))}
                        <span
                          className={s.statusBadge}
                          style={{ color: STATUS_COLORS[entry.status] }}
                        >
                          {STATUS_LABELS[entry.status] ?? entry.status}
                        </span>
                      </div>
                      <div className={s.entryActions}>
                        <button
                          className={s.reorderBtn}
                          onClick={() => handleReorder(entry.id, "up")}
                          disabled={isPending || idx === 0}
                          title="Subir"
                        >↑</button>
                        <button
                          className={s.reorderBtn}
                          onClick={() => handleReorder(entry.id, "down")}
                          disabled={isPending || idx === entries.length - 1}
                          title="Bajar"
                        >↓</button>
                        <button
                          className={s.editBtn}
                          onClick={() => openEdit(entry)}
                          title="Editar"
                        >✎</button>
                        <button
                          className={s.deleteBtn}
                          onClick={() => handleDelete(entry.id)}
                          title="Eliminar"
                        >✕</button>
                      </div>
                    </div>
                    <p className={s.entryTitle}>{entry.title}</p>
                    <div className={s.entryMeta}>
                      {entry.pillar && <span className={s.pillarTag}>{entry.pillar}</span>}
                      {entry.cta_type && (
                        <span className={s.ctaTag} data-cta={entry.cta_type}>
                          CTA {entry.cta_type}
                        </span>
                      )}
                      {entry.clients && (
                        <span className={s.clientTag}>
                          {entry.clients.marca ?? entry.clients.nombre}
                        </span>
                      )}
                    </div>
                    {entry.script_id && (
                      <Link href={`/guiones/${entry.script_id}`} className={s.scriptLink}>
                        Ver guion →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Modal */}
      {showModal && (
        <div className={s.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className={s.modal}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>
                {editingEntry ? "Editar pieza" : "Nueva pieza de contenido"}
              </h3>
              <button className={s.modalClose} onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className={s.modalForm}>
              <div className="field">
                <label className="field-label">Título *</label>
                <input
                  className="input"
                  placeholder="ej. 3 señales de que tu negocio se está atascando"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />
              </div>

              <div className={s.formRow}>
                <div className="field">
                  <label className="field-label">Formato</label>
                  <select
                    className="select"
                    value={form.format}
                    onChange={(e) => setForm((p) => ({ ...p, format: e.target.value }))}
                  >
                    <option value="reel">Reel</option>
                    <option value="carrusel">Carrusel</option>
                    <option value="post_texto">Post texto</option>
                    <option value="story">Story</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Semana</label>
                  <select
                    className="select"
                    value={form.week_number ?? 1}
                    onChange={(e) => setForm((p) => ({ ...p, week_number: parseInt(e.target.value) }))}
                  >
                    <option value={1}>Semana 1</option>
                    <option value={2}>Semana 2</option>
                    <option value={3}>Semana 3</option>
                    <option value={4}>Semana 4</option>
                  </select>
                </div>
              </div>

              <div className={s.formRow}>
                <div className="field">
                  <label className="field-label">Estado</label>
                  <select
                    className="select"
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="idea">Idea</option>
                    <option value="etapa0">Etapa 0</option>
                    <option value="produccion">En producción</option>
                    <option value="publicado">Publicado</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">CTA</label>
                  <select
                    className="select"
                    value={form.cta_type ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, cta_type: e.target.value }))}
                  >
                    <option value="">Sin definir</option>
                    <option value="frio">Frío</option>
                    <option value="tibio">Tibio</option>
                    <option value="caliente">Caliente</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label className="field-label">Plataformas</label>
                <div className={s.platformToggle}>
                  {["instagram", "linkedin", "youtube"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`${s.platformBtn} ${form.platforms.includes(p) ? s.platformBtnActive : ""}`}
                      onClick={() => togglePlatform(p)}
                    >
                      {p === "instagram" ? "Instagram" : p === "linkedin" ? "LinkedIn" : "YouTube"}
                    </button>
                  ))}
                </div>
              </div>

              <div className={s.formRow}>
                <div className="field">
                  <label className="field-label">Pilar</label>
                  <select
                    className="select"
                    value={form.pillar ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, pillar: e.target.value }))}
                  >
                    <option value="">Sin asignar</option>
                    {PILLARS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Tema semanal</label>
                  <input
                    className="input"
                    placeholder="ej. ¿Quién somos y qué resolvemos?"
                    value={form.weekly_theme ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, weekly_theme: e.target.value }))}
                  />
                </div>
              </div>

              {clients.length > 0 && (
                <div className="field">
                  <label className="field-label">Cliente</label>
                  <select
                    className="select"
                    value={form.client_id ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value || null }))}
                  >
                    <option value="">Sin asignar</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}{c.marca ? ` · ${c.marca}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="field">
                <label className="field-label">Brief / descripción</label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="Descripción del contenido, ángulo, referencia…"
                  value={form.brief ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, brief: e.target.value }))}
                />
              </div>

              {error && <p className={s.formError}>{error}</p>}

              <div className={s.modalActions}>
                {editingEntry && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ color: "var(--flare)" }}
                    onClick={() => { handleDelete(editingEntry.id); setShowModal(false); }}
                  >
                    Eliminar
                  </button>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? "Guardando…" : editingEntry ? "Guardar cambios" : "Crear pieza"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
