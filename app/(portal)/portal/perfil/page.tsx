/**
 * `/portal/perfil` — el usuario cambia su nombre y su contraseña (etapa 9).
 *
 * Vive FUERA de `[clientId]` porque es de la persona, no de la marca: quien
 * está en dos marcas tiene un solo nombre y una sola contraseña. Por eso
 * tampoco lleva el `PortalShell` (ese se arma alrededor de una marca) y se
 * dibuja como tarjeta suelta, igual que `NameGate` y `PortalNotice`.
 *
 * El gate de `portal_profiles` corre antes en `../layout.tsx`, así que acá el
 * nombre ya existe: quien llegue sin fila ve el gate, no esta pantalla.
 *
 * No va en `PUBLIC_PATHS`: se autentica por sesión.
 */

import Link from "next/link";
import { requirePortalSession, listPortalClients } from "@/lib/portal/access";
import {
  getDisplayName,
  DISPLAY_NAME_HINT,
  DISPLAY_NAME_MIN,
  DISPLAY_NAME_MAX,
  PASSWORD_MIN,
} from "@/lib/portal/profiles";
import LogoutButton from "@/components/LogoutButton";
import ProfileForm from "@/components/portal/ProfileForm";
import s from "../portal.module.css";

export const metadata = { title: "Tu perfil — Guionizator Pro" };

export default async function PortalPerfilPage() {
  const { user } = await requirePortalSession();
  const [displayName, clients] = await Promise.all([
    getDisplayName(user.id),
    listPortalClients(user.id),
  ]);

  // A dónde vuelve: su marca si tiene una sola, el selector si tiene varias.
  const back = clients.length === 1 ? `/portal/${clients[0].id}` : "/portal";

  return (
    <main className={`blueprint ${s.profileWrap}`}>
      <div className={s.profileInner}>
        <Link href={back} className={s.profileBack}>
          ← Volver
        </Link>
        <p className="eyebrow">Tu cuenta</p>
        <h1 className={s.profileTitle}>Perfil</h1>

        <ProfileForm
          email={user.email ?? null}
          displayName={displayName ?? ""}
          hint={DISPLAY_NAME_HINT}
          minLength={DISPLAY_NAME_MIN}
          maxLength={DISPLAY_NAME_MAX}
          passwordMin={PASSWORD_MIN}
        />

        <div className={s.profileFooter}>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
