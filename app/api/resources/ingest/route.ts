import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classifyResource, type ClientLite } from "@/lib/resources/classify";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Endpoint de ingesta para el Shortcut de iPhone (sin sesión / cookies).
 * Auth por token de ingesta: `Authorization: Bearer <token>` o `x-ingest-token`.
 * Resuelve el owner vía service-role (bypassa RLS), clasifica con Claude y guarda.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
    const token = bearer ?? req.headers.get("x-ingest-token")?.trim() ?? null;
    if (!token) {
      return NextResponse.json({ error: "Falta el token de ingesta." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Configuración del servidor incompleta." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: ownerId } = await supabase.rpc("lookup_ingest_token", { p_token: token });

    if (!ownerId) {
      return NextResponse.json({ error: "Token inválido." }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { url?: string; text?: string; source_name?: string };
    const url = body.url?.trim() || null;
    const text = body.text?.trim() || null;
    const sourceName = body.source_name?.trim() || null;
    if (!url && !text) {
      return NextResponse.json({ error: "Envía al menos un 'url' o 'text'." }, { status: 400 });
    }

    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, nombre, nicho, que_vende, cliente_ideal, dolor, deseo")
      .eq("owner_id", ownerId);
    const clients = (clientsData ?? []) as ClientLite[];

    const classified = await classifyResource({ url, text, clients });

    const { data: inserted, error } = await supabase
      .from("resources")
      .insert({
        owner_id: ownerId,
        source_url: url,
        raw_text: text,
        category: classified.category,
        title: classified.title,
        summary: classified.summary,
        prompt_text: classified.prompt_text,
        client_id: classified.client_id,
        client_auto: classified.client_auto,
        tags: classified.tags,
        ingest_source: "shortcut",
        source_name: sourceName,
      })
      .select("id, title, category, summary, client_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let clientName: string | null = null;
    if (inserted.client_id) {
      clientName = clients.find((c) => c.id === inserted.client_id)?.nombre ?? null;
    }

    return NextResponse.json({
      ok: true,
      resource: {
        id: inserted.id,
        title: inserted.title,
        category: inserted.category,
        summary: inserted.summary,
        client: clientName,
      },
    });
  } catch (e) {
    console.error("[resources/ingest] Error:", e);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
