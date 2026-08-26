/**
 * Acceso al portal de cliente (Fase D, etapa 4).
 *
 * Único lugar que responde "¿qué marcas puede ver este usuario y con qué rol?".
 * Todo `/portal/**` pasa por acá.
 *
 * SERVER-ONLY: importa `lib/supabase/server`. Nunca desde un `"use client"` —
 * los componentes del portal reciben `PortalClient` como prop plana.
 *
 * ## Cómo se sostiene la propiedad de seguridad
 *
 * La lista de marcas sale de la vista **`portal_clients`** (migración `0006`),
 * que ya trae `where has_client_access(id)` adentro: dueño **o** miembro. Por
 * eso acá no hay ningún `or(...)` armado a mano — si la vista devuelve la fila,
 * el usuario tiene derecho a verla.
 *
 * ⚠️ Un miembro **no puede leer `clients`**: no hay policy de select para él
 * sobre esa tabla (trae notas internas y, hasta `0007`, el token de Apify). De
 * ahí dos reglas para todo el portal:
 *
 *  1. El nombre de la marca sale de `portal_clients`, nunca de `clients`.
 *  2. Ninguna consulta del portal hace join a `clients` (ej.
 *     `select("…, clients(nombre)")`): al miembro le vuelve `null` y la pantalla
 *     queda sin nombre. Se pasa el nombre desde acá.
 *
 * El flag de sección (`enabled_features`) es **UX**: decide qué se dibuja y
 * corta la ruta en el server. Lo que impide leer datos ajenos es la RLS, no el
 * flag. Por eso `requirePortalClient` chequea las dos cosas y las consultas de
 * cada página igual filtran por `client_id`.
 */

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import {
  hasFeature,
  sanitizeFeatures,
  type PortalFeatureSlug,
} from "./features";
import { isPortalMemberRole, type PortalMemberRole } from "./roles";
import { sanitizeGenerationMode, type PortalGenerationMode } from "./generationMode";
import { getBillingState } from "../billing/access";

/**
 * `owner` = Paco mirando su propia marca desde el portal ("ver como cliente").
 * No es un rol de `client_members`: es la ausencia de membresía sobre una marca
 * que la vista igual devolvió, lo que solo pasa si sos el dueño.
 */
export type PortalRole = PortalMemberRole | "owner";

export type PortalClient = {
  id: string;
  nombre: string;
  marca: string | null;
  nicho: string | null;
  /** Ya pasado por `sanitizeFeatures`: nunca trae slugs desconocidos. */
  features: PortalFeatureSlug[];
  aiGenerationLimit: number | null;
  /** Qué flujo ve en `/portal/[id]/generar`. Ya saneado: nunca un valor raro. */
  aiGenerationMode: PortalGenerationMode;
  /** Tope mensual de transcripciones desde el portal. `null` = sin tope. */
  transcriptionLimit: number | null;
  role: PortalRole;
};

/** Cómo se le llama a la marca en la UI del portal. */
export function portalClientLabel(client: PortalClient): string {
  return client.marca?.trim() || client.nombre;
}

/**
 * Sesión del portal, deduplicada por request con `cache()`.
 *
 * El layout, el page y las server actions la piden por separado; sin esto,
 * `getUser()` (que valida el JWT contra el servidor de Auth) se llamaría tres
 * veces por navegación.
 */
export const getPortalSession = cache(
  async (): Promise<{ supabase: SupabaseClient; user: User | null }> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { supabase, user };
  },
);

/** Igual que `getPortalSession`, pero manda a `/login` si no hay sesión. */
export async function requirePortalSession(): Promise<{
  supabase: SupabaseClient;
  user: User;
}> {
  const { supabase, user } = await getPortalSession();
  if (!user) redirect("/login");
  return { supabase, user };
}

type PortalClientRow = {
  id: string;
  nombre: string;
  marca: string | null;
  nicho: string | null;
  enabled_features: string[] | null;
  ai_generation_limit: number | null;
  ai_generation_mode: string | null;
  transcription_limit: number | null;
};

/**
 * Todas las marcas a las que este usuario puede entrar por el portal, ordenadas
 * por nombre. Para Paco son todas las suyas; para un cliente, la suya (o las
 * suyas: `client_members` es N:N).
 *
 * Dos consultas: la vista y las membresías del usuario. Una marca que la vista
 * devuelve y que no está entre sus membresías solo puede ser propia, así que
 * ahí el rol es `owner`.
 */
