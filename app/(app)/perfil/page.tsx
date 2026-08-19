/**
 * `/perfil` — la misma pantalla que `/portal/perfil`, dentro del estudio
 * (etapa 9).
 *
 * Existe porque Paco también tiene fila en `portal_profiles` desde la etapa 8:
 * ese nombre es el que firma sus comentarios del lado del cliente, y cambiarlo
 * (o cambiar la contraseña) no debería obligarlo a entrar por "ver como
 * cliente".
 *
 * Reusa `ProfileForm` y sus server actions tal cual: es la misma cuenta de Auth
 * y la misma fila. Acá sí va dentro del shell interno, así que solo aporta el
 * encabezado.
 */

import { requirePortalSession } from "@/lib/portal/access";
import {
  getDisplayName,
  DISPLAY_NAME_HINT,
  DISPLAY_NAME_MIN,
  DISPLAY_NAME_MAX,
  PASSWORD_MIN,
} from "@/lib/portal/profiles";
import ProfileForm from "@/components/portal/ProfileForm";

export const metadata = { title: "Tu perfil — Guionizator Pro" };

export default async function PerfilPage() {
  const { user } = await requirePortalSession();
  const displayName = await getDisplayName(user.id);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <p className="eyebrow">Tu cuenta</p>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            margin: "6px 0 8px",
          }}
        >
          Perfil
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 620, lineHeight: 1.55 }}>
          Tu nombre es el que ve el cliente cuando respondes un comentario en el
          portal. Si todavía no elegiste uno, tus mensajes salen firmados como
          &ldquo;Equipo de contenido&rdquo;.
        </p>
      </div>

      <ProfileForm
        email={user.email ?? null}
        displayName={displayName ?? ""}
        hint={DISPLAY_NAME_HINT}
        minLength={DISPLAY_NAME_MIN}
        maxLength={DISPLAY_NAME_MAX}
        passwordMin={PASSWORD_MIN}
      />
    </div>
  );
}
