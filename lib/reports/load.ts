/**
 * Carga de un reporte guardado + nombre de archivo de descarga.
 * Compartido por las rutas /api/reports/[id]/xlsx y /pdf.
 *
 * SERVER-ONLY.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { listPortalClients } from "../portal/access";
import { hasFeature } from "../portal/features";
import { getBillingState } from "../billing/access";
import type { ReportSnapshot } from "./snapshot";

export type LoadedReport = {
  id: string;
  title: string;
  createdAt: string;
  snapshot: ReportSnapshot;
};

export async function loadReport(
  supabase: SupabaseClient,
  ownerId: string,
  reportId: string,
): Promise<LoadedReport | null> {
  const { data } = await supabase
    .from("reports")
    .select("id, title, created_at, snapshot")
    .eq("id", reportId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id as string,
    title: data.title as string,
    createdAt: data.created_at as string,
    snapshot: data.snapshot as ReportSnapshot,
  };
}

/**
 * El reporte que puede descargar este usuario, sea el dueño o un miembro del
 * portal. Devuelve `null` si no le corresponde — las rutas contestan 404 igual
 * en los dos casos, así que nadie averigua si el id existe.
 *
 * Dos caminos, a propósito:
 *
 *  - **Dueño**: filtra `owner_id`, exactamente como antes. No mira
 *    `enabled_features`: los flags son del portal, no de su propio estudio.
 *  - **Miembro del portal**: el reporte tiene que ser de una marca suya, esa
 *    marca tener la sección `reportes` prendida **y** estar pagada (Fase E).
 *    Sin la segunda condición, apagar el switch escondería la pantalla pero el
 *    link directo al .xlsx seguiría sirviendo; sin la tercera, lo mismo con una
 *    marca suspendida por falta de pago. Es justo el agujero que el doble —
 *    ahora triple — candado evita.
 *
 * La RLS (`reports_member_select`, migración `0006`) ya impide leer reportes de
 * otras marcas; el `.in("client_id", …)` de acá es defensa en profundidad.
 */
export async function loadReportForUser(
  supabase: SupabaseClient,
  userId: string,
  reportId: string,
): Promise<LoadedReport | null> {
  const asOwner = await loadReport(supabase, userId, reportId);
  if (asOwner) return asOwner;

  const conReportes = (await listPortalClients(userId)).filter((c) =>
    hasFeature(c.features, "reportes"),
  );

  // El estado de cobro se consulta por marca. `getBillingState` va cacheado por
  // request, así que pedirlo para varias marcas no multiplica consultas cuando
  // la pantalla ya lo pidió.
  const estados = await Promise.all(
    conReportes.map(async (c) => ({ id: c.id, ok: (await getBillingState(c.id)).ok })),
  );

  const clientIds = estados.filter((e) => e.ok).map((e) => e.id);

  if (clientIds.length === 0) return null;

  const { data } = await supabase
    .from("reports")
    .select("id, title, created_at, snapshot")
    .eq("id", reportId)
    .in("client_id", clientIds)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id as string,
    title: data.title as string,
    createdAt: data.created_at as string,
    snapshot: data.snapshot as ReportSnapshot,
  };
}

/**
 * Nombre de archivo seguro para el header Content-Disposition: sin acentos ni
 * caracteres que rompan el header o el sistema de archivos del cliente.
 */
export function downloadFilename(report: LoadedReport, ext: "xlsx" | "pdf"): string {
  const marca = report.snapshot.client.marca || report.snapshot.client.nombre;
  const fecha = report.createdAt.slice(0, 10);
  const base = `${marca}-competencia-${fecha}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${base || "reporte"}.${ext}`;
}
