/**
 * `/portal/[clientId]` — no tiene pantalla propia: manda a la primera sección
 * habilitada que ya esté construida.
 *
 * Si la marca no tiene ninguna, el cliente ve un cartel en vez de una pantalla
 * vacía. Pasa en dos casos reales: Paco todavía no prendió nada, o prendió solo
 * secciones de las etapas 5 y 6 (`live: false`).
 */

import { redirect } from "next/navigation";
import { requirePortalClient, requirePortalSession } from "@/lib/portal/access";
import { enabledPortalFeatures, firstLivePortalFeature } from "@/lib/portal/features";

export default async function PortalClientHome({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { user } = await requirePortalSession();
  const client = await requirePortalClient(user.id, clientId);

  const first = firstLivePortalFeature(client.features);
  if (first?.path) redirect(`/portal/${client.id}/${first.path}`);

  const pending = enabledPortalFeatures(client.features);

  return (
    <div style={{ maxWidth: "60ch" }}>
      <span className="eyebrow">Tu marca</span>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          margin: "6px 0 10px",
        }}
      >
        {pending.length === 0 ? "Todavía no hay nada por aquí" : "Ya casi"}
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}>
        {pending.length === 0
          ? "Tu acceso está activo, pero todavía no se habilitó ninguna sección para tu marca. En cuanto haya algo para mostrarte, aparece en el menú de la izquierda."
          : "Las secciones de tu marca están en camino. Apenas estén listas las vas a ver en el menú de la izquierda, sin tener que hacer nada."}
      </p>
    </div>
  );
}
