import Link from "next/link";
import { getScripts, getClientOptions, type ScriptRow, type ScriptType, type RecordingType } from "./actions";
import styles from "./guiones.module.css";
import ScriptIdChip from "./ScriptIdChip";
import ClientFilter from "./ClientFilter";
import StarButton from "./StarButton";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  preproduccion: "Preproducción",
  produccion: "En producción",
  listo: "Listo",
  publicado: "Publicado",
  baul: "Baúl",
};

const CARD_BORDER_BY_STATUS: Record<string, string> = {
  idea: "var(--glass-border)",
  preproduccion: "rgba(134, 220, 174, 0.45)",
  produccion: "rgba(255, 210, 58, 0.45)",
  listo: "rgba(255, 235, 150, 0.5)",
  publicado: "transparent",
  baul: "rgba(157, 142, 201, 0.45)",
};

export const RECORDING_TYPE_LABELS: Record<RecordingType, string> = {
  voz_off: "🎙 Voz en off",
  actuacion: "🎭 Actuación",
  actuacion_compu: "🎭💻 Actuación + compu",
  actuacion_cel: "🎭📱 Actuación + cel",
  compu: "💻 Compu",
  cel: "📱 Cel",
};

const RECORDING_TYPE_COLORS: Record<RecordingType, { bg: string; color: string; border: string }> = {
  voz_off:         { bg: "rgba(99,179,237,0.14)",  color: "#63b3ed", border: "rgba(99,179,237,0.3)" },
  actuacion:       { bg: "rgba(255,210,58,0.14)",  color: "var(--signal)", border: "rgba(255,210,58,0.3)" },
  actuacion_compu: { bg: "rgba(255,111,97,0.14)",  color: "var(--flare)", border: "rgba(255,111,97,0.3)" },
  actuacion_cel:   { bg: "rgba(183,148,244,0.14)", color: "#b794f4", border: "rgba(183,148,244,0.3)" },
  compu:           { bg: "rgba(0,159,125,0.14)",   color: "var(--emerald)", border: "rgba(0,159,125,0.3)" },
  cel:             { bg: "rgba(0,159,125,0.08)",   color: "var(--emerald)", border: "rgba(0,159,125,0.2)" },
};

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

function ScriptCard({ script, hideClient }: { script: ScriptRow; hideClient: boolean }) {
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
      {/* Lo pidió el cliente desde su portal (add-on de IA, Fase D etapa 6). */}
      {script.generated_by && (
        <div>
          <span className={styles.clientGenerated}>✦ Generado por el cliente</span>
        </div>
      )}
      {!hideClient && <p className={styles.cardClient}>{clientName}</p>}
      <p className={styles.cardStructure}>{script.title || <span style={{ opacity: 0.45 }}>Sin título</span>}</p>
      <p style={{ fontSize: 11, color: "var(--text-dim)", margin: 0 }}>{script.structure_name}</p>
      <p className={styles.cardBrief}>{script.brief}</p>
      <ScriptIdChip id={script.id} />
    </Link>
  );
}

export default async function GuionesPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; tipo?: string; estado?: string | string[] }>;
}) {
  const { cliente, tipo, estado } = await searchParams;
  const scriptType = (tipo === "reel" || tipo === "carousel") ? (tipo as ScriptType) : undefined;
  const estadoRaw = estado ?? [];
  const estados = Array.isArray(estadoRaw) ? estadoRaw : [estadoRaw];
  const [scripts, clients] = await Promise.all([
    getScripts(cliente, scriptType, estados),
    getClientOptions(),
  ]);

  const selectedClient = clients.find((c) => c.id === cliente);
  const typeLabel = scriptType === "reel" ? "Reels" : scriptType === "carousel" ? "Carruseles" : null;
  const estadosLabel = estados.length > 0 ? ` · ${estados.map((e) => STATUS_LABELS[e] ?? e).join(", ")}` : "";

  return (
    <div>
      <div className={styles.header}>
        <div>
          <p className="eyebrow">Contenido</p>
          <h1 className={styles.title}>Guiones</h1>
          <p className={styles.subtitle}>
            {scripts.length} guion{scripts.length !== 1 ? "es" : ""}{" "}
            {selectedClient ? `de ${selectedClient.nombre}` : "en total"}
            {typeLabel ? ` · ${typeLabel}` : ""}
            {estadosLabel}
          </p>
        </div>
        <div className={styles.headerActions}>
          <ClientFilter clients={clients} />
          <Link href="/guiones/nuevo" className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>
            + Nuevo guion
          </Link>
        </div>
      </div>

      <div className={styles.grid}>
        {scripts.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>✍️</div>
            <h2 className={styles.emptyTitle}>
              {selectedClient
                ? `Sin guiones para ${selectedClient.nombre}`
                : "Sin guiones todavía"}
            </h2>
            <p className={styles.emptyText}>
              {selectedClient
                ? "Este cliente no tiene guiones aún. Crea el primero."
                : "Elige un cliente, escribe el brief y el cerebro propone 3 estructuras narrativas. Tú eliges y se genera el guion completo."}
            </p>
            <Link href="/guiones/nuevo" className="btn btn-primary">
              Crear primer guion
            </Link>
          </div>
        ) : (
          scripts.map((s) => (
            <ScriptCard key={s.id} script={s} hideClient={!!selectedClient} />
          ))
        )}
      </div>
    </div>
  );
}
