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

export type AcceptInviteResult =
  | { ok: true; clientName: string }
  | { ok: false; error: string };

export async function acceptInviteAction(token: string): Promise<AcceptInviteResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "Entra con tu cuenta para aceptar la invitación." };
    }

    const result = await acceptInvite(token, { id: user.id, email: user.email });
    return { ok: true, clientName: result.clientName };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo aceptar la invitación.",
    };
  }
}
