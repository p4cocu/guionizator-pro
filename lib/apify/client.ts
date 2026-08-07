/**
 * Cliente del actor de Apify "Instagram Scraper" (apify/instagram-scraper).
 *
 * SERVER-ONLY: usa APIFY_API_TOKEN, que nunca debe llegar al browser.
 * Se usa para traer los últimos posts (con likes/comentarios/views) de las
 * cuentas de competencia. Docs del actor: https://apify.com/apify/instagram-scraper
 */

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "apify~instagram-scraper";

export class ApifyError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ApifyError";
  }
}

/** Datos de la cuenta dueña de un token (para validarlo al guardarlo). */
export type ApifyAccount = {
  username: string | null;
  plan: string | null;
};

/**
 * Valida un token contra `GET /v2/users/me`. Si el token no sirve, Apify
 * responde 401 y lanzamos ApifyError — así nunca guardamos un token muerto.
 */
export async function getApifyAccount(token: string): Promise<ApifyAccount> {
  const res = await fetch(`${APIFY_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${token.trim()}` },
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new ApifyError("Apify rechazó el token (401). Revisa que esté completo.", res.status);
    }
    throw new ApifyError(`Apify respondió ${res.status} al validar el token.`, res.status);
  }

  const json = (await res.json()) as {
    data?: { username?: string; plan?: { id?: string } | string };
  };
  const plan = json.data?.plan;
  return {
    username: json.data?.username ?? null,
    plan: typeof plan === "string" ? plan : (plan?.id ?? null),
  };
}

/** Consumo del ciclo mensual actual, para mostrar cuánto crédito le queda al cliente. */
export type ApifyUsage = {
  usedUsd: number | null;
  limitUsd: number | null;
  cycleEndsAt: string | null;
};

export async function getApifyUsage(token: string): Promise<ApifyUsage> {
  const res = await fetch(`${APIFY_BASE}/users/me/limits`, {
    headers: { Authorization: `Bearer ${token.trim()}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new ApifyError(`Apify respondió ${res.status} al consultar el consumo.`, res.status);
  }

  const json = (await res.json()) as {
    data?: {
      current?: { monthlyUsageUsd?: number };
      limits?: { maxMonthlyUsageUsd?: number };
      monthlyUsageCycle?: { endAt?: string };
    };
  };

  return {
    usedUsd: json.data?.current?.monthlyUsageUsd ?? null,
    limitUsd: json.data?.limits?.maxMonthlyUsageUsd ?? null,
    cycleEndsAt: json.data?.monthlyUsageCycle?.endAt ?? null,
  };
}

/** Item crudo del dataset del actor (campos que nos interesan). */
type RawApifyPost = {
  type?: string; // "Image" | "Video" | "Sidecar"
  shortCode?: string;
  url?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  timestamp?: string;
  ownerUsername?: string;
  ownerFullName?: string;
  // Con addParentData el actor suele adjuntar datos del perfil padre.
  ownerFollowersCount?: number;
  followersCount?: number;
  error?: string;
};

export type ScrapedPost = {
  username: string;
  ownerFullName?: string;
  shortcode?: string;
  permalink?: string;
  type: "image" | "video" | "carousel";
  caption?: string;
  likes: number;
  comments: number;
  videoViews?: number;
  followers?: number;
  postedAt?: string;
};

function normalizeType(t?: string): ScrapedPost["type"] {
  switch ((t ?? "").toLowerCase()) {
    case "video":
      return "video";
    case "sidecar":
    case "carousel":
      return "carousel";
    default:
      return "image";
  }
}

function toUsername(input: string): string {
  return input.trim().replace(/^@/, "").toLowerCase();
}

function profileUrl(username: string): string {
  return `https://www.instagram.com/${toUsername(username)}/`;
}

/**
 * Corre el actor de forma SÍNCRONA y devuelve los items del dataset.
 * El endpoint run-sync espera a que el run termine (hasta ~5 min) y responde
 * con el dataset directo — ideal para correrlo desde una background function
 * o, en dev, desde una server action.
 */
export async function scrapeCompetitorPosts(opts: {
  token: string;
  usernames: string[];
  resultsLimit: number;
  onlyPostsNewerThan?: string | null; // ISO date (YYYY-MM-DD)
}): Promise<ScrapedPost[]> {
  const usernames = opts.usernames.map(toUsername).filter(Boolean);
  if (usernames.length === 0) return [];

  const input: Record<string, unknown> = {
    directUrls: usernames.map(profileUrl),
    resultsType: "posts",
    resultsLimit: opts.resultsLimit,
    addParentData: true,
    searchType: "user",
  };
  if (opts.onlyPostsNewerThan) {
    input.onlyPostsNewerThan = opts.onlyPostsNewerThan;
  }

  const url = `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(
    opts.token,
  )}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = `Apify ${res.status}`;
    try {
      const j = await res.json();
      detail = j?.error?.message || detail;
    } catch {
      /* ignore */
    }
    throw new ApifyError(detail, res.status);
  }

  const items = (await res.json()) as RawApifyPost[];
  if (!Array.isArray(items)) return [];

  return items
    .filter((it) => !it.error && (it.shortCode || it.url))
    .map((it): ScrapedPost => {
      const followers = it.ownerFollowersCount ?? it.followersCount;
      return {
        username: toUsername(it.ownerUsername ?? ""),
        ownerFullName: it.ownerFullName,
        shortcode: it.shortCode,
        permalink:
          it.url ?? (it.shortCode ? `https://www.instagram.com/p/${it.shortCode}/` : undefined),
        type: normalizeType(it.type),
        caption: it.caption,
        likes: it.likesCount ?? 0,
        comments: it.commentsCount ?? 0,
        videoViews: it.videoViewCount ?? it.videoPlayCount,
        followers: typeof followers === "number" ? followers : undefined,
        postedAt: it.timestamp,
      };
    });
}
