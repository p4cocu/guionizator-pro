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
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sanitizeFeatures, type PortalFeatureSlug } from "@/lib/portal/features";
import { isGenerationMode, type PortalGenerationMode } from "@/lib/portal/generationMode";
import { isPortalMemberRole, listClientMembers } from "@/lib/portal/members";
import { setMemberDisplayName, setOwnDisplayName } from "@/lib/portal/profiles";
import {
  createInvite,
  deleteInvite,
  regenerateInvite,
  type ClientInvite,
} from "@/lib/portal/invites";

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

/** Confirma que la marca es de este usuario. `client_members` y
 *  `client_invites` no tienen `owner_id`: la pertenencia se chequea contra
 *  `clients`. */
async function assertOwnsClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  ownerId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Cliente no encontrado.");
}

/**
 * Origen para armar el link de invitación. Se prefiere el host real del request
 * (funciona igual en localhost y en producción) y se cae a `NEXT_PUBLIC_SITE_URL`.
 */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}`;

  const fallback = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!fallback) throw new Error("No se pudo determinar la URL del sitio.");
  return fallback;
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

// ─── Transcripción: tope mensual ─────────────────────────────────────────────
// No es un slug de `enabled_features` (viaja con "competencia", que es
// gratis): es solo el número que corta cuántas transcripciones puede pedir el
// cliente desde el portal antes de que se reinicie el mes. Mismo patrón que
// `setAiGenerationLimit`.

export type SetTranscriptionLimitResult =
  | { ok: true; limit: number | null }
  | { ok: false; error: string };

export async function setTranscriptionLimit(
  clientId: string,
  rawLimit: number | null,
): Promise<SetTranscriptionLimitResult> {
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
      .update({ transcription_limit: limit })
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

// ─── Add-on de IA: modo de generación ────────────────────────────────────────

export type SetAiModeResult =
  | { ok: true; mode: PortalGenerationMode }
  | { ok: false; error: string };

/**
 * Qué flujo ve el cliente en `/portal/[id]/generar`: `simple` (brief → guion) o
 * `completo` (brief → Big Idea → estructura → guion).
 *
 * `clients.ai_generation_mode` tiene `CHECK constraint` (migración `0009`), así
 * que el valor pasa sí o sí por `isGenerationMode` antes de tocar Postgres: un
 * valor desconocido tiene que volver como error legible, no como un 500 de la
 * base.
 */
export async function setAiGenerationMode(
  clientId: string,
  rawMode: string,
): Promise<SetAiModeResult> {
  if (!isGenerationMode(rawMode)) {
    return { ok: false, error: "Modo de generación desconocido." };
  }

  try {
    const { supabase, user } = await getAuthUser();

    const { error } = await supabase
      .from("clients")
      .update({ ai_generation_mode: rawMode })
      .eq("id", clientId)
      .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar el modo.",
    };
  }

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, mode: rawMode };
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
    await assertOwnsClient(supabase, clientId, user.id);

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
    await assertOwnsClient(supabase, clientId, user.id);

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

// ─── Invitaciones (etapa 3) ──────────────────────────────────────────────────
// El link se genera acá y se copia a mano: el envío automático por email quedó
// como pendiente (el SMTP default de Supabase corta a ~4 mails/hora y falla si
// el email ya existe en Auth). Ver docs/fase-d-portal-cliente.md.

export type InviteResult =
  | { ok: true; invite: ClientInvite; url: string }
  | { ok: false; error: string };

/**
 * Crea (o reemplaza) la invitación de un email a esta marca y devuelve el link.
 * El token en claro se ve UNA sola vez: en la base solo queda su sha256.
 */
export async function inviteClientMember(
  clientId: string,
  email: string,
  role: string,
): Promise<InviteResult> {
  if (!isPortalMemberRole(role)) return { ok: false, error: "Rol desconocido." };

  try {
    const { supabase, user } = await getAuthUser();
    await assertOwnsClient(supabase, clientId, user.id);

    // Si ya es miembro, invitarlo de nuevo no aporta nada y confunde.
    const normalized = email.trim().toLowerCase();
    const members = await listClientMembers(supabase, clientId, user.id).catch(() => []);
    if (members.some((m) => m.email?.toLowerCase() === normalized)) {
      return { ok: false, error: "Ese correo ya tiene acceso a esta marca." };
    }

    const origin = await requestOrigin();
    const created = await createInvite(supabase, {
      clientId,
      email,
      role,
      createdBy: user.id,
      origin,
    });

    revalidatePath(`/clientes/${clientId}`);
    return { ok: true, invite: created.invite, url: created.url };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo crear la invitación.",
    };
  }
}

/**
 * Nuevo token y nuevo vencimiento. Sirve tanto para "se venció" como para
 * "el link se filtró": el anterior deja de funcionar en el acto.
 */
export async function regenerateInviteLink(
  inviteId: string,
  clientId: string,
): Promise<InviteResult> {
  try {
    const { supabase, user } = await getAuthUser();
    await assertOwnsClient(supabase, clientId, user.id);

    const origin = await requestOrigin();
    const created = await regenerateInvite(supabase, { inviteId, clientId, origin });

    revalidatePath(`/clientes/${clientId}`);
    return { ok: true, invite: created.invite, url: created.url };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo regenerar el link.",
    };
  }
}

export async function revokeClientInvite(
  inviteId: string,
  clientId: string,
): Promise<MemberActionResult> {
  try {
    const { supabase, user } = await getAuthUser();
    await assertOwnsClient(supabase, clientId, user.id);
    await deleteInvite(supabase, inviteId, clientId);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo cancelar la invitación.",
    };
  }

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

/**
 * Cambia el nombre visible de un miembro (etapa 8).
 *
 * El nombre lo elige la persona una sola vez, al entrar; de ahí en adelante
 * corregirlo es atribución del dueño de la marca. `portal_profiles` no tiene
 * policies para nadie, así que el `update` va con service role dentro de
 * `setMemberDisplayName`, que revalida la pertenencia con el cliente de sesión
 * antes de escribir — sin eso, esta action renombraría a cualquier usuario de
 * la base.
 */
export async function setMemberName(
  memberId: string,
  clientId: string,
  displayName: string,
): Promise<MemberActionResult> {
  try {
    const { supabase, user } = await getAuthUser();
    await assertOwnsClient(supabase, clientId, user.id);
    await setMemberDisplayName(supabase, {
      memberId,
      clientId,
      ownerId: user.id,
      displayName,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar el nombre.",
    };
  }

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

/**
 * El nombre con el que el propio Paco aparece en los comentarios del portal.
 *
 * Es un ajuste **global** (una fila por usuario, no por marca), pero se edita
 * desde el perfil de cualquier marca porque es ahí donde se ve el efecto. Sin
 * esto, sus comentarios le muestran al cliente la etiqueta genérica hasta que
 * entre a `/portal` y pase por el gate.
 */
export async function setOwnPortalName(
  clientId: string,
  displayName: string,
): Promise<MemberActionResult> {
  try {
    const { user } = await getAuthUser();
    await setOwnDisplayName(user.id, displayName);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar tu nombre.",
    };
  }

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}
