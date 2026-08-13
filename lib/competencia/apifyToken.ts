/**
 * Token de Apify por cliente: guardado, lectura y resolución.
 *
 * Cada cliente puede tener el suyo (cifrado en `client_secrets.apify_token_cipher`)
 * para que cada marca pague su propio scraping. Si no lo tiene, solo el
 * **super admin** (`SUPER_ADMIN_USER_ID`) cae al token global `APIFY_API_TOKEN`
 * — que es el caso de las marcas propias de Paco. Cualquier otro usuario está
 * obligado a cargar su propia key: nadie más gasta los créditos del dueño.
 *
 * SERVER-ONLY: descifra secretos. Se usa desde server actions y desde la
 * background function de Netlify (que necesita `SECRETS_KEY` y
 * `SUPABASE_SERVICE_ROLE_KEY` en su entorno).
 *
 * ⚠️ Desde la migración `0006` los secretos NO viven más en `clients`, sino en
 * `client_secrets`, que no tiene grants para `authenticated`. Por eso todo este
 * módulo usa el cliente de service role y filtra la pertenencia a mano.
 */

import { createServiceClient } from "../supabase/service";
import { decryptSecret, encryptSecret, lastFour, SecretsError } from "../crypto/secrets";

export class ApifyTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApifyTokenError";
  }
}

export type ResolvedApifyToken = {
  token: string;
  /** "client" = lo paga el cliente; "global" = lo paga la cuenta del super admin. */
  source: "client" | "global";
};

/** Lo único de un token que puede cruzar al browser: nunca el cipher. */
export type ApifyTokenState = {
  last4: string | null;
  valid: boolean;
  checkedAt: string | null;
};

export const EMPTY_APIFY_TOKEN_STATE: ApifyTokenState = {
  last4: null,
  valid: false,
  checkedAt: null,
};

/**
 * ¿Este owner es el super admin? Solo él puede usar el token global.
 * Se compara contra `SUPER_ADMIN_USER_ID` (el uuid de `auth.users`) porque la
 * background function de Netlify no tiene sesión: lo único que conoce es el
 * `owner_id` de la fila del scrape.
 */
function isSuperAdmin(ownerId: string | null): boolean {
  const superAdminId = process.env.SUPER_ADMIN_USER_ID?.trim();
  return Boolean(superAdminId && ownerId && ownerId === superAdminId);
}

/** Dueño de la marca, leído sin RLS. `null` si el cliente no existe. */
async function getClientOwner(clientId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("clients")
    .select("owner_id")
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw new ApifyTokenError(error.message);
  return (data?.owner_id as string | null) ?? null;
}

/**
 * Estado enmascarado del token de un cliente, para pintar la UI.
 * `ownerId` no es opcional a propósito: el service role saltea la RLS, así que
 * la pertenencia se chequea acá.
 */
export async function getApifyTokenState(
  clientId: string,
  ownerId: string,
): Promise<ApifyTokenState> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("client_secrets")
    .select("apify_token_last4, apify_token_valid, apify_token_checked_at")
    .eq("client_id", clientId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw new ApifyTokenError(error.message);
  if (!data) return EMPTY_APIFY_TOKEN_STATE;

  return {
    last4: (data.apify_token_last4 as string | null) ?? null,
    valid: (data.apify_token_valid as boolean | null) ?? false,
    checkedAt: (data.apify_token_checked_at as string | null) ?? null,
  };
}

/** Guarda el token cifrado. El llamador ya lo validó contra Apify. */
export async function saveApifyTokenSecret(
  clientId: string,
  ownerId: string,
  rawToken: string,
): Promise<ApifyTokenState> {
  const owner = await getClientOwner(clientId);
  if (owner !== ownerId) throw new ApifyTokenError("Cliente no encontrado.");

  const checkedAt = new Date().toISOString();
  const state: ApifyTokenState = { last4: lastFour(rawToken), valid: true, checkedAt };

  const supabase = createServiceClient();
  const { error } = await supabase.from("client_secrets").upsert(
    {
      client_id: clientId,
      owner_id: ownerId,
      apify_token_cipher: encryptSecret(rawToken),
      apify_token_last4: state.last4,
      apify_token_valid: true,
      apify_token_checked_at: checkedAt,
      updated_at: checkedAt,
    },
    { onConflict: "client_id" },
  );

  if (error) throw new ApifyTokenError(error.message);
  return state;
}

