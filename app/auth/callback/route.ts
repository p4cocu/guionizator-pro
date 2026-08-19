import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  RECOVERY_COOKIE,
  RECOVERY_COOKIE_MAX_AGE,
  RECOVERY_PATH,
} from "@/lib/auth/recovery";

/**
 * Maneja el enlace de confirmación de correo / magic link / recuperación.
 * Supabase redirige aquí con un ?code que intercambiamos por sesión.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Sin `next` explícito se manda a `/`, que decide estudio o portal según el
  // rol. El link de invitación y el de recuperación traen el suyo.
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);

      // Recuperación de contraseña (etapa 9): esta cookie es lo único que
      // habilita `/nueva-contrasena`, donde se cambia la contraseña SIN saber
      // la anterior. Se pone solo acá, después de canjear un código válido de
      // Supabase — si la pusiera cualquiera, alguien con una sesión abierta
      // ajena se quedaría con la cuenta.
      if (next === RECOVERY_PATH) {
        response.cookies.set(RECOVERY_COOKIE, "1", {
          httpOnly: true,
          sameSite: "lax",
          secure: !origin.startsWith("http://localhost"),
          path: "/",
          maxAge: RECOVERY_COOKIE_MAX_AGE,
        });
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
