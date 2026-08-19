/**
 * `/invitacion/[token]` — pantalla pública para aceptar una invitación al
 * portal de cliente (Fase D, etapa 3).
 *
 * ⚠️ `/invitacion` está en `PUBLIC_PATHS` (`lib/supabase/middleware.ts`): el
 * invitado llega sin sesión y sin cuenta. La autorización no la da el
 * middleware sino el token — su sha256 tiene que existir en `client_invites`,
 * sin vencer y sin aceptar — y aceptar exige además estar logueado con el email
 * invitado.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getInvitePreview, type InvitePreview } from "@/lib/portal/invites";
import { getDisplayName, DISPLAY_NAME_HINT, DISPLAY_NAME_MAX } from "@/lib/portal/profiles";
import AcceptInvite from "./AcceptInvite";
import s from "../invitacion.module.css";

export const metadata = {
  title: "Invitación — Guionizator Pro",
};

type Props = { params: Promise<{ token: string }> };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className={`${s.wrap} blueprint`}>
      <div className={`card ${s.card}`}>
        <div className={s.brand}>
          <span className={s.mark} />
          <span className={s.name}>
            Guionizator <span className="text-grad">Pro</span>
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}

function Invalid({ title, text }: { title: string; text: string }) {
  return (
    <Shell>
      <h1 className={s.heading}>{title}</h1>
      <p className={s.sub}>{text}</p>
      <Link href="/login" className="btn btn-secondary" style={{ width: "100%" }}>
        Ir al inicio
      </Link>
    </Shell>
  );
}

export default async function InvitacionPage({ params }: Props) {
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Un token inválido y un error de servidor se ven distinto a propósito: el
  // primero es lo normal (link viejo o mal copiado), el segundo hay que
  // reportarlo.
  let preview: InvitePreview | null = null;
  try {
    preview = await getInvitePreview(token);
  } catch (e) {
    console.error("[invitacion] no se pudo validar el token:", e);
    return (
      <Invalid
        title="No pudimos validar tu invitación"
        text="Hubo un problema del lado del servidor. Vuelve a intentar en un rato o pídele a quien te invitó que te reenvíe el link."
      />
    );
  }

  if (!preview) {
    return (
      <Invalid
        title="Esta invitación no existe"
        text="El link puede estar incompleto, haber sido cancelado o reemplazado por uno nuevo. Pídele a quien te invitó que te mande el actual."
      />
    );
  }

  if (preview.status === "aceptada") {
    return (
      <Invalid
        title="Esta invitación ya fue aceptada"
        text="Tu acceso ya está activo: entra con tu cuenta desde el inicio."
      />
    );
  }

  if (preview.status === "vencida") {
    return (
      <Invalid
        title="Esta invitación venció"
        text="Los links duran 7 días. Pídele a quien te invitó que te genere uno nuevo — le toma un clic."
      />
    );
  }

  // ¿Hay que pedirle el nombre acá? (etapa 8) Quien todavía no tiene cuenta,
  // siempre. Quien ya la tiene, solo si nunca eligió uno. Si se saltea igual
  // este paso, el gate de `/portal` lo vuelve a pedir antes de dejarlo entrar.
  const needsName = user ? (await getDisplayName(user.id)) === null : true;

  return (
    <Shell>
      <AcceptInvite
        token={token}
        clientName={preview.clientName}
        invitedEmail={preview.email}
        role={preview.role}
        sessionEmail={user?.email ?? null}
        needsName={needsName}
        nameHint={DISPLAY_NAME_HINT}
        nameMaxLength={DISPLAY_NAME_MAX}
      />
    </Shell>
  );
}
