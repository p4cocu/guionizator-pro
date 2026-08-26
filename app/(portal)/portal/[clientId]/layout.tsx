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
import { billingMessage, getBillingState } from "@/lib/billing/access";
import { getSubscription } from "@/lib/billing/subscription";
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

  // ⚠️ El layout NO aplica el candado de cobro: lo aplica cada página con su
  // propio `requirePortalClient`. Si cortara acá, también cerraría
  // `/facturacion`, que es justo la pantalla desde la que un cliente
  // suspendido tiene que poder actualizar su tarjeta.
  const client = await requirePortalClient(user.id, clientId, undefined, {
    skipBillingGate: true,
  });
  const all = await listPortalClients(user.id);

  // Facturación la ve solo quien pagó (o Paco mirando como cliente): desde ahí
  // se compran recargas y se cancela la suscripción de toda la marca.
  const [billing, subscription] = await Promise.all([
    getBillingState(clientId),
    getSubscription(clientId),
  ]);
  const showBilling =
    client.role === "owner" || subscription?.billingContactUserId === user.id;

  return (
    <PortalShell
      client={{
        id: client.id,
        label: portalClientLabel(client),
        features: client.features,
        role: client.role,
      }}
      otherClients={all
        .filter((c) => c.id !== client.id)
        .map((c) => ({ id: c.id, label: portalClientLabel(c) }))}
      email={user.email}
      isOwnerPreview={client.role === "owner"}
      showBilling={showBilling}
      billingWarning={billing.warning ? billingMessage(billing) : null}
    >
      {children}
    </PortalShell>
  );
}
