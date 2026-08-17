/**
 * Transcripción online de un post de competencia — SERVER-ONLY.
 *
 * Reemplaza el pipeline local (`scripts/transcribe_reel.py`, faster-whisper +
 * yt-dlp en la Mac de Paco). El flujo:
 *
 *   1. Probar el `video_url` guardado del último scrape (migración `0010`).
 *   2. Si falló (link firmado de Instagram, expira en horas), pedirle a Apify
 *      ESE post puntual de nuevo (`fetchFreshVideoUrl`, `directUrls`) y
 *      reintentar una vez.
 *   3. Mandar el video a Whisper (`lib/ai/openai.ts`).
 *   4. Guardar la transcripción en `competitor_posts.transcription`.
 *
 * Usa `createServiceClient()` para leer/escribir: tanto la ruta del estudio
 * como las del portal lo llaman, y el portal no tiene sesión con permiso de
 * `update` sobre `competitor_posts`. Toda consulta filtra `owner_id` a mano
 * porque el service role saltea la RLS.
 */

import { createServiceClient } from "../supabase/service";
import { fetchFreshVideoUrl } from "../apify/client";
import { resolveApifyToken } from "./apifyToken";
import { transcribeVideo, TranscribeError } from "../ai/openai";

export class TranscribeCompetitorError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "TranscribeCompetitorError";
    this.status = status;
  }
}

type PostRow = {
  id: string;
  owner_id: string;
  client_id: string;
  username: string;
  permalink: string | null;
  type: string | null;
  video_url: string | null;
};

/** ¿El link todavía sirve? Un HEAD alcanza y no gasta bytes de descarga. */
async function isUrlAlive(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resuelve un `video_url` utilizable para este post: el guardado si sigue
 * vivo, o uno fresco pedido a Apify si no. Actualiza `competitor_posts` con el
 * nuevo link para que el próximo intento no tenga que volver a pedirlo.
 */
async function resolveVideoUrl(post: PostRow): Promise<string> {
  if (post.video_url && (await isUrlAlive(post.video_url))) {
    return post.video_url;
  }

  if (!post.permalink) {
    throw new TranscribeCompetitorError("Este post no tiene un link de Instagram guardado.", 400);
  }

  const { token } = await resolveApifyToken(post.client_id);
  const fresh = await fetchFreshVideoUrl(token, post.permalink);
  if (!fresh) {
    throw new TranscribeCompetitorError(
      "Instagram ya no tiene este video disponible (se borró o el post cambió).",
      404,
    );
  }

  const admin = createServiceClient();
  await admin
    .from("competitor_posts")
    .update({ video_url: fresh })
    .eq("id", post.id)
    .eq("owner_id", post.owner_id);

  return fresh;
}

/**
 * Transcribe un post y guarda el resultado. No mide tope ni escribe en
 * `transcription_usage_log` — eso lo decide el caller (el estudio no mide, el
 * portal sí) para no duplicar la política de cuándo cuenta cada uno.
 */
export async function transcribeCompetitorPost(
  postId: string,
  ownerId: string,
): Promise<{ transcription: string; clientId: string }> {
  const admin = createServiceClient();

  const { data: post, error } = await admin
    .from("competitor_posts")
    .select("id, owner_id, client_id, username, permalink, type, video_url")
    .eq("id", postId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw new TranscribeCompetitorError(error.message, 500);
  if (!post) throw new TranscribeCompetitorError("Ese post no existe.", 404);
  const row = post as PostRow;

  if (row.type === "image") {
    throw new TranscribeCompetitorError("Esto es una imagen, no tiene audio que transcribir.", 400);
  }

  const videoUrl = await resolveVideoUrl(row);

  let transcription: string;
  try {
    transcription = await transcribeVideo(videoUrl);
  } catch (e) {
    if (e instanceof TranscribeError) throw new TranscribeCompetitorError(e.message, e.status ?? 500);
    throw e;
  }

  const { error: updErr } = await admin
    .from("competitor_posts")
    .update({ transcription })
    .eq("id", row.id)
    .eq("owner_id", ownerId);

  if (updErr) throw new TranscribeCompetitorError(updErr.message, 500);

  return { transcription, clientId: row.client_id };
}

export function transcribeErrorInfo(e: unknown): { message: string; status: number } {
  if (e instanceof TranscribeCompetitorError) return { message: e.message, status: e.status };
  return {
    message: e instanceof Error ? e.message : "No se pudo transcribir.",
    status: 500,
  };
}
