/**
 * Netlify Scheduled Function: renueva los long-lived tokens de Instagram que
 * están por caducar, para TODAS las cuentas de todos los owners.
 *
 * Por qué existe: el token de Instagram Login vive ~60 días y hasta ahora solo
 * se renovaba con el botón manual "Renovar token" del perfil de cliente. Si
 * nadie entraba a apretarlo, la cuenta dejaba de traer métricas. Corre a diario
 * según el cron de netlify.toml ([functions."refresh-instagram-tokens-scheduled"]).
 *
 * Netlify solo permite invocar funciones con `schedule` desde su propio
 * scheduler; cualquier request externo directo recibe 404 (igual que
 * cleanup-competencia-scheduled, no necesita secreto propio).
 *
 * Usa la SERVICE ROLE de Supabase (no hay sesión de usuario en un cron).
 *
 * Reglas:
 *   - Solo toca cuentas cuyo token vence dentro de REFRESH_WINDOW_DAYS (o que
 *     no tienen fecha de vencimiento registrada). El resto no se toca: cada
 *     refresh reinicia el reloj, no hay nada que ganar renovando antes.
 *   - Salta las renovadas hace menos de MIN_HOURS_SINCE_REFRESH: la API de
 *     Instagram exige que el token tenga al menos 24h de antigüedad.
 *   - Un fallo en una cuenta no frena a las demás; queda registrado en
 *     `last_refresh_error` y se muestra en el perfil del cliente.
 *
 * Variables de entorno requeridas en Netlify:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Requiere la migración 0005_instagram_refresh_estado.sql
 * (`last_refresh_attempt_at`, `last_refresh_error`).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { refreshToken, InstagramApiError } from "../../lib/instagram/client";

/** Renueva cuando falten estos días (o menos) para el vencimiento. */
const REFRESH_WINDOW_DAYS = 7;
/** Instagram rechaza refrescar un token con menos de 24h de vida. */
const MIN_HOURS_SINCE_REFRESH = 24;

type AccountRow = {
  id: string;
  username: string | null;
  access_token: string;
  token_expires_at: string | null;
  last_refreshed_at: string | null;
};

/**
 * Aplica el update de la cuenta. Si las columnas de diagnóstico todavía no
 * existen (migración 0005 sin aplicar), reintenta sin ellas para no perder el
 * token nuevo — lo importante es persistir `access_token`.
 */
async function updateAccount(
  supabase: SupabaseClient,
  id: string,
  core: Record<string, string | null>,
  diagnostics: Record<string, string | null>,
): Promise<string | null> {
  const full = await supabase
    .from("instagram_accounts")
    .update({ ...core, ...diagnostics })
    .eq("id", id);
  if (!full.error) return null;

  const missingColumn = full.error.code === "42703";
  if (!missingColumn) return full.error.message;

  const fallback = await supabase.from("instagram_accounts").update(core).eq("id", id);
  return fallback.error ? fallback.error.message : null;
}

export const handler = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: "Missing server configuration" };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cutoff = new Date(Date.now() + REFRESH_WINDOW_DAYS * 86400000).toISOString();
  const minAge = new Date(Date.now() - MIN_HOURS_SINCE_REFRESH * 3600000).toISOString();

  const { data, error } = await supabase
    .from("instagram_accounts")
    .select("id, username, access_token, token_expires_at, last_refreshed_at")
    .or(`token_expires_at.is.null,token_expires_at.lt.${cutoff}`);

  if (error) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
  }

  const accounts = (data ?? []) as AccountRow[];
  const results: { username: string | null; ok: boolean; error?: string }[] = [];
  let refreshed = 0;
  let skipped = 0;
  let failed = 0;

  for (const account of accounts) {
    // Recién renovada (o recién conectada): Instagram la rechazaría igual.
    if (account.last_refreshed_at && account.last_refreshed_at > minAge) {
      skipped++;
      continue;
    }

    const now = new Date().toISOString();
    try {
      const fresh = await refreshToken(account.access_token);
      const expiresAt = new Date(Date.now() + fresh.expires_in * 1000).toISOString();

      const updateError = await updateAccount(
        supabase,
        account.id,
        {
          access_token: fresh.access_token,
          token_expires_at: expiresAt,
          last_refreshed_at: now,
          updated_at: now,
        },
        { last_refresh_attempt_at: now, last_refresh_error: null },
      );
      if (updateError) throw new Error(`No se pudo guardar el token: ${updateError}`);

      refreshed++;
      results.push({ username: account.username, ok: true });
    } catch (e) {
      const msg =
        e instanceof InstagramApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Error desconocido al renovar el token";
      failed++;
      results.push({ username: account.username, ok: false, error: msg });
      await updateAccount(
        supabase,
        account.id,
        { updated_at: now },
        { last_refresh_attempt_at: now, last_refresh_error: msg },
      );
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      candidates: accounts.length,
      refreshed,
      skipped,
      failed,
      cutoff,
      results,
    }),
  };
};
