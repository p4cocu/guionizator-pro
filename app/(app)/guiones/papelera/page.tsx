/**
 * `/guiones/papelera` — guiones que un miembro del portal tiró (Fase D, etapa 7).
 *
 * Solo Paco la ve: no hay link a esto desde el portal. Sirve para deshacer un
 * tiro por error antes de que el cron los borre en firme a los 30 días
 * (`netlify/functions/cleanup-scripts-trash-scheduled.ts`).
 */

import Link from "next/link";
import { getTrashedScripts } from "../actions";
import TrashedScriptRow from "./TrashedScriptRow";
import styles from "../guiones.module.css";
import s from "./papelera.module.css";

const RETENTION_DAYS = 30;

function daysLeft(trashedAt: string): number {
  const trashedMs = new Date(trashedAt).getTime();
  const deadline = trashedMs + RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((deadline - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default async function PapeleraPage() {
  const scripts = await getTrashedScripts();

  return (
    <div>
      <div className={styles.header}>
        <div>
          <p className="eyebrow">Contenido</p>
          <h1 className={styles.title}>Papelera</h1>
          <p className={styles.subtitle}>
            {scripts.length} guion{scripts.length !== 1 ? "es" : ""} en la papelera. Se
            borran solos a los {RETENTION_DAYS} días de tirados.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/guiones" className="btn btn-ghost">
            ← Volver a Guiones
          </Link>
        </div>
      </div>

      {scripts.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🗑</div>
          <h2 className={styles.emptyTitle}>La papelera está vacía</h2>
          <p className={styles.emptyText}>
            Acá aparecen los guiones que un cliente tira desde su portal.
          </p>
        </div>
      ) : (
        <div className={s.list}>
          {scripts.map((script) => (
            <TrashedScriptRow key={script.id} script={script} daysLeft={daysLeft(script.trashed_at)} />
          ))}
        </div>
      )}
    </div>
  );
}
