"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getProfile,
  getMedia,
  getMediaInsights,
  refreshToken,
  InstagramApiError,
  type IgMedia,
  type IgInsights,
} from "@/lib/instagram/client";

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

/** Días de vida estimada de un long-lived token de Instagram. */
const TOKEN_TTL_DAYS = 60;

function expiryFromNow(days = TOKEN_TTL_DAYS): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export type ConnectResult =
  | { ok: true; username: string }
  | { ok: false; error: string };

/**
 * Conecta una cuenta de Instagram pegando el long-lived token generado en
 * Meta Developer. Valida el token contra la API antes de guardarlo.
 */
export async function connectInstagram(
  token: string,
  clientId: string | null,
): Promise<ConnectResult> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, error: "Pega un token válido." };

  const { supabase, user } = await getAuthUser();

  let profile;
  try {
    profile = await getProfile(trimmed);
  } catch (e) {
    const msg =
      e instanceof InstagramApiError
        ? e.message
        : "No se pudo validar el token con Instagram.";
    return { ok: false, error: msg };
  }

  const { error } = await supabase.from("instagram_accounts").upsert(
    {
      owner_id: user.id,
      client_id: clientId,
      ig_user_id: profile.user_id,
      username: profile.username,
      access_token: trimmed,
      token_expires_at: expiryFromNow(),
      last_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,ig_user_id" },
  );

  if (error) return { ok: false, error: error.message };

  if (clientId) revalidatePath(`/clientes/${clientId}`);
  return { ok: true, username: profile.username };
}

export async function disconnectInstagram(accountId: string, clientId?: string) {
  const { supabase, user } = await getAuthUser();
  const { error } = await supabase
    .from("instagram_accounts")
    .delete()
    .eq("id", accountId)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}

/** Devuelve la cuenta IG vinculada a un cliente (sin exponer el token). */
export async function getInstagramAccountForClient(clientId: string) {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("instagram_accounts")
    .select(
      "id, ig_user_id, username, token_expires_at, created_at, last_refresh_attempt_at, last_refresh_error",
    )
    .eq("owner_id", user.id)
    .eq("client_id", clientId)
    .maybeSingle();
  return data;
}

async function loadAccountToken(accountId: string) {
  const { supabase, user } = await getAuthUser();
  const { data, error } = await supabase
    .from("instagram_accounts")
    .select("id, ig_user_id, access_token")
    .eq("id", accountId)
    .eq("owner_id", user.id)
    .single();
  if (error || !data) throw new Error("Cuenta de Instagram no encontrada.");
  return { supabase, user, account: data };
}

export type MediaResult =
  | { ok: true; media: IgMedia[] }
  | { ok: false; error: string };

/** Trae los posts del cliente. El token nunca sale del server. */
export async function fetchInstagramMedia(accountId: string): Promise<MediaResult> {
  try {
    const { account } = await loadAccountToken(accountId);
    const media = await getMedia(account.access_token);
    return { ok: true, media };
  } catch (e) {
    const msg =
      e instanceof InstagramApiError ? e.message : "No se pudieron traer los posts.";
    return { ok: false, error: msg };
  }
}

export type InsightsResult =
  | { ok: true; insights: IgInsights }
  | { ok: false; error: string };

export async function fetchInstagramInsights(
  accountId: string,
  mediaId: string,
): Promise<InsightsResult> {
  try {
    const { account } = await loadAccountToken(accountId);
    const insights = await getMediaInsights(mediaId, account.access_token);
    return { ok: true, insights };
  } catch (e) {
    const msg =
      e instanceof InstagramApiError
        ? e.message
        : "No se pudieron traer las métricas.";
    return { ok: false, error: msg };
  }
}

/** Lista todas las cuentas IG del owner para el selector del dashboard. */
export async function listInstagramAccounts() {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("instagram_accounts")
    .select("id, username, ig_user_id, client_id, clients(nombre)")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });
  return (data ?? []).map((a) => ({
    id: a.id as string,
    username: (a.username as string) ?? a.ig_user_id,
    clientId: (a.client_id as string | null) ?? null,
    clientName:
      (a.clients as { nombre?: string } | null)?.nombre ?? null,
  }));
}

export type PostWithMetrics = IgMedia & { insights: IgInsights };

export type BestPostsResult =
  | { ok: true; posts: PostWithMetrics[] }
  | { ok: false; error: string };

/**
 * Trae los posts de una cuenta + sus métricas (en paralelo) para el dashboard.
 * No ordena aquí: el cliente reordena según la métrica elegida sin re-pedir.
 */
