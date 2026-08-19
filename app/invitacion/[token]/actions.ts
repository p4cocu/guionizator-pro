"use server";

/**
 * Aceptar una invitación al portal (Fase D, etapa 3).
 *
 * Ruta pública (`/invitacion` está en `PUBLIC_PATHS`), pero **aceptar exige
 * sesión**: el usuario tiene que estar logueado con exactamente el email al que
 * se invitó. Esa comparación la hace `acceptInvite`, que además valida el hash
 * del token y el vencimiento.
 *
 * ⚠️ No reexportar tipos desde este archivo (regla dura de CLAUDE.md).
 */

import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "@/lib/portal/invites";
import { setOwnDisplayName, DisplayNameError } from "@/lib/portal/profiles";

export type AcceptInviteResult =
  | { ok: true; clientName: string }
  | { ok: false; error: string };

/**
 * `displayName` (etapa 8) es el nombre con el que la persona va a aparecer en
 * los comentarios. Se guarda **antes** de aceptar: si el nombre no valida, no
 * queremos una membresía creada a medias y un usuario sin nombre. Va con
 * `user.id` de la sesión, nunca con un id del formulario.
 *
 * Es opcional en la firma porque quien ya tenía nombre no lo manda; el gate de
 * `/portal` cubre igual a quien llegue sin él.
 */
export async function acceptInviteAction(
  token: string,
  displayName?: string,
): Promise<AcceptInviteResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "Entra con tu cuenta para aceptar la invitación." };
    }

    if (displayName?.trim()) {
      await setOwnDisplayName(user.id, displayName);
    }

    const result = await acceptInvite(token, { id: user.id, email: user.email });
    return { ok: true, clientName: result.clientName };
  } catch (e) {
    if (e instanceof DisplayNameError) return { ok: false, error: e.message };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo aceptar la invitación.",
    };
  }
}
