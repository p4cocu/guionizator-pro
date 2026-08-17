/**
 * `POST /api/transcribe-reel` — transcripción desde el ESTUDIO (`/competencia`).
 *
 * Antes requería que Paco descargara el video a mano y pegara la ruta local
 * (corría faster-whisper en su Mac). Ahora es online: un clic, sin `file_path`.
 * Ver `lib/competencia/transcribe.ts` para el detalle del pipeline.
 *
 * **Sin tope**: transcribir desde el estudio es tuyo — no escribe en
 * `transcription_usage_log` ni descuenta del `transcription_limit` de nadie.
 * Eso es exclusivo de las transcripciones que dispara el portal
 * (`app/(portal)/portal/[clientId]/competencia/actions.ts`).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeCompetitorPost, transcribeErrorInfo } from "@/lib/competencia/transcribe";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { post_id } = (await req.json()) as { post_id?: string };
  if (!post_id) return NextResponse.json({ error: "post_id es requerido" }, { status: 400 });

  try {
    const { transcription } = await transcribeCompetitorPost(post_id, user.id);
    return NextResponse.json({ transcription });
  } catch (e) {
    const { message, status } = transcribeErrorInfo(e);
    if (status >= 500) console.error("[transcribe-reel]", e);
    return NextResponse.json({ error: message }, { status });
  }
}
