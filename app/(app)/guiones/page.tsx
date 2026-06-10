import Link from "next/link";
import { getScripts, type ScriptRow } from "./actions";
import styles from "./guiones.module.css";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  produccion: "En producción",
  publicado: "Publicado",
};

function ScriptCard({ script }: { script: ScriptRow }) {
  const clientName = script.clients?.nombre ?? "—";
  const status = script.status ?? "idea";

  return (
    <Link href={`/guiones/${script.id}`} className={`card ${styles.card}`}>
      <div className={styles.cardMeta}>
        <span className={`${styles.typeBadge} ${styles[script.type]}`}>
          {script.type === "reel" ? "Reel" : "Carrusel"}
        </span>
        <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
          {STATUS_LABELS[status] ?? status}
        </span>
        <span className={styles.cardDate}>{formatDate(script.created_at)}</span>
      </div>
      <p className={styles.cardClient}>{clientName}</p>
      <p className={styles.cardStructure}>{script.title || script.structure_name}</p>
      {script.title && (
        <p style={{ fontSize: 11, color: "var(--text-dim)", margin: 0 }}>{script.structure_name}</p>
      )}
      <p className={styles.cardBrief}>{script.brief}</p>
    </Link>
  );
}

export default async function GuionesPage() {
  const scripts = await getScripts();

  return (
    <div>
      <div className={styles.header}>
        <div>
          <p className="eyebrow">Contenido</p>
          <h1 className={styles.title}>Guiones</h1>
          <p className={styles.subtitle}>
            {scripts.length} guion{scripts.length !== 1 ? "es" : ""} generado
            {scripts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/guiones/nuevo" className="btn btn-primary">
          + Nuevo guion
        </Link>
      </div>

      <div className={styles.grid}>
        {scripts.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>✍️</div>
            <h2 className={styles.emptyTitle}>Sin guiones todavía</h2>
            <p className={styles.emptyText}>
              Elige un cliente, escribe el brief y el cerebro propone 3 estructuras
              narrativas. Tú eliges y se genera el guion completo.
            </p>
            <Link href="/guiones/nuevo" className="btn btn-primary">
              Crear primer guion
            </Link>
          </div>
        ) : (
          scripts.map((s) => <ScriptCard key={s.id} script={s} />)
        )}
      </div>
    </div>
  );
}
