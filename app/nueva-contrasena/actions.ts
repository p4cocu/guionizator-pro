"use server";

/**
 * Poner una contraseña nueva SIN saber la anterior (etapa 9).
 *
 * A diferencia de `updateOwnPassword` (pantalla de perfil), acá no se pide la
 * actual: quien llega es alguien que la olvidó y entró por un link de
 * recuperación. Lo que reemplaza a esa verificación es la **cookie de
 * recuperación** que pone `/auth/callback`, que solo se escribe después de
 * canjear un `code` válido de Supabase.
 *
 * ⚠️ Sin esa cookie esta pantalla sería un agujero: cualquiera con la sesión
 * abierta (una laptop prestada) se cambiaría la contraseña y se quedaría con
 * la cuenta, que es justo lo que evita pedir la actual en `/perfil`.
 *
 * ⚠️ NO reexportar tipos (regla de `CLAUDE.md`).
 */

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PASSWORD_MIN } from "@/lib/portal/profiles";
import { RECOVERY_COOKIE } from "@/lib/auth/recovery";

export type NewPasswordResult = { ok: true } | { ok: false; error: string };

export async function setNewPassword(password: string): Promise<NewPasswordResult> {
  try {
    const jar = await cookies();
    if (jar.get(RECOVERY_COOKIE)?.value !== "1") {
      return {
        ok: false,
        error:
          "Este link ya no está activo. Pide uno nuevo desde “¿Olvidaste tu contraseña?” en la pantalla de entrada.",
      };
    }

    if (password.length < PASSWORD_MIN) {
      return { ok: false, error: `La contraseña necesita al menos ${PASSWORD_MIN} caracteres.` };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Se venció la sesión del link. Pide uno nuevo." };

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, error: error.message };

    jar.delete(RECOVERY_COOKIE);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo cambiar la contraseña.",
    };
  }
}
