"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import type { Tendencia, TendenciaStatus } from "./actions";
import {
  addTendencia,
  deleteTendencia,
  importarReporte,
  updateTendenciaStatus,
} from "./actions";
import s from "./tendencias.module.css";

type Filter = "todas" | TendenciaStatus;

function buildBrief(t: Tendencia): string {
  const parts = [
    `Tendencia IA: ${t.title}`,
    `Fuente: ${t.source ?? ""}${t.source && t.url ? " — " : ""}${t.url}`,
  ];
  if (t.summary) parts.push(`\n${t.summary}`);
  const angle = t.angle_paco || t.angle_fluia;
  if (angle) parts.push(`\nÁngulo de contenido: ${angle}`);
  return parts.join("\n");
}

function inferType(format: string | null): "reel" | "carousel" {
  if (!format) return "reel";
  return format.toLowerCase().includes("carrusel") ? "carousel" : "reel";
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  return (
    <span className={urgency === "urgente" ? s.badgeUrgente : s.badgeEvergreen}>
      {urgency === "urgente" ? "🔥 Urgente" : "📚 Evergreen"}
    </span>
  );
}

function FormatBadge({ format }: { format: string | null }) {
  if (!format) return null;
  return <span className={s.badgeFormat}>{format}</span>;
}

// ── Modal para agregar una tendencia manualmente ─────────────────────────────

type AddModalProps = {
  onClose: () => void;
  onAdded: (t: Tendencia) => void;
};

function AddModal({ onClose, onAdded }: AddModalProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("");
  const [summary, setSummary] = useState("");
  const [anglePaco, setAnglePaco] = useState("");
  const [angleFluia, setAngleFluia] = useState("");
  const [format, setFormat] = useState("Reel 30s");
  const [urgency, setUrgency] = useState<"urgente" | "evergreen">("evergreen");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await addTendencia({
        title,
        url,
        source,
        summary,
        angle_paco: anglePaco,
        angle_fluia: angleFluia,
        format_suggested: format,
        urgency,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onAdded({
        id: result.id,
        title: title.trim(),
        url: url.trim(),
        source: source.trim() || null,
        summary: summary.trim() || null,
        angle_paco: anglePaco.trim() || null,
        angle_fluia: angleFluia.trim() || null,
        format_suggested: format || null,
        urgency,
        notes: null,
        status: "pendiente",
        created_at: new Date().toISOString(),
      });
      onClose();
    });
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHead}>
          <span className="eyebrow">Nueva tendencia</span>
          <button className={s.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={s.modalBody}>
          <div className={s.field}>
            <label className="field-label">Título *</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de la noticia (en español)"
            />
          </div>
          <div className={s.field}>
            <label className="field-label">URL *</label>
            <input
              className="input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className={s.row2}>
            <div className={s.field}>
              <label className="field-label">Fuente</label>
              <input
                className="input"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="The Verge, MIT Tech Review…"
              />
            </div>
            <div className={s.field}>
              <label className="field-label">Urgencia</label>
              <select
                className="input"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as "urgente" | "evergreen")}
              >
                <option value="evergreen">📚 Evergreen</option>
                <option value="urgente">🔥 Urgente</option>
              </select>
            </div>
          </div>
          <div className={s.field}>
            <label className="field-label">Resumen</label>
            <textarea
              className="textarea"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="2 líneas sobre de qué trata la noticia"
            />
          </div>
          <div className={s.row2}>
            <div className={s.field}>
              <label className="field-label">Ángulo Paco Cuevas</label>
              <textarea
                className="textarea"
                rows={2}
                value={anglePaco}
                onChange={(e) => setAnglePaco(e.target.value)}
                placeholder="Cómo usarlo para @pacocuevasia"
              />
            </div>
            <div className={s.field}>
              <label className="field-label">Ángulo FLUIA</label>
              <textarea
                className="textarea"
                rows={2}
                value={angleFluia}
                onChange={(e) => setAngleFluia(e.target.value)}
                placeholder="Cómo usarlo para @fluia.ai"
              />
            </div>
          </div>
          <div className={s.field}>
            <label className="field-label">Formato sugerido</label>
            <select
              className="input"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option>Reel 30s</option>
              <option>Reel 60s</option>
              <option>Carrusel</option>
            </select>
          </div>
          {error && <p className={s.error}>{error}</p>}
        </div>
        <div className={s.modalFoot}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={pending || !title.trim() || !url.trim()}
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal para importar reporte .md ─────────────────────────────────────────

