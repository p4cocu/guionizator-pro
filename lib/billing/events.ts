/**
 * Idempotencia del webhook de Stripe (Fase E).
 *
 * ⚠️ SERVER-ONLY: service role. `stripe_events` tiene RLS activa y ninguna
 * policy (migración `0013`).
 *
 * ## Por qué hace falta
 *
 * Stripe **reintenta** cualquier evento al que no le respondas 2xx, y puede
 * mandar el mismo evento más de una vez aunque le hayas respondido bien (su
 * garantía es "al menos una vez", no "exactamente una"). Sin este guard, un
 * reintento de `checkout.session.completed` acreditaría la recarga dos veces.
 *
 * El patrón es el mismo que usa `client_invites` con el hash del token: la base
 * es la fuente de verdad, no la memoria del proceso. `insert … on conflict do
 * nothing` y mirar si insertó algo — en una sola ida, sin leer antes.
 */

import { createServiceClient } from "../supabase/service";

/**
 * Marca un evento como procesado.
 *
 * Devuelve `true` si es la primera vez que se ve (hay que procesarlo) y `false`
 * si ya estaba (reintento de Stripe: responder 200 y salir).
 *
 * Se llama **antes** de tocar nada. Si el procesamiento posterior falla y se
 * responde 500, Stripe reintenta y el evento ya va a figurar como visto — por
 * eso lo que viene después tiene que ser idempotente por su cuenta: los updates
 * de suscripción son planos (no leen el estado anterior) y la acreditación de
 * recargas tiene su propio unique sobre la checkout session.
 *
 * **Nunca lanza.** Si la tabla no se puede escribir, se devuelve `true` y se
 * procesa igual: perder un cobro por no poder escribir el log de auditoría
 * sería peor que arriesgar un reintento duplicado, que además queda cubierto
 * por los uniques de abajo.
 */
export async function markEventProcessed(
  eventId: string,
  type: string,
  payload: unknown,
): Promise<boolean> {
  try {
    const { data, error } = await createServiceClient()
      .from("stripe_events")
      .insert({ id: eventId, type, payload })
      // Sin `.select()` no hay forma de distinguir "insertó" de "chocó", así que
      // se pide la fila: si vuelve vacía, el evento ya estaba.
      .select("id")
      .maybeSingle();

    if (error) {
      // 23505 = unique_violation: el evento ya se procesó. Es el camino normal
      // de un reintento, no un problema.
      if (error.code === "23505") return false;
      console.error("[billing/events] no se pudo registrar el evento:", error);
      return true;
    }

    return data !== null;
  } catch (e) {
    console.error("[billing/events] error inesperado registrando el evento:", e);
    return true;
  }
}
