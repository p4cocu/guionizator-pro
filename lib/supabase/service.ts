/**
 * Cliente de Supabase con `service_role`: SALTEA la RLS por completo.
 *
 * ⚠️ SERVER-ONLY. Nunca importar desde un componente `"use client"` ni desde
 * nada que llegue al browser. No se usa `import "server-only"` a propósito:
 * este módulo también se bundlea en las Netlify Functions, que no corren dentro
 * de Next y no reconocen ese paquete.
 *
 * Existe porque `client_secrets` no tiene grants para `authenticated`: el token
 * de Apify cifrado solo se puede leer desde el servidor. Ver la migración
 * `0006_portal_cliente.sql`.
 *
 * Como saltea la RLS, **toda** consulta hecha con este cliente tiene que filtrar
 * la pertenencia a mano (`.eq("owner_id", user.id)`). No hay red debajo.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class ServiceClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceClientError";
  }
}

/** ¿Está la key configurada? Útil para dar un mensaje claro en dev local. */
export function isServiceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

let cached: SupabaseClient | null = null;

export function createServiceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) throw new ServiceClientError("Falta NEXT_PUBLIC_SUPABASE_URL.");
  if (!key) {
    throw new ServiceClientError(
      "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Copiala de Supabase → Project Settings → API (service_role) a tu .env.local y a Netlify.",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
