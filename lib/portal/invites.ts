/**
 * Invitaciones al portal de cliente (Fase D, etapa 3).
 *
 * Cómo funciona el token:
 *   - Se generan 32 bytes al azar y se muestran UNA sola vez, dentro del link.
 *   - En `client_invites` se guarda **solo su sha256**. Si alguien lee la tabla
 *     (o un backup), no puede aceptar la invitación: el token en claro no está
 *     en ningún lado.
 *   - Vence a los 7 días y se puede regenerar (nuevo token, nuevo vencimiento).
 *
 * Quién usa qué cliente de Supabase:
 *   - Crear / listar / revocar / regenerar → **cliente de sesión**. La policy
 *     `client_invites_owner_all` (migración `0006`) ya limita al dueño de la
 *     marca, así que no hace falta service role.
 *   - Validar y aceptar → **service role**, porque el invitado no tiene ninguna
 *     policy sobre `client_invites` (a propósito) ni puede leer `clients`.
 *     Como el service role saltea la RLS, cada consulta filtra a mano.
 *
 * SERVER-ONLY.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../supabase/service";
import { isPortalMemberRole, type PortalMemberRole } from "./roles";

/** Días que vive una invitación desde que se crea. */
export const INVITE_TTL_DAYS = 7;

export class InviteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InviteError";
  }
}

export type InviteStatus = "pendiente" | "vencida" | "aceptada";

export type ClientInvite = {
  id: string;
  email: string;
  role: PortalMemberRole;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
};

/** Lo que se devuelve al crear o regenerar: el token en claro viaja una sola vez. */
export type CreatedInvite = {
  invite: ClientInvite;
  /** Link completo para copiar y mandar. No se guarda. */
  url: string;
};

