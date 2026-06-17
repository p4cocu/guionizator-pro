/**
 * Cliente de la API de Instagram (flujo "Instagram Login" / graph.instagram.com).
 *
 * Todas las llamadas son SERVER-ONLY: el access_token nunca debe llegar al browser.
 * El token es de larga duración (~60 días) y se refresca con `refreshToken`.
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform
 */

const GRAPH = "https://graph.instagram.com";
const API_VERSION = "v21.0";

export class InstagramApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public raw?: unknown,
  ) {
    super(message);
    this.name = "InstagramApiError";
  }
}

async function igFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json();

  if (!res.ok || json.error) {
    const msg = json?.error?.message || `Instagram API ${res.status}`;
    throw new InstagramApiError(msg, res.status, json?.error);
  }
  return json as T;
}

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface IgProfile {
  user_id: string;
  username: string;
  account_type?: string;
  media_count?: number;
}

export interface IgMedia {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
  timestamp: string;
}

export interface IgInsights {
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saved?: number;
  views?: number;
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

/** Valida un token y devuelve el perfil. Útil al conectar una cuenta. */
export async function getProfile(token: string): Promise<IgProfile> {
  return igFetch<IgProfile>("me", {
    fields: "user_id,username,account_type,media_count",
    access_token: token,
  });
}

/** Lista los posts publicados de la cuenta (más recientes primero). */
export async function getMedia(token: string, limit = 25): Promise<IgMedia[]> {
  const res = await igFetch<{ data: IgMedia[] }>("me/media", {
    fields: "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp",
    limit: String(limit),
    access_token: token,
  });
  return res.data ?? [];
}

/** Trae métricas de un post específico. Las métricas válidas dependen del media_type. */
export async function getMediaInsights(
  mediaId: string,
  token: string,
  metrics: string[] = ["reach", "likes", "comments", "shares", "saved", "views"],
): Promise<IgInsights> {
  const res = await igFetch<{
    data: { name: string; values: { value: number }[] }[];
  }>(`${mediaId}/insights`, {
    metric: metrics.join(","),
    access_token: token,
  });

  const out: IgInsights = {};
  for (const m of res.data ?? []) {
    const value = m.values?.[0]?.value ?? 0;
    (out as Record<string, number>)[m.name] = value;
  }
  return out;
}

// ─── Token ───────────────────────────────────────────────────────────────────

/**
 * Refresca un long-lived token antes de que caduque (extiende otros ~60 días).
 * El token debe tener al menos 24h de antigüedad y no estar expirado.
 */
export async function refreshToken(token: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  return igFetch("refresh_access_token", {
    grant_type: "ig_refresh_token",
    access_token: token,
  });
}

// ─── Publicación (requiere media en URL pública accesible por Instagram) ──────

async function igPost<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { method: "POST", cache: "no-store" });
  const json = await res.json();

  if (!res.ok || json.error) {
    const msg = json?.error?.message || `Instagram API ${res.status}`;
    throw new InstagramApiError(msg, res.status, json?.error);
  }
  return json as T;
}

/** Crea un item individual para un carrusel (is_carousel_item=true). */
export async function createCarouselItem(
  igUserId: string,
  token: string,
  imageUrl: string,
): Promise<{ id: string }> {
  return igPost(`${igUserId}/media`, {
    access_token: token,
    image_url: imageUrl,
    is_carousel_item: "true",
  });
}

/** Crea el container de carrusel agrupando los IDs de los items. */
export async function createCarouselContainer(
  igUserId: string,
  token: string,
  childrenIds: string[],
  caption: string,
): Promise<{ id: string }> {
  return igPost(`${igUserId}/media`, {
    access_token: token,
    media_type: "CAROUSEL",
    children: childrenIds.join(","),
    caption,
  });
}

/** Crea un container de Reel con video y portada opcionales. */
export async function createReelContainer(
  igUserId: string,
  token: string,
  videoUrl: string,
  caption: string,
  coverUrl?: string,
): Promise<{ id: string }> {
  const params: Record<string, string> = {
    access_token: token,
    media_type: "REELS",
    video_url: videoUrl,
    caption,
  };
  if (coverUrl) params.cover_url = coverUrl;
  return igPost(`${igUserId}/media`, params);
}

/** Consulta el estado de un container (para polling en Reels). */
export async function checkContainerStatus(
  containerId: string,
  token: string,
): Promise<{ id: string; status_code: "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED" }> {
  return igFetch(containerId, {
    fields: "status_code",
    access_token: token,
  });
}

/** Publica un container ya procesado. */
export async function publishContainer(
  igUserId: string,
  containerId: string,
  token: string,
): Promise<{ id: string }> {
  return igPost(`${igUserId}/media_publish`, {
    creation_id: containerId,
    access_token: token,
  });
}

export { API_VERSION };
