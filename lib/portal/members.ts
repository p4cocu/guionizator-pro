/**
 * Miembros de una marca (portal de cliente, Fase D).
 *
 * `client_members` guarda `user_id`, no el email: para mostrar "quién es" hay
 * que preguntarle a `auth.users`, que no es legible desde el browser ni con el
 * cliente de sesión. Por eso:
 *
 *  - Las FILAS de membresía se leen con el **cliente de sesión** — la policy
 *    `client_members_owner_all` (migración `0006`) ya limita a las marcas del
 *    dueño, así que no hace falta service role para eso.
 *  - Solo los EMAILS se resuelven con service role (`auth.admin.getUserById`),
 *    y si eso falla la fila cae al uuid en vez de tumbar el perfil del cliente.
 *    Mismo criterio que el estado del token de Apify en `/clientes/[id]`.
 *
 * SERVER-ONLY: importa `createServiceClient`. Nunca desde un `"use client"`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../supabase/service";
import { isPortalMemberRole, type PortalMemberRole } from "./roles";

// Los roles viven en `./roles` (módulo puro) para que la UI pueda importarlos
// sin arrastrar el service role al browser. Se reexportan acá por comodidad de
// los consumidores de servidor.
export {
  PORTAL_MEMBER_ROLES,
  isPortalMemberRole,
  portalMemberRoleLabel,
  type PortalMemberRole,
} from "./roles";

export type PortalMember = {
  id: string;
  userId: string;
  /** `null` si no se pudo resolver (falta la service role key, o el user ya no existe). */
  email: string | null;
  role: PortalMemberRole;
  createdAt: string;
};

/**
 * Emails de un conjunto de usuarios. Nunca lanza: si el service role no está
 * configurado, devuelve el mapa vacío y la UI muestra el uuid.
 */
async function resolveEmails(userIds: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  if (userIds.length === 0) return emails;

  try {
    const admin = createServiceClient();
    const results = await Promise.all(
      userIds.map(async (id) => {
        const { data, error } = await admin.auth.admin.getUserById(id);
        if (error || !data?.user?.email) return null;
        return [id, data.user.email] as const;
      }),
    );
    for (const row of results) {
      if (row) emails.set(row[0], row[1]);
    }
  } catch (e) {
    console.error("[portal/members] no se pudieron resolver los emails:", e);
  }

  return emails;
}

/**
 * Miembros de una marca, ordenados por antigüedad.
 *
 * `ownerId` se filtra a mano además de la RLS: es barato y deja explícito que
 * esta lista es del dueño, no del miembro.
 */
export async function listClientMembers(
  supabase: SupabaseClient,
  clientId: string,
  ownerId: string,
): Promise<PortalMember[]> {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (clientError) throw new Error(clientError.message);
  if (!client) return [];

  const { data, error } = await supabase
    .from("client_members")
    .select("id, user_id, role, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const emails = await resolveEmails(rows.map((r) => r.user_id as string));

  return rows.map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    email: emails.get(r.user_id as string) ?? null,
    role: (isPortalMemberRole(r.role as string) ? r.role : "viewer") as PortalMemberRole,
    createdAt: r.created_at as string,
  }));
}
