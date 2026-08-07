/**
 * Resolución del token de Apify que debe usar un scrape.
 *
 * Cada cliente puede tener el suyo (cifrado en `clients.apify_token_cipher`)
 * para que cada marca pague su propio scraping. Si no lo tiene, solo el
 * **super admin** (`SUPER_ADMIN_USER_ID`) cae al token global `APIFY_API_TOKEN`
 * — que es el caso de las marcas propias de Paco. Cualquier otro usuario está
 * obligado a cargar su propia key: nadie más gasta los créditos del dueño.
 *
 * SERVER-ONLY: descifra secretos. Se usa desde server actions y desde la
 * background function de Netlify (que necesita `SECRETS_KEY` en su entorno).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret, SecretsError } from "../crypto/secrets";

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

/**
 * Devuelve el token a usar para `clientId`, o lanza `ApifyTokenError` con un
 * mensaje presentable en la UI. No hace fallback silencioso al token global
 * cuando el cliente SÍ tiene uno configurado: si su token está roto queremos
 * enterarnos, no gastar créditos de la cuenta equivocada sin avisar.
 */
export async function resolveApifyToken(
  supabase: SupabaseClient,
  clientId: string,
): Promise<ResolvedApifyToken> {
  const { data, error } = await supabase
    .from("clients")
    .select("nombre, owner_id, apify_token_cipher, apify_token_valid")
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw new ApifyTokenError(error.message);
  if (!data) throw new ApifyTokenError("Cliente no encontrado.");

  const cipher = (data.apify_token_cipher as string | null) ?? null;

  if (cipher) {
    if (data.apify_token_valid === false) {
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
  if (!isSuperAdmin((data.owner_id as string | null) ?? null)) {
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
