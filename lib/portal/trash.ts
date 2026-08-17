/**
 * Papelera de guiones (Fase D, etapa 7) — migración `0011`.
 *
 * SERVER-ONLY, service role: un `viewer` no tiene NINGUNA policy de `update`
 * sobre `scripts` (solo `collaborator` la tiene, vía `scripts_member_update`),
 * y cualquier miembro puede mandar a la papelera — es reversible y solo Paco
 * la ve, así que no hace falta el nivel de permiso de aprobar. Con la mitad de
 * los miembros sin `update` en su sesión, esto tiene que ir con service role,
 * igual que los comentarios.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export class TrashError extends Error {}

/**
 * Manda un guion a la papelera. No borra nada — solo marca `trashed_at`.
 *
 * Nota: solo marca la versión `is_latest` (la única que ve el portal). Si el
 * guion tiene versiones anteriores, quedan igual en la tabla, invisibles
 * (`getScripts` ya las escondía por no ser `is_latest`) pero sin `trashed_at`,
 * así que el cron de 30 días tampoco las alcanza. Es una fuga menor de filas
 * viejas, no un guion recuperable a medias — aceptado a propósito en vez de
 * reconstruir la cadena de versiones acá.
 */
export async function trashScript(
  admin: SupabaseClient,
  scriptId: string,
  clientId: string,
): Promise<void> {
  const { data, error } = await admin
    .from("scripts")
    .update({ trashed_at: new Date().toISOString() })
    .eq("id", scriptId)
    .eq("client_id", clientId)
    .select("id");

  if (error) throw new TrashError(error.message);
  if (!data?.length) throw new TrashError("Ese guion no existe o no es de esta marca.");
}

/** Saca un guion de la papelera. Solo lo llama Paco (server action del estudio). */
export async function restoreScript(
  supabase: SupabaseClient,
  scriptId: string,
  ownerId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("scripts")
    .update({ trashed_at: null })
    .eq("id", scriptId)
    .eq("owner_id", ownerId)
    .select("id");

  if (error) throw new TrashError(error.message);
  if (!data?.length) throw new TrashError("Ese guion no existe.");
}