export async function fetchBestPosts(accountId: string): Promise<BestPostsResult> {
  try {
    const { account } = await loadAccountToken(accountId);
    const media = await getMedia(account.access_token, 50);

    const posts = await Promise.all(
      media.map(async (m): Promise<PostWithMetrics> => {
        // Las métricas válidas dependen del tipo de media.
        const metrics =
          m.media_type === "VIDEO"
            ? ["reach", "likes", "comments", "shares", "saved", "views"]
            : ["reach", "likes", "comments", "shares", "saved"];
        try {
          const insights = await getMediaInsights(
            m.id,
            account.access_token,
            metrics,
          );
          return { ...m, insights };
        } catch {
          return { ...m, insights: {} };
        }
      }),
    );

    return { ok: true, posts };
  } catch (e) {
    const msg =
      e instanceof InstagramApiError
        ? e.message
        : "No se pudieron traer las métricas.";
    return { ok: false, error: msg };
  }
}

// ─── Transcripción ───────────────────────────────────────────────────────────

export type QueueTranscriptionResult =
  | { ok: true; jobId: string; alreadyQueued: boolean }
  | { ok: false; error: string };

/**
 * Registra el media en instagram_media y encola un job de transcripción.
 * Si ya hay un job pending/processing/done para ese media, lo devuelve sin duplicar.
 */
export async function queueTranscription(
  accountId: string,
  post: {
    ig_media_id: string;
    media_type: string;
    media_url?: string;
    thumbnail_url?: string;
    permalink?: string;
    caption?: string;
    timestamp?: string;
  },
): Promise<QueueTranscriptionResult> {
  const { supabase, user } = await getAuthUser();

  // Upsert en instagram_media para tener el registro listo
  const { error: upsertErr } = await supabase.from("instagram_media").upsert(
    {
      owner_id: user.id,
      account_id: accountId,
      ig_media_id: post.ig_media_id,
      media_type: post.media_type,
      media_url: post.media_url ?? null,
      thumbnail_url: post.thumbnail_url ?? null,
      permalink: post.permalink ?? null,
      caption: post.caption ?? null,
      posted_at: post.timestamp ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id,ig_media_id" },
  );
  if (upsertErr) return { ok: false, error: upsertErr.message };

  // Verificar si ya existe un job activo (no queremos duplicar)
  const { data: existing } = await supabase
    .from("transcription_jobs")
    .select("id, status")
    .eq("account_id", accountId)
    .eq("ig_media_id", post.ig_media_id)
    .in("status", ["pending", "processing", "done"])
    .maybeSingle();

  if (existing) {
    return { ok: true, jobId: existing.id as string, alreadyQueued: true };
  }

  const { data: job, error: jobErr } = await supabase
    .from("transcription_jobs")
    .insert({
      owner_id: user.id,
      account_id: accountId,
      ig_media_id: post.ig_media_id,
      status: "pending",
    })
    .select("id")
    .single();

  if (jobErr || !job) return { ok: false, error: jobErr?.message ?? "Error al crear job" };
  return { ok: true, jobId: job.id as string, alreadyQueued: false };
}

export type TranscriptionStatus = {
  status: "pending" | "processing" | "done" | "error";
  transcript?: string;
  error?: string;
};

/**
 * Devuelve el estado de transcripción de todos los reels de una cuenta,
 * keyed por ig_media_id.
 */
export async function getTranscriptionStatuses(
  accountId: string,
): Promise<{ ok: true; statuses: Record<string, TranscriptionStatus> } | { ok: false; error: string }> {
  const { supabase, user } = await getAuthUser();

  // Traer jobs (el más reciente por media para evitar duplicados de reintentos)
  const { data: jobs, error: jobsErr } = await supabase
    .from("transcription_jobs")
    .select("ig_media_id, status, error")
    .eq("account_id", accountId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (jobsErr) return { ok: false, error: jobsErr.message };

  // Traer transcripciones guardadas
  const { data: media } = await supabase
    .from("instagram_media")
    .select("ig_media_id, transcript")
    .eq("account_id", accountId)
    .eq("owner_id", user.id)
    .not("transcript", "is", null);

  const transcriptMap: Record<string, string> = {};
  for (const m of media ?? []) {
    if (m.transcript) transcriptMap[m.ig_media_id as string] = m.transcript as string;
  }

  // Merge: un entry por ig_media_id (el más reciente job gana)
  const statuses: Record<string, TranscriptionStatus> = {};
  for (const j of jobs ?? []) {
    const id = j.ig_media_id as string;
    if (statuses[id]) continue; // ya procesamos uno más reciente
    statuses[id] = {
      status: j.status as TranscriptionStatus["status"],
      transcript: transcriptMap[id],
      error: j.error as string | undefined,
    };
  }

  return { ok: true, statuses };
}

/** Refresca el token y actualiza la fecha de expiración. */
export async function refreshInstagramToken(accountId: string) {
  const { supabase, account } = await loadAccountToken(accountId);
  const refreshed = await refreshToken(account.access_token);
  const { error } = await supabase
    .from("instagram_accounts")
    .update({
      access_token: refreshed.access_token,
      token_expires_at: expiryFromNow(refreshed.expires_in / 86400),
      last_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Limpia el error que haya dejado el cron diario
      // (refresh-instagram-tokens-scheduled): este refresh sí funcionó.
      last_refresh_attempt_at: new Date().toISOString(),
      last_refresh_error: null,
    })
    .eq("id", accountId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
