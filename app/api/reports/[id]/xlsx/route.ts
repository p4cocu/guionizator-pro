/**
 * GET /api/reports/[id]/xlsx — descarga el Excel del reporte.
 * Se regenera desde el snapshot en cada descarga (no se guarda el archivo).
 * Autenticación por sesión: NO va en PUBLIC_PATHS.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadReport, downloadFilename } from "@/lib/reports/load";
import { buildReportXlsx } from "@/lib/reports/xlsx";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const report = await loadReport(supabase, user.id, id);
  if (!report) return NextResponse.json({ error: "Reporte no encontrado." }, { status: 404 });

  try {
    const buffer = await buildReportXlsx(report.snapshot);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${downloadFilename(report, "xlsx")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo generar el Excel." },
      { status: 500 },
    );
  }
}
