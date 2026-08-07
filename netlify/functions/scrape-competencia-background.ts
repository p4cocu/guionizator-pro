/**
 * Background Function de Netlify: ejecuta un run de scrape de competencia.
 *
 * El nombre termina en "-background" → Netlify la corre de forma asíncrona
 * (responde 202 al instante y sigue hasta 15 min). La dispara la server action
 * `startScrape` en producción.
 *
 * Usa la SERVICE ROLE de Supabase (no hay sesión de usuario aquí), por eso lee
 * el scrape por id y saca el owner_id/client_id de la fila. Protegida con
 * SCRAPE_FN_SECRET para que nadie más pueda gastar créditos de Apify.
 *
 * El token de Apify lo resuelve `runScrapeJob` por cliente (propio cifrado, o
 * el global) — por eso aquí hace falta SECRETS_KEY para poder descifrarlo.
 *
 * Variables de entorno requeridas en Netlify:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SCRAPE_FN_SECRET, SECRETS_KEY
 *   APIFY_API_TOKEN (opcional: fallback para clientes sin token propio)
 */

import { createClient } from "@supabase/supabase-js";
import { runScrapeJob } from "../../lib/competencia/scrape";

type NetlifyEvent = {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
};

export const handler = async (event: NetlifyEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const secret = process.env.SCRAPE_FN_SECRET;
  if (!secret || event.headers["x-scrape-secret"] !== secret) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  let scrapeId: string | undefined;
  try {
    scrapeId = JSON.parse(event.body ?? "{}").scrapeId;
  } catch {
    return { statusCode: 400, body: "Bad request" };
  }
  if (!scrapeId) return { statusCode: 400, body: "Missing scrapeId" };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, body: "Missing server configuration" };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await runScrapeJob(supabase, scrapeId);
  return { statusCode: result.ok ? 200 : 500, body: JSON.stringify(result) };
};
