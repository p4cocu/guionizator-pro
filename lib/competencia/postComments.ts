/**
 * Notas sobre un post de competencia — tabla `competitor_post_comments` (`0015`).
 *
 * Es el mismo canal que `script_comments` abrió para los guiones, aplicado al
 * tablero de competencia: la estrella dice "esto me sirve" pero no dice POR
 * QUÉ, y ese "por qué" ("me gustó el gancho", "el corte del segundo 3") es lo
 * único que después se puede accionar. Lo escriben los dos lados: Paco desde
 * `/competencia` y el cliente desde `/portal/[id]/competencia`.
 *
 * SERVER-ONLY: resuelve nombres con service role. Nunca desde un `"use client"`.
 *
 * ## Lo que hace la base y acá no se repite
 *
 * - **`owner_id` lo pone el trigger** `set_owner_from_client` (`0006`, `security
 *   definer`). Por eso el `insert` de acá **no lo manda**: si quedara en el
 *   miembro que comentó, la fila desaparecería de la vista de Paco.
 * - La policy de insert exige `has_client_access(client_id) and author_id =
 *   auth.uid()`: nadie comenta en nombre de otro ni en una marca ajena.
 * - No hay `update` ni `delete` para el miembro. Una nota se responde, no se
 *   edita. Se van solas con el post por el `on delete cascade`.
 *
 * ⚠️ **Nunca se muestra un email**, a diferencia de `lib/portal/comments.ts`,
 * que lo manda porque la pantalla de Paco lo usa para saber qué cuenta escribió.
 * Acá el nombre alcanza: desde la etapa 8 nadie entra al portal sin elegir uno
 * (el gate de `app/(portal)/portal/layout.tsx`), así que `authorLabel` cae en
 * las etiquetas de respaldo solo para filas viejas o usuarios borrados.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getDisplayNames, OWNER_FALLBACK_LABEL, UNKNOWN_AUTHOR_LABEL } from "../portal/profiles";
// El tipo y el tope viven en un módulo puro para que las pantallas `"use
// client"` puedan usarlos sin arrastrar `createServiceClient` al browser.
import {
  MAX_POST_COMMENT_LENGTH,
  type PostComment,
  type PostCommentsByPost,
} from "./postCommentShape";

export { MAX_POST_COMMENT_LENGTH };
export type { PostComment, PostCommentsByPost };

/**
 * Trae de una sola consulta las notas de TODOS los posts de una marca y las
 * agrupa. La pantalla de competencia dibuja decenas de tarjetas: una consulta
 * por tarjeta sería una tormenta de requests para mostrar, casi siempre, cero
 * notas.
 *
 * Se devuelve un objeto plano y no un `Map` porque cruza el límite
 * servidor→cliente de Next, que no serializa `Map`.
 *
 * Nunca lanza: si la lectura falla, la pantalla se dibuja sin notas en vez de
 * caerse entera. El hilo es un agregado, no el contenido principal.
 */
export async function listPostCommentsByClient(
  supabase: SupabaseClient,
  clientId: string,
  viewerId: string,
  /** Dueño de la marca, para marcar `isOwner`. Lo pasa quien ya lo tenía a mano. */
  ownerId?: string,
): Promise<PostCommentsByPost> {
  const grouped: PostCommentsByPost = {};

  try {
    const { data, error } = await supabase
      .from("competitor_post_comments")
      .select("id, post_id, author_id, body, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    const rows = data ?? [];
    if (rows.length === 0) return grouped;

    const names = await getDisplayNames(rows.map((r) => r.author_id as string));

    for (const r of rows) {
      const authorId = r.author_id as string;
      const isOwner = ownerId !== undefined && authorId === ownerId;
      const postId = r.post_id as string;
      (grouped[postId] ??= []).push({
        id: r.id as string,
        postId,
        authorLabel:
          names.get(authorId) ?? (isOwner ? OWNER_FALLBACK_LABEL : UNKNOWN_AUTHOR_LABEL),
        isMine: authorId === viewerId,
        isOwner,
        body: r.body as string,
        createdAt: r.created_at as string,
      });
    }
  } catch (e) {
    console.error("[competencia/postComments] no se pudieron leer las notas:", e);
  }

  return grouped;
}

/**
 * Deja una nota. `clientId` viaja explícito porque la policy de insert lo
 * necesita para `has_client_access(client_id)` — y porque el trigger lo usa
 * para resolver el `owner_id` correcto.
 *
 * Devuelve la nota ya armada para que la UI la pinte sin volver a consultar.
 */
export async function addPostComment(
  supabase: SupabaseClient,
  input: { postId: string; clientId: string; authorId: string; body: string; isOwner: boolean },
): Promise<PostComment> {
  const body = input.body.trim();
  if (!body) throw new Error("La nota está vacía.");
  if (body.length > MAX_POST_COMMENT_LENGTH) {
    throw new Error(`La nota no puede pasar de ${MAX_POST_COMMENT_LENGTH} caracteres.`);
  }

  const { data, error } = await supabase
    .from("competitor_post_comments")
    .insert({
      post_id: input.postId,
      client_id: input.clientId,
      author_id: input.authorId,
      body,
      // `owner_id` NO va acá: lo pone el trigger `set_owner_from_client`.
    })
    .select("id, post_id, body, created_at")
    .single();

  if (error) throw new Error(error.message);

  const names = await getDisplayNames([input.authorId]);
  return {
    id: data.id as string,
    postId: data.post_id as string,
    authorLabel:
      names.get(input.authorId) ??
      (input.isOwner ? OWNER_FALLBACK_LABEL : UNKNOWN_AUTHOR_LABEL),
    isMine: true,
    isOwner: input.isOwner,
    body: data.body as string,
    createdAt: data.created_at as string,
  };
}
