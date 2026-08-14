"use server";

/**
 * Panel "Portal del cliente" de `/clientes/[id]` (Fase D, etapa 2).
 *
 * Todo lo de acá es del DUEÑO de la marca: qué secciones ve su cliente, el
 * add-on de IA y quién tiene acceso. Nada de esto lo puede llamar un miembro
 * del portal — cada action filtra `owner_id = user.id` además de la RLS.
 *
 * ⚠️ NO reexportar tipos desde este archivo (`export type { X }`). En un módulo
 * "use server" eso sobrevive al bundle como referencia a un binding que en
 * runtime no existe y revienta la página al cargar. Los tipos viven en
 * `lib/portal/features.ts` y `lib/portal/members.ts`; quien los necesite, que
 * los importe de ahí.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeFeatures, type PortalFeatureSlug } from "@/lib/portal/features";
import { isPortalMemberRole } from "@/lib/portal/members";

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

// ─── Secciones habilitadas ───────────────────────────────────────────────────

export type SetFeaturesResult =
  | { ok: true; features: PortalFeatureSlug[] }
  | { ok: false; error: string };

/**
 * Reemplaza `clients.enabled_features` con la lista dada.
 *
 * `sanitizeFeatures` descarta cualquier slug que no esté en
 * `lib/portal/features.ts`: es lo que garantiza que nunca se le mande a Postgres
 * un array que viole `clients_enabled_features_check`.
 */
export async function setClientFeatures(
  clientId: string,
  slugs: string[],
): Promise<SetFeaturesResult> {
  const features = sanitizeFeatures(slugs);

  try {
    const { supabase, user } = await getAuthUser();

    const { error } = await supabase
      .from("clients")
      .update({ enabled_features: features })
      .eq("id", clientId)
      .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudieron guardar las secciones.",
    };
  }

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, features };
}

// ─── Add-on de IA: tope mensual ──────────────────────────────────────────────

export type SetAiLimitResult =
  | { ok: true; limit: number | null }
  | { ok: false; error: string };

/**
 * Tope mensual de generaciones con IA. `null` = sin tope.
 * El switch del add-on es el slug `generar_ia` en `enabled_features`; esto es
 * solo el número.
 */
export async function setAiGenerationLimit(
  clientId: string,
  rawLimit: number | null,
): Promise<SetAiLimitResult> {
  let limit: number | null = null;

  if (rawLimit !== null) {
    if (!Number.isFinite(rawLimit) || !Number.isInteger(rawLimit)) {
      return { ok: false, error: "El tope tiene que ser un número entero." };
    }
    if (rawLimit < 0) return { ok: false, error: "El tope no puede ser negativo." };
    if (rawLimit > 100000) return { ok: false, error: "Ese tope es absurdamente alto." };
    limit = rawLimit;
  }

  try {
    const { supabase, user } = await getAuthUser();

    const { error } = await supabase
      .from("clients")
      .update({ ai_generation_limit: limit })
      .eq("id", clientId)
      .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar el tope.",
    };
  }

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, limit };
}

// ─── Miembros ────────────────────────────────────────────────────────────────
// Las invitaciones son la etapa 3. Acá solo se administra lo que ya existe:
// cambiar el rol y revocar el acceso.

export type MemberActionResult = { ok: true } | { ok: false; error: string };

/**
 * Cambia el rol de un miembro. `viewer` ve y comenta; `collaborator` además
 * edita los guiones de su marca (policy `scripts_member_update`).
 */
export async function setClientMemberRole(
  memberId: string,
  clientId: string,
  role: string,
): Promise<MemberActionResult> {
  if (!isPortalMemberRole(role)) {
    return { ok: false, error: "Rol desconocido." };
  }

  try {
    const { supabase, user } = await getAuthUser();

    // El service role no está en juego acá, pero igual confirmamos la marca:
    // `client_members` no tiene `owner_id`, así que la pertenencia se chequea
    // contra `clients`.
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (clientError) return { ok: false, error: clientError.message };
    if (!client) return { ok: false, error: "Cliente no encontrado." };

    const { error } = await supabase
      .from("client_members")
      .update({ role })
      .eq("id", memberId)
      .eq("client_id", clientId);

    if (error) return { ok: false, error: error.message };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo cambiar el rol.",
    };
  }

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

/**
 * Revoca el acceso de un miembro. Borra la fila de `client_members`: el usuario
 * sigue existiendo en Auth, pero deja de ver esta marca (y si no tiene otra
 * membresía, deja de ver cualquier cosa).
 *
 * Lo que el miembro ya escribió NO se borra: sus comentarios y las ediciones de
 * guiones quedan, porque `owner_id` siempre apunta al dueño (trigger
 * `set_owner_from_client`).
 */
export async function removeClientMember(
  memberId: string,
  clientId: string,
): Promise<MemberActionResult> {
  try {
    const { supabase, user } = await getAuthUser();

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (clientError) return { ok: false, error: clientError.message };
    if (!client) return { ok: false, error: "Cliente no encontrado." };

    const { error } = await supabase
      .from("client_members")
      .delete()
      .eq("id", memberId)
      .eq("client_id", clientId);

    if (error) return { ok: false, error: error.message };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo revocar el acceso.",
    };
  }

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}
