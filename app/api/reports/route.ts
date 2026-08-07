/**
 * POST /api/reports — crea un reporte a partir de los posts seleccionados.
 *
 * Guarda el snapshot congelado y devuelve el id; la descarga vive en
 * /api/reports/[id]/xlsx y /api/reports/[id]/pdf.
 *
 * Autenticación por SESIÓN de usuario (no es server-to-server), así que NO va
 * en PUBLIC_PATHS del middleware.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildReportSnapshot } from "@/lib/reports/snapshot";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    client_id?: string;
    post_ids?: string[];
    title?: string;
    period_start?: string | null;
    period_end?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const clientId = body.client_id?.trim();
  const postIds = Array.isArray(body.post_ids) ? body.post_ids.filter(Boolean) : [];

  if (!clientId) return NextResponse.json({ error: "client_id es requerido." }, { status: 400 });
  if (postIds.length === 0) {
    return NextResponse.json({ error: "Selecciona al menos un post." }, { status: 400 });
  }

  const built = await buildReportSnapshot(supabase, user.id, {
    clientId,
    postIds,
    periodStart: body.period_start?.trim() || null,
    periodEnd: body.period_end?.trim() || null,
  });

  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });

  const title =
    body.title?.trim() ||
    `Reporte de competencia — ${built.snapshot.client.marca || built.snapshot.client.nombre}`;

  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      owner_id: user.id,
      client_id: clientId,
      title,
      period_start: body.period_start?.trim() || null,
      period_end: body.period_end?.trim() || null,
      snapshot: built.snapshot,
      post_count: built.snapshot.rows.length,
    })
    .select("id, title, created_at, post_count")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    id: report.id,
    title: report.title,
    created_at: report.created_at,
    post_count: report.post_count,
    stats: built.snapshot.stats,
  });
}
