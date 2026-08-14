/**
 * `/portal` — puerta de entrada del cliente.
 *
 * Lo normal es una marca por usuario, así que redirige sin hacerle elegir nada.
 * El selector aparece solo si tiene varias (`client_members` es N:N: una agencia
 * o un socio pueden estar en dos marcas sin crear otra cuenta). Para Paco, que
 * es dueño de todas, este selector es la lista de sus marcas: entrar acá es
 * "ver el portal como lo ve mi cliente".
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  listPortalClients,
  portalClientLabel,
  requirePortalSession,
} from "@/lib/portal/access";
import { enabledPortalFeatures } from "@/lib/portal/features";
import PortalNotice from "./PortalNotice";
import s from "./portal.module.css";

export default async function PortalHomePage() {
  const { user } = await requirePortalSession();
  const clients = await listPortalClients(user.id);

  if (clients.length === 0) {
    return (
      <PortalNotice eyebrow="Acceso" title="Todavía no tienes una marca asignada">
        <p>
          Tu cuenta{user.email ? ` (${user.email})` : ""} está activa, pero no
          está vinculada a ninguna marca. Si recibiste una invitación, ábrela de
          nuevo desde el link que te enviaron; si no, pídesela a quien maneja tu
          contenido.
        </p>
      </PortalNotice>
    );
  }

  if (clients.length === 1) redirect(`/portal/${clients[0].id}`);

  return (
    <main className={`blueprint ${s.pickerWrap}`}>
      <div className={s.picker}>
        <p className="eyebrow">Tus marcas</p>
        <h1 className={s.pickerTitle}>¿Con cuál trabajamos hoy?</h1>
        <div className={s.pickerList}>
          {clients.map((c) => {
            const features = enabledPortalFeatures(c.features);
            return (
              <Link key={c.id} href={`/portal/${c.id}`} className={s.pickerCard}>
                <span className={s.pickerName}>{portalClientLabel(c)}</span>
                <span className={s.pickerMeta}>
                  {features.length === 0
                    ? "Sin secciones habilitadas"
                    : features.map((f) => f.label).join(" · ")}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