/** Borra el token del cliente (la fila entera: hoy es el único secreto). */
export async function removeApifyTokenSecret(
  clientId: string,
  ownerId: string,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("client_secrets")
    .delete()
    .eq("client_id", clientId)
    .eq("owner_id", ownerId);

  if (error) throw new ApifyTokenError(error.message);
}

/** Marca el resultado de una verificación contra Apify. */
export async function markApifyTokenChecked(
  clientId: string,
  ownerId: string,
  valid: boolean,
): Promise<string> {
  const checkedAt = new Date().toISOString();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("client_secrets")
    .update({
      apify_token_valid: valid,
      apify_token_checked_at: checkedAt,
      updated_at: checkedAt,
    })
    .eq("client_id", clientId)
    .eq("owner_id", ownerId);

  if (error) throw new ApifyTokenError(error.message);
  return checkedAt;
}

/**
 * Token en claro del cliente, para volver a verificarlo contra Apify.
 * Devuelve `null` si no hay token guardado. NUNCA devolver esto al browser.
 */
export async function readApifyToken(
  clientId: string,
  ownerId: string,
): Promise<{ token: string; last4: string | null } | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("client_secrets")
    .select("apify_token_cipher, apify_token_last4")
    .eq("client_id", clientId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw new ApifyTokenError(error.message);

  const cipher = (data?.apify_token_cipher as string | null) ?? null;
  if (!cipher) return null;

  try {
    return {
      token: decryptSecret(cipher),
      last4: (data?.apify_token_last4 as string | null) ?? null,
    };
  } catch (e) {
    throw new ApifyTokenError(
      e instanceof SecretsError ? e.message : "No se pudo leer el token guardado.",
    );
  }
}

/**
 * Devuelve el token a usar para `clientId`, o lanza `ApifyTokenError` con un
 * mensaje presentable en la UI. No hace fallback silencioso al token global
 * cuando el cliente SÍ tiene uno configurado: si su token está roto queremos
 * enterarnos, no gastar créditos de la cuenta equivocada sin avisar.
 *
 * `expectedOwnerId` lo pasan los llamadores que tienen sesión (server actions):
 * como el service role saltea la RLS, es el único chequeo de pertenencia. La
 * background function no lo pasa porque ya arranca desde la fila del scrape.
 */
export async function resolveApifyToken(
  clientId: string,
  opts?: { expectedOwnerId?: string },
): Promise<ResolvedApifyToken> {
  const ownerId = await getClientOwner(clientId);
  if (!ownerId) throw new ApifyTokenError("Cliente no encontrado.");
  if (opts?.expectedOwnerId && opts.expectedOwnerId !== ownerId) {
    throw new ApifyTokenError("Cliente no encontrado.");
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("client_secrets")
    .select("apify_token_cipher, apify_token_valid")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throw new ApifyTokenError(error.message);

  const cipher = (data?.apify_token_cipher as string | null) ?? null;

  if (cipher) {
    if (data?.apify_token_valid === false) {
      throw new ApifyTokenError(
        "El token de Apify de este cliente está marcado como inválido. Verifícalo en su perfil.",
      );
    }
    try {
      return { token: decryptSecret(cipher), source: "client" };
    } catch (e) {
      throw new ApifyTokenError(
        e instanceof SecretsError
          ? e.message
          : "No se pudo leer el token de Apify de este cliente.",
      );
    }
  }

  // Sin token propio: el global es exclusivo del super admin. Un usuario común
  // debe cargar su key sí o sí — no puede gastar los créditos del dueño.
  if (!isSuperAdmin(ownerId)) {
    throw new ApifyTokenError(
      "Este cliente no tiene token de Apify. Cárgalo en su perfil para poder buscar competencia.",
    );
  }

  const global = process.env.APIFY_API_TOKEN;
  if (!global) {
    throw new ApifyTokenError(
      "Este cliente no tiene token de Apify y tampoco hay uno global configurado. Cárgalo en el perfil del cliente.",
    );
  }
  return { token: global, source: "global" };
}
