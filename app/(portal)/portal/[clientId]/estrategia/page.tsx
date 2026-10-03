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
import { AI_FEATURE_SLUG, hasFeature } from "@/lib/portal/features";
import { getClientOwnerId, getGenerationState } from "@/lib/portal/generate";
import { listPortalIdeas } from "@/lib/portal/weekIdeas";
import EstrategiaPortalClient from "./EstrategiaPortalClient";

// "Ideas para tu semana" corre en la función de esta página (las server
// actions viven en la función de la página que las llama): 7 piezas ~25-28 s.
export const maxDuration = 120;

export default async function PortalEstrategiaPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { user } = await requirePortalSession();
  const client = await requirePortalClient(user.id, clientId, "estrategia");
  const canGenerate = hasFeature(client.features, AI_FEATURE_SLUG) && client.role !== "viewer";
  const [strategy, savedIdeas, usage] = await Promise.all([
    loadPortalStrategy(client.id),
    listPortalIdeas(client.id),
    canGenerate
      ? getClientOwnerId(client.id)
          .then((ownerId) => getGenerationState(client.id, ownerId, client.aiGenerationLimit))
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <EstrategiaPortalClient
      clientId={client.id}
      brandLabel={portalClientLabel(client)}
      initial={strategy}
      canEdit={client.role !== "viewer"}
      week={{
        canGenerate,
        initialSaved: savedIdeas,
        // El tope EFECTIVO de `getGenerationState`, nunca el override crudo.
        initialUsage: usage
          ? {
              used: usage.used,
              limit: usage.limit,
              remaining: usage.remaining,
              creditBalance: usage.creditBalance,
              nextSource: usage.nextSource,
            }
          : null,
      }}
    />
  );
}
