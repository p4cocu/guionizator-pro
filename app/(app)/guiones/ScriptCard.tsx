/**
 * La tarjeta de un guion en la grilla. La comparten `/guiones` (lo que está en
 * proceso) y `/guiones/hechos` (lo ya subido): son la misma tarjeta, cambia el
 * conjunto de filas que se lista.
 */

import Link from "next/link";
import type { ScriptRow, RecordingType } from "./actions";
import {
  STATUS_LABELS,
  CARD_BORDER_BY_STATUS,
  RECORDING_TYPE_LABELS,
  RECORDING_TYPE_COLORS,
} from "./labels";
import ScriptIdChip from "./ScriptIdChip";
import StarButton from "./StarButton";
import { evaluatePerformance, sanitizeIgMetrics, shortNumber } from "@/lib/multiply/metrics";
import styles from "./guiones.module.css";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function RecordingTypeBadge({ type }: { type: RecordingType }) {
  const c = RECORDING_TYPE_COLORS[type];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: "var(--r-pill)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {RECORDING_TYPE_LABELS[type]}
    </span>
  );
}

export default function ScriptCard({
  script,
  hideClient,
}: {
  script: ScriptRow;
  hideClient: boolean;
}) {
  const clientName = script.clients?.nombre ?? "—";
  const status = script.status ?? "idea";
  const borderColor = script.featured
    ? "rgba(255, 210, 58, 0.7)"
    : script.has_resource
    ? "rgba(255, 215, 0, 0.55)"
    : (CARD_BORDER_BY_STATUS[status] ?? "var(--glass-border)");

  return (
    <Link href={`/guiones/${script.id}`} className={`card ${styles.card} ${status === "publicado" ? styles.publicado : ""}`} style={{ borderColor }}>
      <div className={styles.cardMeta}>
        <span className={`${styles.typeBadge} ${styles[script.type]}`}>
          {script.type === "reel" ? "Reel" : "Carrusel"}
        </span>
        <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
          {STATUS_LABELS[status] ?? status}
        </span>
        <span className={styles.cardDate}>{formatDate(script.created_at)}</span>
        <StarButton scriptId={script.id} featured={script.featured} />
      </div>
      {script.recording_type && (
        <div>
          <RecordingTypeBadge type={script.recording_type} />
        </div>
      )}
      {/* Se grabó fuera de la app y la ficha existe para el copy y la portada
          (migración 0014). */}
      {script.is_external && (
        <div>
          <span className={styles.externalBadge}>⏺ Grabado fuera</span>
        </div>
      )}
      {/* Servicio que promueve (migración 0016). */}
      {script.client_products?.nombre && (
        <div>
          <span className={styles.productBadge}>◆ {script.client_products.nombre}</span>
        </div>
      )}
      {/* Lo pidió el cliente desde su portal (add-on de IA, Fase D etapa 6). */}
      {script.generated_by && (
        <div>
          <span className={styles.clientGenerated}>✦ Generado por el cliente</span>
        </div>
      )}
      {/* Rendimiento en Instagram (0022): solo en lo publicado. */}
      {status === "publicado" && <PerformanceLine script={script} />}
      {!hideClient && <p className={styles.cardClient}>{clientName}</p>}
      <p className={styles.cardStructure}>{script.title || <span style={{ opacity: 0.45 }}>Sin título</span>}</p>
      <p style={{ fontSize: 11, color: "var(--text-dim)", margin: 0 }}>{script.structure_name}</p>
      <p className={styles.cardBrief}>{script.brief}</p>
      <ScriptIdChip id={script.id} />
    </Link>
  );
}

function PerformanceLine({ script }: { script: ScriptRow }) {
  if (!script.ig_media_id) {
    return <p className={styles.perfLine}>Sin vincular a su post</p>;
  }
  const m = sanitizeIgMetrics(script.ig_metrics);
  if (!m) return <p className={styles.perfLine}>Vinculado · sin métricas</p>;
  const perf = evaluatePerformance(m, script.ig_posted_at ?? null);
  return (
    <div className={styles.perfRow}>
      {perf.worked && perf.best && (
        <span className={styles.perfWorked}>
          🔥 {perf.best.x}× {perf.best.label}
        </span>
      )}
      <span className={styles.perfLine}>
        {m.views !== null ? `▶ ${shortNumber(m.views)}` : `👁 ${shortNumber(m.reach)}`}
        {` · ↗ ${shortNumber(m.shares)} · 🔖 ${shortNumber(m.saved)}`}
      </span>
    </div>
  );
}
