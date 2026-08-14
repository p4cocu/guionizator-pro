/**
 * Comentarios de un guion (Fase D, etapa 5) — tabla `script_comments` (`0006`).
 *
 * Es el canal por el que el feedback del cliente vuelve a la app en vez de
 * quedar en un WhatsApp. Lo escriben los dos lados: el miembro del portal y
 * Paco desde `/guiones/[id]`.
 *
 * SERVER-ONLY: resuelve emails con service role. Nunca desde un `"use client"`.
 *
 * ## Lo que hace la base y acá no se repite
 *
 * - **`owner_id` lo pone un trigger** (`set_owner_from_client`, `security
 *   definer`): si quedara en el miembro que comentó, la fila desaparecería de
 *   la vista de Paco. Por eso el `insert` de acá **no manda `owner_id`**.
 * - La policy de insert exige `has_client_access(client_id) and author_id =
 *   auth.uid()`: nadie puede comentar en nombre de otro ni en una marca ajena.
 * - No hay policy de `update` ni de `delete` para nadie. Un comentario es un
 *   hecho de la conversación: se responde, no se edita. Si algún día hace falta
 *   borrar, es una policy nueva y una migración.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../supabase/service";

export type ScriptComment = {
  id: string;
  scriptId: string;
  authorId: string;
  /** `null` si no se pudo resolver (falta la service role key, o el user ya no existe). */
  authorEmail: string | null;
  /** ¿Lo escribió quien está mirando? Para poner "Tú" en vez del mail. */
  isMine: boolean;
  body: string;
  createdAt: string;
};

/**
 * Emails de los autores. Nunca lanza: sin service role devuelve el mapa vacío y
 * la UI muestra "Alguien del equipo" en lugar de tumbar la pantalla. Mismo
 * criterio que `lib/portal/members.ts`.
 */
async function resolveAuthorEmails(userIds: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return emails;

  try {
    const admin = createServiceClient();
    const results = await Promise.all(
      unique.map(async (id) => {
        const { data, error } = await admin.auth.admin.getUserById(id);
        if (error || !data?.user?.email) return null;
        return [id, data.user.email] as const;
      }),
    );
    for (const row of results) {
      if (row) emails.set(row[0], row[1]);
    }
  } catch (e) {
    console.error("[portal/comments] no se pudieron resolver los emails:", e);
  }

  return emails;
}

/**
 * Comentarios de un guion, del más viejo al más nuevo (se leen como una
 * conversación). La RLS ya limita a las marcas del usuario; el filtro por
 * `script_id` es lo único que hace falta.
 */
export async function listScriptComments(
  supabase: SupabaseClient,
  scriptId: string,
  viewerId: string,
): Promise<ScriptComment[]> {
  const { data, error } = await supabase
    .from("script_comments")
    .select("id, script_id, author_id, body, created_at")
    .eq("script_id", scriptId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const emails = await resolveAuthorEmails(rows.map((r) => r.author_id as string));

  return rows.map((r) => ({
    id: r.id as string,
    scriptId: r.script_id as string,
    authorId: r.author_id as string,
    authorEmail: emails.get(r.author_id as string) ?? null,
    isMine: (r.author_id as string) === viewerId,
    body: r.body as string,
    createdAt: r.created_at as string,
  }));
}

/** Cuántos comentarios tiene cada guion de una lista. Para el contador de la lista. */
export async function countCommentsByScript(
  supabase: SupabaseClient,
  scriptIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (scriptIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("script_comments")
    .select("script_id")
    .in("script_id", scriptIds);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const id = row.script_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export const MAX_COMMENT_LENGTH = 4000;

/**
 * Deja un comentario. `clientId` viaja explícito porque la policy de insert lo
 * necesita para `has_client_access(client_id)` — y porque el trigger lo usa
 * para resolver el `owner_id` correcto.
 */
export async function addScriptComment(
  supabase: SupabaseClient,
  input: { scriptId: string; clientId: string; authorId: string; body: string },
): Promise<void> {
  const body = input.body.trim();
  if (!body) throw new Error("El comentario está vacío.");
  if (body.length > MAX_COMMENT_LENGTH) {
    throw new Error("El comentario es demasiado largo.");
  }

  const { error } = await supabase.from("script_comments").insert({
    script_id: input.scriptId,
    client_id: input.clientId,
    author_id: input.authorId,
    body,
    // `owner_id` NO va acá: lo pone el trigger `set_owner_from_client`.
  });

  if (error) throw new Error(error.message);
}
