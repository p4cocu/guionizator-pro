/**
 * `/guiones` — lo que está EN PROCESO.
 *
 * Los guiones en `publicado` (el video ya se grabó y se subió) no aparecen acá:
 * viven en la pestaña "Hechos" (`/guiones/hechos`). Es la misma lógica con la
 * que el Baúl se esconde — `getScripts` los filtra salvo que se pidan por
 * estado explícitamente.
 */

import Link from "next/link";
import { getScripts, getClientOptions, countDoneScripts, type ScriptType } from "./actions";
import { STATUS_LABELS } from "./labels";
import styles from "./guiones.module.css";
import ClientFilter from "./ClientFilter";
import ScriptCard from "./ScriptCard";
import GuionesTabs from "./GuionesTabs";

export default async function GuionesPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; tipo?: string; estado?: string | string[] }>;
}) {
  const { cliente, tipo, estado } = await searchParams;
  const scriptType = (tipo === "reel" || tipo === "carousel") ? (tipo as ScriptType) : undefined;
  const estadoRaw = estado ?? [];
  const estados = Array.isArray(estadoRaw) ? estadoRaw : [estadoRaw];
  const [scripts, clients, doneCount] = await Promise.all([
    getScripts(cliente, scriptType, estados),
    getClientOptions(),
    countDoneScripts(cliente, scriptType),
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
          <Link href="/guiones/papelera" className="btn btn-ghost" style={{ whiteSpace: "nowrap" }}>
            🗑 Papelera
          </Link>
          <Link href="/guiones/nuevo" className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>
            + Nuevo guion
          </Link>
        </div>
      </div>

      <GuionesTabs active="proceso" cliente={cliente} tipo={tipo} doneCount={doneCount} />

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
