/**
 * Lo que el portal necesita del tablero de competencia y no puede vivir en
 * `actions.ts`: en un módulo `"use server"` todo export tiene que ser async, así
 * que una constante como `PORTAL_POST_COLUMNS` rompe el build (misma razón por
 * la que `PASSWORD_MIN` vive en `lib/portal/profiles.ts`).
 *
 * SERVER-ONLY: recibe siempre un cliente con service role.
 *
 * ## Por qué guardar y borrar van con service role
 *
 * La `0006` le dio al miembro **solo `select`** sobre `competitor_posts`, y no
 * se le va a dar más: con su JWT y la anon key puede llamar a PostgREST
 * directo, así que un `insert` o un `delete` propios serían permiso para tocar
 * cualquier columna de cualquier fila de su marca (`is_disliked`, la
 * transcripción, la clasificación). Mismo patrón que `lib/portal/trash.ts` y
 * `toggleClientFavorite`. Como el service role se saltea la RLS, **cada
 * consulta filtra `client_id` a mano**.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseSavedLink,
  normalizeAccount,
  UNKNOWN_ACCOUNT,
  type SavedLinkType,
} from "../competencia/savedLink";

/**
 * Las columnas que dibuja el portal. Menos que las del estudio: el miembro no
 * ve `is_disliked` (marca interna) ni `classification_notes`.
 *
 * ⚠️ Tiene que seguir coincidiendo con `PortalPostBase` en
 * `CompetenciaPortalClient.tsx`, o la tarjeta recién guardada llega con campos
 * en `undefined` mientras que las que vienen del server render sí los traen.
 */
export const PORTAL_POST_COLUMNS =
  "id, public_id, username, permalink, type, caption, likes, comments, video_views, posted_at, transcription, is_favorite, is_manual, hook_type, script_structure, value_pillar";

export type SaveLinkInput = {
  clientId: string;
  ownerId: string;
  /** Lo que pegó la persona. Se normaliza acá. */
  url: string;
  /** Opcional: Instagram no la revela en la URL de un reel. */
  account: string;
  type: SavedLinkType;
};

export type SavedLinkOutcome = {
  /** La fila, con las columnas que dibuja el portal. */
  post: Record<string, unknown>;
  /** `true` si el link ya estaba en el tablero y solo se le puso la estrella. */
  alreadyExisted: boolean;
};

export class SaveLinkError extends Error {}

/**
 * Guarda un link en el tablero de una marca. **Nace con la estrella puesta**
 * (`is_favorite: true`): el cliente lo guardó a propósito, así que aparece de
 * una en el filtro "⭐ Guardados". Se la puede quitar después como a cualquier
 * otro.
 *
 * Si el link ya está en el tablero (mismo `shortcode` en la misma marca) **no
 * se duplica**: se marca esa fila y se devuelve, con `alreadyExisted: true`.
 * El caso real es el cliente pegando el link de un reel que el scrape ya trajo.
 *
 * ⚠️ Un post que estaba descartado (`is_disliked`) se **des-descarta** al
 * guardarlo. El portal esconde los descartados, así que sin esto la respuesta
 * sería "ya lo tenías guardado" sobre una tarjeta que el cliente no ve por
 * ningún lado. Guardar es una petición explícita y gana sobre la marca interna.
 *
 * `posted_at` se llena con el momento de guardado porque un link suelto no
 * trae fecha. Es lo que mide la retención (120 días, ver
 * `lib/competencia/retention.ts`), y un scrape posterior de esa cuenta lo pisa
 * con la fecha real de publicación — el upsert va por `shortcode` y por eso el
 * shortcode se guarda.
 */
export async function saveLinkForClient(
  admin: SupabaseClient,
  input: SaveLinkInput,
): Promise<SavedLinkOutcome> {
  const parsed = parseSavedLink(input.url);
  if (!parsed) {
    throw new SaveLinkError("Ese link no se entiende. Pegá la dirección completa del contenido.");
  }

  if (parsed.shortcode) {
    const { data: existing, error: findErr } = await admin
      .from("competitor_posts")
      .select(PORTAL_POST_COLUMNS)
      .eq("client_id", input.clientId)
      .eq("shortcode", parsed.shortcode)
      .maybeSingle();
    if (findErr) throw new SaveLinkError(findErr.message);

    if (existing) {
      const { data: updated, error: updErr } = await admin
        .from("competitor_posts")
        .update({ is_favorite: true, is_disliked: false })
        .eq("id", existing.id as string)
        .eq("client_id", input.clientId)
        .select(PORTAL_POST_COLUMNS)
        .single();
      if (updErr) throw new SaveLinkError(updErr.message);
      return { post: updated as Record<string, unknown>, alreadyExisted: true };
    }
  }

  // La cuenta: la que escribió la persona, o la que venía en la propia URL, o
  // el sentinela (`username` es `not null` en la base).
  const account = normalizeAccount(input.account) ?? parsed.username ?? UNKNOWN_ACCOUNT;

  const { data, error } = await admin
    .from("competitor_posts")
    .insert({
      owner_id: input.ownerId,
      client_id: input.clientId,
      username: account,
      shortcode: parsed.shortcode,
      permalink: parsed.url,
      // Lo que diga la URL manda sobre lo que eligió la persona: `/reel/` es un
      // video sin lugar a duda, y equivocarse acá esconde "Transcribir".
      type: parsed.type ?? input.type,
      caption: null,
      likes: 0,
      comments: 0,
      video_views: null,
      followers: null,
      posted_at: new Date().toISOString(),
      is_manual: true,
      is_favorite: true,
      is_disliked: false,
    })
    .select(PORTAL_POST_COLUMNS)
    .single();

  if (error) throw new SaveLinkError(error.message);
  return { post: data as Record<string, unknown>, alreadyExisted: false };
}

/**
 * Borra un post del tablero de una marca, **de verdad y para todos** (también
 * para Paco en `/competencia`). Decisión de Paco (2026-09-10): sin papelera
 * intermedia, para que la tabla no crezca sin techo.
 *
 * Lo que se va con la fila: sus notas (`competitor_post_comments`, por el `on
 * delete cascade` de la `0015`), su transcripción y su clasificación. Lo que
 * NO: los reportes ya generados, que llevan snapshot congelado, y los guiones
 * adaptados a partir de él — `scripts.source_post_id` es `on delete set null`.
 *
 * Por eso la UI confirma antes (`ConfirmDeleteButton`): no hay vuelta atrás.
 */
export async function deletePostForClient(
  admin: SupabaseClient,
  clientId: string,
  postId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("competitor_posts")
    .delete()
    .eq("id", postId)
    .eq("client_id", clientId)
    .select("id");

  if (error) throw new SaveLinkError(error.message);
  return (data?.length ?? 0) > 0;
}
