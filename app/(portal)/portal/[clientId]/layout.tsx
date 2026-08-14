/**
 * Layout de una marca dentro del portal.
 *
 * **Candado 1 de los dos** (`docs/fase-d-portal-cliente.md`): valida que el
 * usuario tenga acceso a esta marca antes de dibujar nada. Si no lo tiene, 404
 * — no 403, para no confirmarle a nadie que la marca existe.
 *
 * El candado 2 lo pone cada página, revalidando su propio flag antes de
 * consultar. Los dos son UX + defensa en profundidad: lo que impide leer datos
 * ajenos es la RLS.
 */

import {
  listPortalClients,
  portalClientLabel,
  requirePortalClient,
  requirePortalSession,
} from "@/lib/portal/access";
import PortalShell from "../PortalShell";

export default async function PortalClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { user } = await requirePortalSession();

  const client = await requirePortalClient(user.id, clientId);
  const all = await listPortalClients(user.id);

  return (
    <PortalShell
      client={{
        id: client.id,
        label: portalClientLabel(client),
        features: client.features,
      }}
      otherClients={all
        .filter((c) => c.id !== client.id)
        .map((c) => ({ id: c.id, label: portalClientLabel(c) }))}
      email={user.email}
      isOwnerPreview={client.role === "owner"}
    >
      {children}
    </PortalShell>
  );
}
