/**
 * Completar las métricas de un post guardado a mano.
 *
 * Un link pegado por una persona entra con likes, comentarios y vistas en cero
 * y sin cuenta identificada: Instagram **no revela nada de eso en la URL**, y
 * los números que se ven en la portada los dibuja el propio embed de Instagram
 * dentro de un iframe de otro dominio, así que la página no puede leerlos.
 * La única fuente real es Apify.
 *
 * Corre en un **segundo paso**, después de que el post ya se guardó y la
 * tarjeta ya está en pantalla. No adentro del guardado, y eso es a propósito:
 * una corrida de Apify tarda entre 5 y 20 segundos, y meterla en el camino del
 * guardado convertiría un "pegar y listo" en una espera con la pantalla
 * bloqueada — además de dejar el link sin guardar si Apify falla.
 *
 * **Nunca lanza.** Fallar en enriquecer no es fallar: la tarjeta ya existe y
 * sigue sirviendo con ceros. Los motivos por los que se cae son todos
 * esperables — la marca no tiene token de Apify propio (y el global es
 * exclusivo del super admin), el post es privado o se borró, Apify tardó más de
 * los 20s que le damos.
 *
 * SERVER-ONLY: recibe siempre un cliente con service role, porque el miembro
 * del portal no tiene `update` sobre `competitor_posts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSinglePost } from "../apify/client";
import { resolveApifyToken } from "./apifyToken";
import { UNKNOWN_ACCOUNT } from "./savedLink";

export type EnrichResult =
  /** Se actualizó: vuelven solo las columnas que cambiaron, para pintar la tarjeta. */
  | { ok: true; fields: Record<string, unknown> }
  /** No se pudo. `reason` es para el log, no para la cara del usuario. */
  | { ok: false; reason: string };

/**
 * Pide el post a Apify y le copia lo que traiga.
 *
 * ⚠️ **`posted_at` pasa a ser la fecha real de publicación**, que puede ser muy
 * anterior al día en que se guardó. Por eso la retención de los posts manuales
 * se mide contra `scraped_at` y no contra `posted_at` (ver
 * `lib/competencia/retention.ts`): si se midiera contra `posted_at`, guardar un
 * reel de hace ocho meses lo dejaría vencido en el mismo momento de
 * enriquecerlo y el cron lo borraría esa misma noche.
 *
 * El `username` solo se pisa si todavía es el sentinela o si está vacío: si la
 * persona escribió una cuenta a mano, se le respeta.
 */
export async function enrichSavedPost(
  admin: SupabaseClient,
  input: { postId: string; clientId: string; ownerId: string },
): Promise<EnrichResult> {
  try {
    const { data: post } = await admin
      .from("competitor_posts")
      .select("id, permalink, username")
      .eq("id", input.postId)
      .eq("client_id", input.clientId)
      .maybeSingle();

    if (!post) return { ok: false, reason: "El post no existe o no es de esta marca." };

    const permalink = post.permalink as string | null;
    if (!permalink) return { ok: false, reason: "El post no tiene link." };
    if (!/instagram\.com/i.test(permalink)) {
      return { ok: false, reason: "Solo se pueden traer métricas de Instagram." };
    }

    // Cadena de siempre: token de la marca → global (exclusivo del super admin).
    // `expectedOwnerId` es el chequeo de pertenencia que el service role no tiene.
    const { token } = await resolveApifyToken(input.clientId, {
      expectedOwnerId: input.ownerId,
    });

    const fresh = await fetchSinglePost(token, permalink);
    if (!fresh) return { ok: false, reason: "Apify no devolvió ese post." };

    const currentUsername = (post.username as string) || "";
    const fields: Record<string, unknown> = {
      likes: fresh.likes,
      comments: fresh.comments,
      video_views: fresh.videoViews ?? null,
      // Link firmado y de vida corta; sirve para transcribir sin volver a pedirlo.
      video_url: fresh.videoUrl ?? null,
      followers: fresh.followers ?? null,
      scraped_at: new Date().toISOString(),
    };

    if (fresh.caption) fields.caption = fresh.caption;
    if (fresh.type) fields.type = fresh.type;
    if (fresh.postedAt) fields.posted_at = fresh.postedAt;
    if (fresh.shortcode) fields.shortcode = fresh.shortcode;
    if (fresh.username && (currentUsername === UNKNOWN_ACCOUNT || !currentUsername)) {
      fields.username = fresh.username;
    }

    const { error } = await admin
      .from("competitor_posts")
      .update(fields)
      .eq("id", input.postId)
      .eq("client_id", input.clientId);

    if (error) return { ok: false, reason: error.message };
    return { ok: true, fields };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "No se pudieron traer las métricas.",
    };
  }
}
