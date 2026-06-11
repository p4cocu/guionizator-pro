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
    .select("id, ig_user_id, username, token_expires_at, created_at")
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
    })
    .eq("id", accountId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
