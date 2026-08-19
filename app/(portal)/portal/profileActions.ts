"use server";

/**
 * Nombre y contraseña propios (Fase D, etapas 8 y 9).
 *
 * ⚠️ NO reexportar tipos desde este archivo (regla de `CLAUDE.md`): en un módulo
 * `"use server"` un `export type` sobrevive al bundle como una referencia que en
 * runtime no existe.
 *
 * El `userId` sale SIEMPRE de la sesión, nunca del formulario: si viniera del
 * cliente, cualquiera podría renombrar a cualquiera. La escritura en sí va con
 * service role (`lib/portal/profiles.ts`), porque `portal_profiles` no tiene
 * policies para nadie.
 *
 * Estas actions las consumen las DOS pantallas de perfil (`/portal/perfil` y
 * `/perfil` del estudio) a través de `components/portal/ProfileForm.tsx`. Viven
 * acá y no en `lib/` porque son server actions, no helpers: `lib/portal/*` se
 * importa desde server components y desde otras actions, y un `"use server"` en
 * el medio obligaría a que todo export de esos módulos fuera async.
 */

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requirePortalSession } from "@/lib/portal/access";
import {
  setOwnDisplayName,
  DisplayNameError,
  PASSWORD_MIN,
} from "@/lib/portal/profiles";

export type SaveNameResult = { ok: true; name: string } | { ok: false; error: string };
export type PasswordResult = { ok: true } | { ok: false; error: string };

export async function saveOwnDisplayName(name: string): Promise<SaveNameResult> {
  try {
    const { user } = await requirePortalSession();
    const saved = await setOwnDisplayName(user.id, name);
    revalidatePath("/portal", "layout");
    revalidatePath("/perfil");
    return { ok: true, name: saved };
  } catch (e) {
    if (e instanceof DisplayNameError) return { ok: false, error: e.message };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar tu nombre.",
    };
  }
}

/**
 * Cambio de contraseña. Va con el **cliente de sesión** (`auth.updateUser`), no
 * con service role: es una operación de Auth sobre uno mismo, y la sesión ya
 * dice quién es.
 *
 * Se pide la contraseña actual y se valida antes de tocar nada. Supabase no lo
 * exige (`secure_password_change` está apagado), pero sin eso cualquiera que
 * agarre una sesión abierta —una laptop prestada— se queda con la cuenta.
 *
 * ⚠️ La validación usa un cliente anon **efímero** (`persistSession: false`) a
 * propósito: `signInWithPassword` sobre el cliente de sesión reescribiría las
 * cookies de la request, y un intento fallido podría dejar al usuario sin
 * sesión por haberse equivocado al tipear.
 */
export async function updateOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<PasswordResult> {
  try {
    const { supabase, user } = await requirePortalSession();

    if (!user.email) {
      return {
        ok: false,
        error: "Tu cuenta no tiene email, así que la contraseña se cambia desde el soporte.",
      };
    }
    if (newPassword.length < PASSWORD_MIN) {
      return { ok: false, error: `La contraseña nueva necesita al menos ${PASSWORD_MIN} caracteres.` };
    }
    if (newPassword === currentPassword) {
      return { ok: false, error: "La contraseña nueva tiene que ser distinta de la actual." };
    }

    const checker = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: signInError } = await checker.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) {
      return { ok: false, error: "La contraseña actual no es correcta." };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo cambiar la contraseña.",
    };
  }
}