export const listPortalClients = cache(
  async (userId: string): Promise<PortalClient[]> => {
    const { supabase } = await getPortalSession();

    const [{ data: rows, error }, { data: memberRows }] = await Promise.all([
      supabase
        .from("portal_clients")
        .select(
          "id, nombre, marca, nicho, enabled_features, ai_generation_limit, ai_generation_mode, transcription_limit",
        )
        .order("nombre", { ascending: true }),
      supabase.from("client_members").select("client_id, role").eq("user_id", userId),
    ]);

    if (error) throw new Error(error.message);

    const roles = new Map<string, PortalMemberRole>();
    for (const m of memberRows ?? []) {
      const role = m.role as string;
      roles.set(m.client_id as string, isPortalMemberRole(role) ? role : "viewer");
    }

    return ((rows ?? []) as PortalClientRow[]).map((r) => ({
      id: r.id,
      nombre: r.nombre,
      marca: r.marca,
      nicho: r.nicho,
      features: sanitizeFeatures(r.enabled_features ?? []),
      aiGenerationLimit: r.ai_generation_limit,
      aiGenerationMode: sanitizeGenerationMode(r.ai_generation_mode),
      transcriptionLimit: r.transcription_limit,
      role: roles.get(r.id) ?? "owner",
    }));
  },
);

/** Una marca del portal, o `null` si el usuario no tiene acceso. */
export async function getPortalClient(
  userId: string,
  clientId: string,
): Promise<PortalClient | null> {
  const clients = await listPortalClients(userId);
  return clients.find((c) => c.id === clientId) ?? null;
}

/**
 * Doble candado de cada página del portal.
 *
 * 1. ¿Tiene acceso a la marca? Si no → 404 (no 403: no le confirmamos a nadie
 *    que esa marca existe).
 * 2. ¿La sección está prendida en `enabled_features`? Si no → 404 también.
 *
 * El punto 2 **también corre para el dueño**: `/portal` existe para ver lo que
 * ve el cliente, así que apagar un flag tiene que apagar la sección para todos
 * ahí adentro. El acceso de Paco a sus datos sigue intacto en `(app)`, que no
 * mira flags.
 */
export async function requirePortalClient(
  userId: string,
  clientId: string,
  feature?: PortalFeatureSlug,
  options?: {
    /**
     * Saltea el candado 3 (cobro). Lo usa **solo** `/portal/[id]/facturacion`:
     * si el impago también cerrara esa pantalla, el cliente suspendido no
     * tendría desde dónde actualizar su tarjeta y quedaría encerrado afuera.
     */
    skipBillingGate?: boolean;
  },
): Promise<PortalClient> {
  const client = await getPortalClient(userId, clientId);
  if (!client) notFound();
  if (feature && !hasFeature(client.features, feature)) notFound();

  // Candado 3 (Fase E): la marca tiene que estar pagada.
  //
  // ⚠️ **No aplica al dueño**, al revés que los flags de sección. Los flags
  // cortan a Paco a propósito, porque `/portal` existe para ver lo que ve el
  // cliente; pero si el impago lo cortara a él, no podría revisar la marca de
  // un cliente moroso justo cuando más falta hace.
  //
  // Es `redirect` y no `notFound()`: un 404 le diría al cliente que algo se
  // rompió, cuando lo que pasa es que hay que pagar.
  if (!options?.skipBillingGate && client.role !== "owner") {
    const billing = await getBillingState(clientId);
    if (!billing.ok) redirect(`/portal/suscripcion/${clientId}`);
  }

  return client;
}

/**
 * A dónde mandar al usuario después de entrar (y desde `/`).
 *
 * Dueño de al menos una marca → el estudio de siempre. Solo miembro → el
 * portal. Sin nada → `/dashboard`, que ya sabe mostrar su propio vacío (es el
 * caso de una cuenta recién creada sin clientes).
 *
 * Es la única definición de "a dónde va cada quien": `/`, el middleware, el
 * login y el callback de Auth pasan todos por acá o por `/`.
 */
export async function resolveLandingPath(
  supabase: SupabaseClient,
  userId: string,
): Promise<"/dashboard" | "/portal"> {
  const { count: ownedClients } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);

  if (ownedClients) return "/dashboard";

  const { count: memberships } = await supabase
    .from("client_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return memberships ? "/portal" : "/dashboard";
}
