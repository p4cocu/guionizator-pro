/**
 * `/nueva-contrasena` — a donde cae el link de recuperación (etapa 9).
 *
 * Vive en la raíz de `app/`, fuera de `(app)` y de `(portal)`: la usan las dos
 * clases de usuario, y el layout de `(app)` manda a `/portal` a quien no sea
 * dueño de ninguna marca.
 *
 * **No** va en `PUBLIC_PATHS`: cuando el usuario llega acá ya tiene sesión (la
 * creó `/auth/callback` al canjear el código del link). Lo que autoriza a
 * cambiar la contraseña sin saber la anterior no es la sesión sino la cookie
 * de recuperación que pone ese mismo callback — ver `actions.ts`.
 */

import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PASSWORD_MIN } from "@/lib/portal/profiles";
import { RECOVERY_COOKIE } from "@/lib/auth/recovery";
import NuevaContrasenaForm from "./NuevaContrasenaForm";
import s from "./nueva.module.css";

export const metadata = { title: "Contraseña nueva — Guionizator Pro" };

export default async function NuevaContrasenaPage() {
  const jar = await cookies();
  const allowed = jar.get(RECOVERY_COOKIE)?.value === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className={`blueprint ${s.wrap}`}>
      <div className={`card ${s.card}`}>
        <p className="eyebrow">Acceso</p>
        <h1 className={s.title}>
          {allowed ? "Elige tu contraseña nueva" : "Este link ya no sirve"}
        </h1>

        {allowed ? (
          <>
            <p className={s.text}>
              Escríbela dos veces y entras directo. La anterior deja de
              funcionar en el momento.
            </p>
            <NuevaContrasenaForm email={user?.email ?? null} passwordMin={PASSWORD_MIN} />
          </>
        ) : (
          <>
            <p className={s.text}>
              Los links para cambiar la contraseña sirven una sola vez y por un
              rato. Pide uno nuevo desde{" "}
              <strong>&ldquo;¿Olvidaste tu contraseña?&rdquo;</strong> en la
              pantalla de entrada, o pídeselo a quien maneja tu contenido.
            </p>
            <p style={{ marginTop: 20 }}>
              <Link href="/login" className="btn btn-secondary">
                Ir a la pantalla de entrada
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
