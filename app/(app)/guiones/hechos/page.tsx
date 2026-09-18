/**
 * `/guiones/hechos` — el archivo de lo que ya se subió.
 *
 * Un guion llega acá cuando su `status` pasa a `publicado`, con el botón
 * "✓ Ya lo subí" del detalle. No es un estado nuevo: se reusa el `publicado`
 * que ya existía en el `CHECK` de `scripts.status`, así que no hubo migración
 * y todo lo que ya estaba marcado como publicado aparece de entrada.
 *
 * Es la contracara de `/guiones`, que desde este cambio muestra solo lo que
 * está en proceso.
 */

import Link from "next/link";
import { getScripts, getClientOptions, type ScriptType } from "../actions";
import styles from "../guiones.module.css";
import ClientFilter from "../ClientFilter";
import ScriptCard from "../ScriptCard";
import GuionesTabs from "../GuionesTabs";

export default async function GuionesHechosPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; tipo?: string }>;
}) {
  const { cliente, tipo } = await searchParams;
  const scriptType = (tipo === "reel" || tipo === "carousel") ? (tipo as ScriptType) : undefined;

  const [scripts, clients] = await Promise.all([
    getScripts(cliente, scriptType, ["publicado"]),
    getClientOptions(),
  ]);

  const selectedClient = clients.find((c) => c.id === cliente);
  const typeLabel = scriptType === "reel" ? "Reels" : scriptType === "carousel" ? "Carruseles" : null;

  return (
    <div>
      <div className={styles.header}>
        <div>
          <p className="eyebrow">Contenido</p>
          <h1 className={styles.title}>Hechos</h1>
          <p className={styles.subtitle}>
            {scripts.length} publicación{scripts.length !== 1 ? "es" : ""} ya subida
            {scripts.length !== 1 ? "s" : ""}{" "}
            {selectedClient ? `de ${selectedClient.nombre}` : "en total"}
            {typeLabel ? ` · ${typeLabel}` : ""}
          </p>
        </div>
        <div className={styles.headerActions}>
          <ClientFilter clients={clients} basePath="/guiones/hechos" showEstados={false} />
          <Link href="/guiones/nuevo" className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>
            + Nuevo guion
          </Link>
        </div>
      </div>

      <GuionesTabs active="hechos" cliente={cliente} tipo={tipo} doneCount={scripts.length} />

      <div className={styles.grid}>
        {scripts.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>✓</div>
            <h2 className={styles.emptyTitle}>
              {selectedClient
                ? `${selectedClient.nombre} no tiene publicaciones subidas`
                : "Todavía no marcaste nada como subido"}
            </h2>
            <p className={styles.emptyText}>
              Cuando grabes y subas el video de un guion, abrilo y tocá
              “✓ Ya lo subí”. Se archiva acá y deja de estorbar en la lista de lo
              que está en proceso.
            </p>
            <Link href="/guiones" className="btn btn-ghost">
              Ver lo que está en proceso
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
