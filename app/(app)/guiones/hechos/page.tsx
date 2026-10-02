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
import { getScripts, getClientOptions, getProductFilterOptions, type ScriptType } from "../actions";
import styles from "../guiones.module.css";
import ClientFilter from "../ClientFilter";
import ScriptCard from "../ScriptCard";
import GuionesTabs from "../GuionesTabs";
import PerformanceToolbar from "./PerformanceToolbar";
import { evaluatePerformance, sanitizeIgMetrics, WORKED_THRESHOLD } from "@/lib/multiply/metrics";

export default async function GuionesHechosPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; tipo?: string; servicio?: string; funciono?: string }>;
}) {
  const { cliente, tipo, servicio, funciono } = await searchParams;
  const scriptType = (tipo === "reel" || tipo === "carousel") ? (tipo as ScriptType) : undefined;

  const [allScripts, clients, services] = await Promise.all([
    getScripts(cliente, scriptType, ["publicado"], servicio || undefined),
    getClientOptions(),
    getProductFilterOptions(),
  ]);
  const selectedService = services.find((sv) => sv.id === servicio);

  // "Funcionó" lo decide el código contra la mediana de la cuenta (0022).
  const worked = new Set(
    allScripts
      .filter((sc) => evaluatePerformance(sanitizeIgMetrics(sc.ig_metrics), sc.ig_posted_at ?? null).worked)
      .map((sc) => sc.id),
  );
  const onlyWorked = funciono === "1";
  const scripts = onlyWorked ? allScripts.filter((sc) => worked.has(sc.id)) : allScripts;
  const toggleParams = new URLSearchParams(
    Object.entries({ cliente, tipo, servicio, funciono: onlyWorked ? undefined : "1" }).filter(
      (e): e is [string, string] => typeof e[1] === "string" && e[1] !== "",
    ),
  );
  const toggleHref = `/guiones/hechos${toggleParams.size ? `?${toggleParams}` : ""}`;

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
            {selectedService ? ` · ◆ ${selectedService.nombre}` : ""}
          </p>
        </div>
        <div className={styles.headerActions}>
          <ClientFilter clients={clients} services={services} basePath="/guiones/hechos" showEstados={false} />
          <Link href="/guiones/nuevo" className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>
            + Nuevo guion
          </Link>
        </div>
      </div>

      <GuionesTabs active="hechos" cliente={cliente} tipo={tipo} servicio={servicio} doneCount={allScripts.length} />

      <PerformanceToolbar
        clientId={cliente || undefined}
        workedCount={worked.size}
        onlyWorked={onlyWorked}
        toggleHref={toggleHref}
      />

      <div className={styles.grid}>
        {scripts.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>✓</div>
            <h2 className={styles.emptyTitle}>
              {onlyWorked
                ? `Nada pasó todavía de ${WORKED_THRESHOLD}× la mediana de su cuenta`
                : selectedClient
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