type ImportModalProps = {
  onClose: () => void;
  onImported: (count: number) => void;
};

function ImportModal({ onClose, onImported }: ImportModalProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleImport() {
    startTransition(async () => {
      setError(null);
      const result = await importarReporte(text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onImported(result.count);
      onClose();
    });
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHead}>
          <div>
            <span className="eyebrow">Importar reporte de Claude.ai</span>
            <p className={s.modalSub}>
              Pega el reporte .md completo — Claude extrae todas las tendencias automáticamente
            </p>
          </div>
          <button className={s.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={s.modalBody}>
          <textarea
            className="textarea"
            rows={16}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Pega aquí el reporte generado por tu routine de Claude.ai…\n\nEjemplo:\n---\n🔥 [URGENTE]\n**GPT-5 llega con capacidades de razonamiento inéditas**\nFuente: The Verge | URL: https://theverge.com/...\n..."}
          />
          {pending && (
            <p className={s.importHint}>
              Parseando con IA… esto tarda unos segundos
            </p>
          )}
          {error && <p className={s.error}>{error}</p>}
        </div>
        <div className={s.modalFoot}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={pending || !text.trim()}
          >
            {pending ? "Importando…" : "Importar tendencias"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de tendencia ──────────────────────────────────────────────────────

type CardProps = {
  t: Tendencia;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TendenciaStatus) => void;
};

function TendenciaCard({ t, onDelete, onStatusChange }: CardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [updatingStatus, startStatus] = useTransition();

  function handleCrearGuion() {
    startStatus(async () => {
      await updateTendenciaStatus(t.id, "en_guion");
      onStatusChange(t.id, "en_guion");
      const type = inferType(t.format_suggested);
      const brief = buildBrief(t);
      const params = new URLSearchParams({ brief, type });
      router.push(`/guiones/nuevo?${params.toString()}`);
    });
  }

  function handleDescartar() {
    const next: TendenciaStatus = t.status === "descartada" ? "pendiente" : "descartada";
    startStatus(async () => {
      await updateTendenciaStatus(t.id, next);
      onStatusChange(t.id, next);
    });
  }

  function handleDelete() {
    startDelete(async () => {
      await deleteTendencia(t.id);
      onDelete(t.id);
    });
  }

  const hasAngles = t.angle_paco || t.angle_fluia;

  return (
    <div className={`${s.card} ${t.status === "descartada" ? s.cardDescartada : ""}`}>
      <div className={s.cardTop}>
        <div className={s.badges}>
          <UrgencyBadge urgency={t.urgency} />
          <FormatBadge format={t.format_suggested} />
          {t.status === "en_guion" && (
            <span className={s.badgeEnGuion}>✓ En guión</span>
          )}
          {t.status === "descartada" && (
            <span className={s.badgeDescartada}>Descartada</span>
          )}
        </div>
        <button
          className={s.deleteBtn}
          onClick={handleDelete}
          disabled={deleting}
          title="Eliminar"
        >
          ×
        </button>
      </div>

      <div className={s.cardContent}>
        <h3 className={s.cardTitle}>
          <a href={t.url} target="_blank" rel="noopener noreferrer" className={s.titleLink}>
            {t.title}
          </a>
        </h3>
        {t.source && <p className={s.cardSource}>{t.source}</p>}
        {t.summary && <p className={s.cardSummary}>{t.summary}</p>}

        {hasAngles && (
          <div className={s.anglesBlock}>
            <button
              className={s.anglesToggle}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "▲ Ocultar ángulos" : "▼ Ver ángulos de contenido"}
            </button>
            {expanded && (
              <div className={s.angles}>
                {t.angle_paco && (
                  <div className={s.angle}>
                    <span className={s.angleLabel}>@pacocuevasia</span>
                    <p className={s.angleText}>{t.angle_paco}</p>
                  </div>
                )}
                {t.angle_fluia && (
                  <div className={s.angle}>
                    <span className={s.angleLabel}>@fluia.ai</span>
                    <p className={s.angleText}>{t.angle_fluia}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={s.cardFoot}>
        <button
          className={`btn btn-ghost ${s.descartarBtn}`}
          onClick={handleDescartar}
          disabled={updatingStatus}
        >
          {t.status === "descartada" ? "Restaurar" : "Descartar"}
        </button>
        <button
          className="btn btn-primary"
          onClick={handleCrearGuion}
          disabled={updatingStatus || t.status === "descartada"}
        >
          {updatingStatus ? "…" : "Crear guión →"}
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function TendenciasClient({
  initialTendencias,
}: {
  initialTendencias: Tendencia[];
}) {
  const [tendencias, setTendencias] = useState<Tendencia[]>(initialTendencias);
  const [filter, setFilter] = useState<Filter>("todas");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const filtered =
    filter === "todas"
      ? tendencias.filter((t) => t.status !== "descartada")
      : tendencias.filter((t) => t.status === filter);

  const counts = {
    todas: tendencias.filter((t) => t.status !== "descartada").length,
    pendiente: tendencias.filter((t) => t.status === "pendiente").length,
    en_guion: tendencias.filter((t) => t.status === "en_guion").length,
    descartada: tendencias.filter((t) => t.status === "descartada").length,
  };

  function handleAdded(t: Tendencia) {
    setTendencias((prev) => [t, ...prev]);
  }

  function handleImported(count: number) {
    setImportedCount(count);
    // Refresh page data
    window.location.reload();
  }

  function handleDelete(id: string) {
    setTendencias((prev) => prev.filter((t) => t.id !== id));
  }

  function handleStatusChange(id: string, status: TendenciaStatus) {
    setTendencias((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  }

  return (
    <div className={s.page}>
      {/* ── Header ── */}
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Tendencias</h1>
          <p className={s.subtitle}>Noticias de IA filtradas para contenido · desde tu routine de Claude.ai</p>
        </div>
        <div className={s.headerActions}>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            Importar reporte
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + Nueva
          </button>
        </div>
      </div>

      {importedCount !== null && (
        <div className={s.importSuccess}>
          ✓ Se importaron {importedCount} tendencias correctamente
        </div>
      )}

      {/* ── Tabs de filtro ── */}
      <div className={s.tabs}>
        {(
          [
            { key: "todas", label: "Pendientes" },
            { key: "en_guion", label: "En guión" },
            { key: "descartada", label: "Descartadas" },
          ] as { key: Filter; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            className={`${s.tab} ${filter === key ? s.tabActive : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
            <span className={s.tabCount}>
              {key === "todas" ? counts.todas : counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* ── Grid de tarjetas ── */}
      {filtered.length === 0 ? (
        <div className={s.empty}>
          {filter === "todas"
            ? "No hay tendencias pendientes. Importa el reporte de Claude.ai o agrega una manualmente."
            : "Nada aquí todavía."}
        </div>
      ) : (
        <div className={s.grid}>
          {filtered.map((t) => (
            <TendenciaCard
              key={t.id}
              t={t}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* ── Modales ── */}
      {showAdd && (
        <AddModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={handleImported}
        />
      )}
    </div>
  );
}
