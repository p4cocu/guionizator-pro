/**
 * Guardar un link suelto en el tablero de competencia.
 *
 * Módulo **puro** (no importa Supabase) porque lo usan el servidor —para armar
 * la fila— y el cliente —para validar el formulario antes de mandarlo y para
 * escribir bien el nombre de la cuenta en la tarjeta.
 *
 * ## Por qué la cuenta es opcional
 *
 * Instagram **no revela el @cuenta en la URL de un reel**: `instagram.com/reel/
 * ABC123/` no dice de quién es. La única forma de averiguarlo es pedirle el
 * post a Apify, que cuesta créditos de la marca y tarda ~30s (riesgo real de
 * 504 contra el límite de Netlify, ver CLAUDE.md). Decisión de Paco
 * (2026-09-10): el cliente pega el link y la cuenta es opcional.
 *
 * Cuando el link SÍ la trae (`instagram.com/<cuenta>/reel/ABC123/`, la forma
 * que genera "Copiar enlace" desde el perfil) se saca de ahí sin preguntar.
 * Cuando no, la fila se guarda con `UNKNOWN_ACCOUNT` — `username` es `not
 * null` en la base, así que hace falta un valor. Lleva guion, que Instagram no
 * permite en un handle, así que jamás puede chocar con una cuenta real.
 *
 * ## El shortcode SÍ se guarda (a diferencia del alta manual del estudio)
 *
 * Dos cosas dependen de eso:
 *   1. **No duplicar.** Si el cliente pega el link de un reel que el scrape ya
 *      trajo, se marca ese post con la estrella en vez de crear una segunda
 *      tarjeta del mismo video.
 *   2. **Enriquecerse solo.** El upsert de `runScrapeJob` va por
 *      `(owner_id, client_id, shortcode)`: la próxima búsqueda de esa cuenta le
 *      completa likes, comentarios, vistas y la fecha real de publicación a un
 *      post que se guardó con métricas en cero.
 */

/** Sentinela para `competitor_posts.username` cuando no se pudo saber la cuenta. */
export const UNKNOWN_ACCOUNT = "sin-cuenta";

/** Tipos de contenido que acepta `competitor_posts.type`. */
export type SavedLinkType = "video" | "carousel" | "image";

/** Extrae el shortcode de un permalink de Instagram (/p/, /reel/, /reels/, /tv/). */
export function extractShortcode(permalink: string | null | undefined): string | null {
  if (!permalink) return null;
  const m = permalink.match(/\/(?:p|reel|reels|tv)\/([^/?#]+)/i);
  return m ? m[1] : null;
}

/** Normaliza lo que escriba una persona: quita la @, espacios y mayúsculas. */
export function normalizeAccount(raw: string | null | undefined): string | null {
  const clean = (raw ?? "").trim().replace(/^@+/, "").toLowerCase();
  if (!clean) return null;
  // Handles de Instagram: letras, números, punto y guion bajo. Si trae otra
  // cosa (pegaron una URL entera, por ejemplo) se descarta en vez de guardar
  // basura como nombre de cuenta.
  return /^[a-z0-9._]{1,30}$/.test(clean) ? clean : null;
}

/** Cómo se dibuja la cuenta en una tarjeta. Nunca muestra el sentinela crudo. */
export function accountLabel(username: string): string {
  return username === UNKNOWN_ACCOUNT ? "Cuenta sin identificar" : `@${username}`;
}

export type ParsedLink = {
  /** URL normalizada, lista para guardar en `permalink`. */
  url: string;
  /** `null` si no es un link de Instagram reconocible. */
  shortcode: string | null;
  /** Cuenta sacada de la propia URL, si venía. */
  username: string | null;
  /** Tipo deducido de la URL; `null` si la URL no lo dice (`/p/` puede ser cualquiera). */
  type: SavedLinkType | null;
  isInstagram: boolean;
};

/**
 * Lee un link pegado por una persona. Devuelve `null` si no hay ni siquiera una
 * URL http(s) válida — eso sí se rechaza, porque una tarjeta sin link no sirve
 * para nada.
 *
 * Acepta links que no sean de Instagram (TikTok, YouTube, un artículo): la
 * tarjeta pierde la portada embebida y las herramientas de video, pero sigue
 * sirviendo como referencia con notas. Es lo que ya hace el alta manual del
 * estudio.
 */
export function parseSavedLink(raw: string): ParsedLink | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  // Sin esquema, `new URL` tira; pegar "instagram.com/reel/x" es de lo más común.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const isInstagram = host === "instagram.com" || host.endsWith(".instagram.com");

  // Los parámetros de tracking (?igsh=…) no aportan y ensucian el embed.
  parsed.search = "";
  parsed.hash = "";

  if (!isInstagram) {
    return { url: parsed.toString(), shortcode: null, username: null, type: null, isInstagram: false };
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  const kindIndex = segments.findIndex((seg) => /^(p|reel|reels|tv)$/i.test(seg));
  const kind = kindIndex >= 0 ? segments[kindIndex].toLowerCase() : null;

  // `instagram.com/<cuenta>/reel/<code>`: la cuenta es lo que va ANTES del tipo.
  const username = kindIndex > 0 ? normalizeAccount(segments[kindIndex - 1]) : null;

  return {
    url: parsed.toString(),
    shortcode: extractShortcode(parsed.pathname),
    username,
    // `/p/` puede ser imagen, carrusel o video: lo decide quien guarda.
    type: kind === "p" || kind === null ? null : "video",
    isInstagram: true,
  };
}