// ─── Token ───────────────────────────────────────────────────────────────────

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** sha256 en hex. Determinístico: es lo que se busca en la tabla. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Comparación en tiempo constante, por prolijidad. */
function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function buildInviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/invitacion/${token}`;
}

function expiresAt(): string {
  return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Lectura y administración (cliente de sesión) ────────────────────────────

type InviteRow = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
};

function toInvite(row: InviteRow): ClientInvite {
  const accepted = row.accepted_at !== null;
  const expired = !accepted && new Date(row.expires_at).getTime() < Date.now();

  return {
    id: row.id,
    email: row.email,
    role: (isPortalMemberRole(row.role) ? row.role : "viewer") as PortalMemberRole,
    status: accepted ? "aceptada" : expired ? "vencida" : "pendiente",
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
  };
}

/**
 * Invitaciones SIN aceptar de una marca (pendientes y vencidas). Las aceptadas
 * no se listan: esas ya son miembros y se ven en la lista de miembros.
 */
export async function listPendingInvites(
  supabase: SupabaseClient,
  clientId: string,
): Promise<ClientInvite[]> {
  const { data, error } = await supabase
    .from("client_invites")
    .select("id, email, role, expires_at, created_at, accepted_at")
    .eq("client_id", clientId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new InviteError(error.message);
  return (data ?? []).map((row) => toInvite(row as InviteRow));
}

/**
 * Crea la invitación y devuelve el link. Si ya había una sin aceptar para el
 * mismo email en esta marca, la reemplaza: dos links vivos para la misma
 * persona solo generan confusión sobre cuál es el bueno.
 */
export async function createInvite(
  supabase: SupabaseClient,
  params: {
    clientId: string;
    email: string;
    role: PortalMemberRole;
    createdBy: string;
    origin: string;
  },
): Promise<CreatedInvite> {
  const email = normalizeEmail(params.email);
  if (!EMAIL_RE.test(email)) throw new InviteError("Ese correo no parece válido.");

  const { error: cleanupError } = await supabase
    .from("client_invites")
    .delete()
    .eq("client_id", params.clientId)
    .is("accepted_at", null)
    .ilike("email", email);

  if (cleanupError) throw new InviteError(cleanupError.message);

  const token = generateToken();

  const { data, error } = await supabase
    .from("client_invites")
    .insert({
      client_id: params.clientId,
      email,
      role: params.role,
      token_hash: hashInviteToken(token),
      expires_at: expiresAt(),
      created_by: params.createdBy,
    })
    .select("id, email, role, expires_at, created_at, accepted_at")
    .single();

  if (error) throw new InviteError(error.message);

  return {
    invite: toInvite(data as InviteRow),
    url: buildInviteUrl(params.origin, token),
  };
}

/**
 * Nuevo token y nuevo vencimiento para una invitación existente. El link viejo
 * deja de servir en el acto (su hash ya no está en la fila).
 */
export async function regenerateInvite(
  supabase: SupabaseClient,
  params: { inviteId: string; clientId: string; origin: string },
): Promise<CreatedInvite> {
  const token = generateToken();

  const { data, error } = await supabase
    .from("client_invites")
    .update({ token_hash: hashInviteToken(token), expires_at: expiresAt() })
    .eq("id", params.inviteId)
    .eq("client_id", params.clientId)
    .is("accepted_at", null)
    .select("id, email, role, expires_at, created_at, accepted_at")
    .maybeSingle();

  if (error) throw new InviteError(error.message);
  if (!data) throw new InviteError("Esa invitación ya no existe o ya fue aceptada.");

  return {
    invite: toInvite(data as InviteRow),
    url: buildInviteUrl(params.origin, token),
  };
}

export async function deleteInvite(
  supabase: SupabaseClient,
  inviteId: string,
  clientId: string,
): Promise<void> {
  const { error } = await supabase
    .from("client_invites")
    .delete()
    .eq("id", inviteId)
    .eq("client_id", clientId);

  if (error) throw new InviteError(error.message);
}

// ─── Validar y aceptar (service role) ────────────────────────────────────────
// El invitado no tiene policies sobre `client_invites` ni sobre `clients`: todo
// este tramo corre sin RLS y valida a mano.

export type InvitePreview = {
  email: string;
  role: PortalMemberRole;
  status: InviteStatus;
  /** Nombre de la marca a la que se lo invita. */
  clientName: string;
  clientId: string;
};

type InviteLookup = {
  id: string;
  client_id: string;
  email: string;
  role: string;
  token_hash: string;
  expires_at: string;
  accepted_at: string | null;
  clientName: string;
};

async function lookupByToken(token: string): Promise<InviteLookup | null> {
  const hash = hashInviteToken(token);
  const admin = createServiceClient();

  const { data, error } = await admin
    .from("client_invites")
    .select("id, client_id, email, role, token_hash, expires_at, accepted_at")
    .eq("token_hash", hash)
    .maybeSingle();

  if (error) throw new InviteError(error.message);
  if (!data) return null;
  // El select ya filtró por hash; esta comparación es cinturón de seguridad.
  if (!hashesMatch(data.token_hash as string, hash)) return null;

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("nombre, marca")
    .eq("id", data.client_id as string)
    .maybeSingle();

  if (clientError) throw new InviteError(clientError.message);

  return {
    id: data.id as string,
    client_id: data.client_id as string,
    email: data.email as string,
    role: data.role as string,
    token_hash: data.token_hash as string,
    expires_at: data.expires_at as string,
    accepted_at: (data.accepted_at as string | null) ?? null,
    clientName: (client?.marca as string | null) || (client?.nombre as string | null) || "tu marca",
  };
}

/** Para pintar la pantalla pública. `null` = token inexistente. */
export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  const row = await lookupByToken(token);
  if (!row) return null;

  const accepted = row.accepted_at !== null;
  const expired = !accepted && new Date(row.expires_at).getTime() < Date.now();

  return {
    email: row.email,
    role: (isPortalMemberRole(row.role) ? row.role : "viewer") as PortalMemberRole,
    status: accepted ? "aceptada" : expired ? "vencida" : "pendiente",
    clientName: row.clientName,
    clientId: row.client_id,
  };
}

export type AcceptResult = { clientName: string; role: PortalMemberRole };

/**
 * Acepta la invitación para el usuario dado. Valida, en este orden: que el
 * token exista, que no esté aceptada, que no esté vencida y que el email de la
 * sesión sea EXACTAMENTE el invitado — sin eso, cualquiera con el link entraría
 * con su propia cuenta.
 */
export async function acceptInvite(
  token: string,
  user: { id: string; email: string | null | undefined },
): Promise<AcceptResult> {
  const row = await lookupByToken(token);
  if (!row) throw new InviteError("Esta invitación no existe o el link está incompleto.");

  const sessionEmail = normalizeEmail(user.email ?? "");
  const invitedEmail = normalizeEmail(row.email);

  if (row.accepted_at !== null) {
    throw new InviteError("Esta invitación ya fue aceptada. Entra con tu cuenta.");
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new InviteError("Esta invitación venció. Pedí una nueva.");
  }
  if (!sessionEmail || sessionEmail !== invitedEmail) {
    throw new InviteError(
      `Esta invitación es para ${row.email}. Cerrá sesión y entrá con esa cuenta.`,
    );
  }

  const role = (isPortalMemberRole(row.role) ? row.role : "viewer") as PortalMemberRole;
  const admin = createServiceClient();

  const { error: memberError } = await admin
    .from("client_members")
    .upsert(
      { client_id: row.client_id, user_id: user.id, role },
      { onConflict: "client_id,user_id" },
    );

  if (memberError) throw new InviteError(memberError.message);

  // Si esto falla, el acceso ya quedó dado: se avisa, pero no se revierte la
  // membresía (peor sería dejarlo afuera por no poder marcar una fecha).
  const { error: markError } = await admin
    .from("client_invites")
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", row.id);

  if (markError) {
    console.error("[portal/invites] no se pudo marcar la invitación como aceptada:", markError);
  }

  return { clientName: row.clientName, role };
}
