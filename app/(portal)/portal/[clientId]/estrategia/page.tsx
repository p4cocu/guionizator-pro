/**
 * `/portal/[clientId]/estrategia` — "Tu estrategia" (migración `0019`).
 *
 * Sin estrategia: el test. Con estrategia: el resultado en lenguaje de
 * cliente (nada de "Freshman" ni "pilar de Andrea") y, para quien puede
 * editar, "Volver a hacer el test".
 *
 * Candado 2: revalida el flag `estrategia`. La lectura va con service role
 * (la tabla es owner-only) filtrando `client_id` — ver `lib/portal/strategy.ts`.
 */

import { requirePortalClient, requirePortalSession, portalClientLabel } from "@/lib/portal/access";
import { loadPortalStrategy } from "@/lib/portal/strategy";
import EstrategiaPortalClient from "./EstrategiaPortalClient";

export default async function PortalEstrategiaPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { user } = await requirePortalSession();
  const client = await requirePortalClient(user.id, clientId, "estrategia");
  const strategy = await loadPortalStrategy(client.id);

  return (
    <EstrategiaPortalClient
      clientId={client.id}
      brandLabel={portalClientLabel(client)}
      initial={strategy}
      canEdit={client.role !== "viewer"}
    />
  );
}
