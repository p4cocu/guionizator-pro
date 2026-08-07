/**
 * Carga de un reporte guardado + nombre de archivo de descarga.
 * Compartido por las rutas /api/reports/[id]/xlsx y /pdf.
 *
 * SERVER-ONLY.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
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
