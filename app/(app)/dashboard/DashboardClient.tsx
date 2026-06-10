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
  updateCalendarMetrics,
  postponeCalendarEntry,
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

type GeneratedEntry = {
  title: string;
  brief: string;
  format: string;
  platforms: string[];
  pillar: string;
  cta_type: string;
  week_number: number;
  weekly_theme: string;
};

type GeneratedWeek = {
  week_number: number;
  theme: string;
  entries: GeneratedEntry[];
};

type MetricsForm = {
  metrics_views: string;
  metrics_likes: string;
  metrics_comments: string;
  metrics_shares: string;
  metrics_saves: string;
};

const EMPTY_METRICS: MetricsForm = {
  metrics_views: "",
  metrics_likes: "",
  metrics_comments: "",
  metrics_shares: "",
  metrics_saves: "",
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

  // AI generation state
  const [showGenModal, setShowGenModal] = useState(false);
  const [genPeriod, setGenPeriod] = useState<"week" | "biweek" | "month">("week");
  const [genWeekNumber, setGenWeekNumber] = useState<number>(1);
  const [genClientId, setGenClientId] = useState<string | null>(selectedClientId);
  const [genWeeklyTheme, setGenWeeklyTheme] = useState("");
  const [generatedWeeks, setGeneratedWeeks] = useState<GeneratedWeek[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genStep, setGenStep] = useState<"pick" | "preview" | "saving">("pick");
  const [savingGenerated, startSavingTransition] = useTransition();

  // Postpone menu state
  const [postponeMenuId, setPostponeMenuId] = useState<string | null>(null);

  function handlePostpone(id: string, to: "week" | "month") {
    setPostponeMenuId(null);
    startTransition(async () => {
      await postponeCalendarEntry(id, to);
      router.refresh();
    });
  }

  // Metrics panel state
  const [metricsEntryId, setMetricsEntryId] = useState<string | null>(null);
  const [metricsForm, setMetricsForm] = useState<MetricsForm>(EMPTY_METRICS);
  const [metricsPending, startMetricsTransition] = useTransition();
  const [metricsSaved, setMetricsSaved] = useState(false);

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

  // AI generation handlers
  async function handleGenerate() {
    setGenLoading(true);
    setGenError(null);
    setGeneratedWeeks([]);

    try {
      const res = await fetch("/api/ai/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: genPeriod,
          week_number: genPeriod === "week" ? genWeekNumber : null,
          month,
          year,
          client_id: genClientId || null,
          weekly_theme: genWeeklyTheme.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error generando contenido");
      }
      const data = await res.json();
      setGeneratedWeeks(data.weeks ?? []);
      setGenStep("preview");
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Error");
    } finally {
      setGenLoading(false);
    }
  }

  function handleSaveGenerated() {
    startSavingTransition(async () => {
      for (const week of generatedWeeks) {
        for (const entry of week.entries) {
          await createCalendarEntry({
            client_id: selectedClientId || null,
            title: entry.title,
            format: entry.format,
            platforms: entry.platforms,
            status: "idea",
            pillar: entry.pillar,
            month,
            year,
            week_number: entry.week_number,
            brief: entry.brief,
            cta_type: entry.cta_type,
            weekly_theme: entry.weekly_theme,
          });
        }
      }
      setShowGenModal(false);
      setGenStep("pick");
      setGeneratedWeeks([]);
      router.refresh();
    });
  }

  function openMetrics(entry: CalendarEntry) {
    setMetricsEntryId(entry.id);
    setMetricsForm({
      metrics_views: entry.metrics_views?.toString() ?? "",
      metrics_likes: entry.metrics_likes?.toString() ?? "",
      metrics_comments: entry.metrics_comments?.toString() ?? "",
      metrics_shares: entry.metrics_shares?.toString() ?? "",
      metrics_saves: entry.metrics_saves?.toString() ?? "",
    });
    setMetricsSaved(false);
  }

  function handleSaveMetrics() {
    if (!metricsEntryId) return;
    startMetricsTransition(async () => {
      await updateCalendarMetrics(metricsEntryId, {
        metrics_views: metricsForm.metrics_views ? parseInt(metricsForm.metrics_views) : null,
        metrics_likes: metricsForm.metrics_likes ? parseInt(metricsForm.metrics_likes) : null,
        metrics_comments: metricsForm.metrics_comments ? parseInt(metricsForm.metrics_comments) : null,
        metrics_shares: metricsForm.metrics_shares ? parseInt(metricsForm.metrics_shares) : null,
        metrics_saves: metricsForm.metrics_saves ? parseInt(metricsForm.metrics_saves) : null,
      });
      setMetricsSaved(true);
      setTimeout(() => {
        setMetricsEntryId(null);
        router.refresh();
      }, 1200);
    });
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
          <button
            className="btn btn-primary"
            style={{ padding: "10px 18px", fontSize: 13 }}
            onClick={() => { setGenClientId(selectedClientId); setGenWeeklyTheme(""); setShowGenModal(true); setGenStep("pick"); setGeneratedWeeks([]); setGenError(null); }}
          >
            ✦ Generar contenido
          </button>
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
                        <div className={s.postponeWrap}>
                          <button
                            className={s.postponeBtn}
                            onClick={() => setPostponeMenuId(postponeMenuId === entry.id ? null : entry.id)}
                            title="Pasar para..."
                            disabled={isPending}
                          >⏭</button>
                          {postponeMenuId === entry.id && (
                            <div className={s.postponeMenu}>
                              <button className={s.postponeOption} onClick={() => handlePostpone(entry.id, "week")}>
                                Sig. semana
                              </button>
                              <button className={s.postponeOption} onClick={() => handlePostpone(entry.id, "month")}>
                                Sig. mes
                              </button>
                            </div>
                          )}
                        </div>
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
                    {entry.status === "publicado" && (
                      <button
                        className={s.metricsBtn}
                        onClick={() => openMetrics(entry)}
                      >
                        {entry.metrics_saves != null || entry.metrics_views != null
                          ? `📊 ${entry.metrics_saves != null ? `${entry.metrics_saves} guardados` : ""}`
                          : "📊 Agregar métricas"}
                      </button>
                    )}
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

      {/* Overlay para cerrar el menú de posponer */}
      {postponeMenuId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setPostponeMenuId(null)} />
      )}

      {/* ── Modal: Generar contenido con IA ── */}
      {showGenModal && (
        <div className={s.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowGenModal(false)}>
          <div className={s.modal} style={{ maxWidth: 700 }}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>✦ Generar contenido con IA</h3>
              <button className={s.modalClose} onClick={() => setShowGenModal(false)}>✕</button>
            </div>

            {genStep === "pick" && (
              <div className={s.modalForm}>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                  La IA generará ideas de contenido para {MONTHS[month - 1]} {year}
                  {selectedClientId ? ` · cliente seleccionado` : ""},
                  basadas en la metodología de crecimiento y tu contenido previo.
                </p>

                {clients.length > 0 && (
                  <div className="field">
                    <label className="field-label">Cliente</label>
                    <select
                      className="select"
                      value={genClientId ?? ""}
                      onChange={(e) => setGenClientId(e.target.value || null)}
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
                  <label className="field-label">Tema de la semana (opcional)</label>
                  <input
                    className="input"
                    placeholder="ej. Mundial de Fútbol 2026, regreso a clases, lanzamiento de servicio…"
                    value={genWeeklyTheme}
                    onChange={(e) => setGenWeeklyTheme(e.target.value)}
                  />
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>
                    La IA orientará el contenido a este tema manteniendo la voz y servicios del cliente.
                  </p>
                </div>

                <div className="field">
                  <label className="field-label">¿Para cuánto tiempo generar?</label>
                  <div className={s.periodSelector}>
                    {([["week", "1 semana"], ["biweek", "Quincena (2 sem.)"], ["month", "Mes completo (4 sem.)"]] as [string, string][]).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        className={`${s.periodBtn} ${genPeriod === val ? s.periodBtnActive : ""}`}
                        onClick={() => setGenPeriod(val as "week" | "biweek" | "month")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {genPeriod === "week" && (
                  <div className="field">
                    <label className="field-label">¿Cuál semana?</label>
                    <select
                      className="select"
                      value={genWeekNumber}
                      onChange={(e) => setGenWeekNumber(parseInt(e.target.value))}
                    >
                      <option value={1}>Semana 1</option>
                      <option value={2}>Semana 2</option>
                      <option value={3}>Semana 3</option>
                      <option value={4}>Semana 4</option>
                    </select>
                  </div>
                )}

                {genError && <p className={s.formError}>{genError}</p>}

                <div className={s.modalActions}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowGenModal(false)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleGenerate}
                    disabled={genLoading}
                  >
                    {genLoading ? "Generando ideas…" : "✦ Generar ideas"}
                  </button>
                </div>

                {genLoading && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "16px 0" }}>
                    <div className={s.genSpinner} />
                    <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                      Analizando tu contenido previo y generando ideas…
                    </p>
                  </div>
                )}
              </div>
            )}

            {genStep === "preview" && (
              <div className={s.modalForm}>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                  Revisa las ideas generadas. Al guardar, se añadirán al calendario con estado <strong>Idea</strong>.
                </p>

                <div className={s.genPreviewList}>
                  {generatedWeeks.map((week) => (
                    <div key={week.week_number} className={s.genWeekGroup}>
                      <p className={s.genWeekLabel}>Semana {week.week_number} — "{week.theme}"</p>
                      {week.entries.map((entry, i) => (
                        <div key={i} className={s.genEntryCard}>
                          <div className={s.genEntryTop}>
                            <span className={`badge ${s.formatBadge}`}>{FORMAT_LABELS[entry.format] ?? entry.format}</span>
                            {entry.platforms.map((p) => (
                              <span key={p} className={s.platformBadge}>
                                {p === "instagram" ? "IG" : p === "linkedin" ? "LI" : p}
                              </span>
                            ))}
                            <span className={s.ctaTag} data-cta={entry.cta_type}>CTA {entry.cta_type}</span>
                          </div>
                          <p className={s.genEntryTitle}>{entry.title}</p>
                          <p className={s.genEntryBrief}>{entry.brief}</p>
                          <span className={s.pillarTag}>{entry.pillar}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div className={s.modalActions}>
                  <button type="button" className="btn btn-ghost" onClick={() => setGenStep("pick")}>
                    ← Volver
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveGenerated}
                    disabled={savingGenerated}
                  >
                    {savingGenerated ? "Guardando…" : `Guardar ${generatedWeeks.reduce((acc, w) => acc + w.entries.length, 0)} piezas`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Métricas ── */}
      {metricsEntryId && (
        <div className={s.modalOverlay} onClick={(e) => e.target === e.currentTarget && setMetricsEntryId(null)}>
          <div className={s.modal} style={{ maxWidth: 440 }}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>📊 Métricas de publicación</h3>
              <button className={s.modalClose} onClick={() => setMetricsEntryId(null)}>✕</button>
            </div>
            <div className={s.modalForm}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                El guardado (saves) es la métrica más importante en Instagram — indica valor percibido real.
              </p>
              <div className={s.formRow}>
                <div className="field">
                  <label className="field-label">💾 Guardados (saves)</label>
                  <input className="input" type="number" min="0" placeholder="0"
                    value={metricsForm.metrics_saves}
                    onChange={(e) => setMetricsForm((p) => ({ ...p, metrics_saves: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="field-label">👁 Alcance / vistas</label>
                  <input className="input" type="number" min="0" placeholder="0"
                    value={metricsForm.metrics_views}
                    onChange={(e) => setMetricsForm((p) => ({ ...p, metrics_views: e.target.value }))} />
                </div>
              </div>
              <div className={s.formRow}>
                <div className="field">
                  <label className="field-label">❤️ Likes</label>
                  <input className="input" type="number" min="0" placeholder="0"
                    value={metricsForm.metrics_likes}
                    onChange={(e) => setMetricsForm((p) => ({ ...p, metrics_likes: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="field-label">💬 Comentarios</label>
                  <input className="input" type="number" min="0" placeholder="0"
                    value={metricsForm.metrics_comments}
                    onChange={(e) => setMetricsForm((p) => ({ ...p, metrics_comments: e.target.value }))} />
                </div>
              </div>
              <div className="field">
                <label className="field-label">↗️ Compartidos</label>
                <input className="input" type="number" min="0" placeholder="0"
                  value={metricsForm.metrics_shares}
                  onChange={(e) => setMetricsForm((p) => ({ ...p, metrics_shares: e.target.value }))} />
              </div>
              {metricsSaved ? (
                <p style={{ color: "var(--emerald)", fontWeight: 600, textAlign: "center" }}>✓ Métricas guardadas</p>
              ) : (
                <div className={s.modalActions}>
                  <button type="button" className="btn btn-ghost" onClick={() => setMetricsEntryId(null)}>Cancelar</button>
                  <button type="button" className="btn btn-primary" onClick={handleSaveMetrics} disabled={metricsPending}>
                    {metricsPending ? "Guardando…" : "Guardar métricas"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
