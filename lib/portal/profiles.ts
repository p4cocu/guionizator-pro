/**
 * Nombre visible de cada usuario del portal (Fase D, etapa 8) — tabla
 * `portal_profiles` (migración `0012`).
 *
 * Es lo que ve el cliente en los comentarios y en el rastro de ediciones, en
 * lugar del email crudo del autor (que es lo que mostraba el portal hasta la
 * etapa 7: la dirección personal de Paco, tal cual).
 *
 * SERVER-ONLY, **service role siempre**: la tabla tiene RLS activa sin ninguna
 * policy y `revoke all … from anon, authenticated`. Es a propósito:
 *
 *  - Si el miembro pudiera hacer `update` de su propia fila con su JWT, se
 *    renombraría igual que otro y firmaría comentarios en su nombre.
 *  - El nombre se elige **una vez**, al entrar al portal o al aceptar la
 *    invitación; cambiarlo después es atribución del dueño de la marca
 *    (`/clientes/[id]` → "Portal del cliente").
 *
 * Como el service role saltea la RLS, quien llama tiene que haber validado la
 * pertenencia antes: `setMemberDisplayName` no confía en su llamador y
 * revalida que ese usuario sea miembro de una marca del dueño.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../supabase/service";

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;

/** Lo que se le muestra al cliente cuando el autor es el dueño y no tiene nombre. */
export const OWNER_FALLBACK_LABEL = "Equipo de contenido";
/** Lo que se le muestra cuando no se pudo resolver a nadie. */
export const UNKNOWN_AUTHOR_LABEL = "Alguien del equipo";

/**
 * La misma leyenda en las tres puertas donde se pide el nombre (alta en el
 * portal, invitación, panel del dueño). Vive acá para que no se desincronicen.
 */
export const DISPLAY_NAME_HINT =
  "Este nombre es el que ven los demás en los comentarios y en el historial de cambios. Sirve para saber quién pidió qué y darle seguimiento.";

export class DisplayNameError extends Error {}

/**
 * Normaliza y valida. Espeja el CHECK de la migración `0012`: si esto pasa, el
 * insert no puede fallar por longitud.
 */
export function normalizeDisplayName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < DISPLAY_NAME_MIN) {
    throw new DisplayNameError("El nombre tiene que tener al menos 2 caracteres.");
  }
  if (name.length > DISPLAY_NAME_MAX) {
    throw new DisplayNameError("El nombre no puede pasar de 40 caracteres.");
  }
  return name;
}

/** El nombre de un usuario, o `null` si todavía no eligió. Nunca lanza. */
export async function getDisplayName(userId: string): Promise<string | null> {
  try {
    const { data } = await createServiceClient()
      .from("portal_profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.display_name as string | undefined) ?? null;
  } catch (e) {
    console.error("[portal/profiles] no se pudo leer el nombre:", e);
    return null;
  }
}

/**
 * Nombres de varios usuarios de una sola consulta. Nunca lanza: sin service
 * role devuelve el mapa vacío y quien llama cae a su etiqueta genérica, igual
 * que hacen `lib/portal/members.ts` y `lib/portal/comments.ts` con los emails.
 */
export async function getDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return names;

  try {
    const { data, error } = await createServiceClient()
      .from("portal_profiles")
      .select("user_id, display_name")
      .in("user_id", unique);

    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      names.set(row.user_id as string, row.display_name as string);
    }
  } catch (e) {
    console.error("[portal/profiles] no se pudieron leer los nombres:", e);
  }

  return names;
}

/**
 * Alta o cambio del nombre propio. La usa el gate de `/portal` y el alta por
 * invitación: en los dos casos quien escribe es el dueño de esa cuenta, así que
 * `userId` sale de la sesión, nunca del formulario.
 */
export async function setOwnDisplayName(userId: string, raw: string): Promise<string> {
  const display_name = normalizeDisplayName(raw);

  const { error } = await createServiceClient()
    .from("portal_profiles")
    .upsert(
      { user_id: userId, display_name, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (error) throw new DisplayNameError(error.message);
  return display_name;
}

/**
 * Cambio de nombre hecho por el dueño de la marca.
 *
 * Revalida la pertenencia con el **cliente de sesión** (la policy
 * `client_members_owner_all` ya limita a las marcas del dueño) antes de
 * escribir con service role: sin ese paso, cualquiera que llegue a la action
 * podría renombrar a cualquier usuario de la base.
 */
export async function setMemberDisplayName(
  supabase: SupabaseClient,
  input: { memberId: string; clientId: string; ownerId: string; displayName: string },
): Promise<{ userId: string; displayName: string }> {
  const displayName = normalizeDisplayName(input.displayName);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", input.clientId)
    .eq("owner_id", input.ownerId)
    .maybeSingle();

  if (clientError) throw new DisplayNameError(clientError.message);
  if (!client) throw new DisplayNameError("Esa marca no es tuya.");

  const { data: member, error: memberError } = await supabase
    .from("client_members")
    .select("user_id")
    .eq("id", input.memberId)
    .eq("client_id", input.clientId)
    .maybeSingle();

  if (memberError) throw new DisplayNameError(memberError.message);
  if (!member) throw new DisplayNameError("Ese miembro no existe en esta marca.");

  const userId = member.user_id as string;
  await setOwnDisplayName(userId, displayName);
  return { userId, displayName };
}
