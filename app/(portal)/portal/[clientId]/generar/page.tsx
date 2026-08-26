/**
 * `/portal/[clientId]/generar` — el add-on de pago (Fase D, etapa 6).
 *
 * **Candado 2**: `requirePortalClient(..., "generar_ia")` revalida el flag antes
 * de dibujar nada. Apagar el switch en `/clientes/[id]` deja esta ruta en 404,
 * no solo la esconde del menú — y también para el dueño, que es lo que hace que
 * "ver como cliente" sirva para probarlo.
 *
 * El consumo se lee con **service role**: el miembro no tiene policy de select
 * sobre `ai_usage_log` (solo la hay para el dueño), así que con su sesión el
 * contador daría 0 siempre. Si esa lectura falla, la pantalla se dibuja con el
 * contador vacío en vez de caerse: el corte real lo hace igual el servidor en
 * `/api/portal/generar/guion`.
 */

import Link from "next/link";
import {
  portalClientLabel,
  requirePortalClient,
  requirePortalSession,
} from "@/lib/portal/access";
import { hasFeature } from "@/lib/portal/features";
import { getClientOwnerId, getGenerationState } from "@/lib/portal/generate";
import GenerarClient from "./GenerarClient";
import s from "./generar.module.css";

const TYPE_LABELS: Record<string, string> = { reel: "Reel", carousel: "Carrusel" };

type RecentRow = {
  id: string;
  title: string | null;
  brief: string | null;
  type: string | null;
  created_at: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function PortalGenerarPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { supabase, user } = await requirePortalSession();
  const client = await requirePortalClient(user.id, clientId, "generar_ia");

  const usage = await getClientOwnerId(client.id)
    .then((ownerId) => getGenerationState(client.id, ownerId, client.aiGenerationLimit))
    .catch((e) => {
      console.error("[portal/generar] no se pudo leer el consumo:", e);
      return null;
    });

  // Lo que este usuario generó antes. Sale de `scripts` con su propia sesión
  // (la policy `scripts_member_select` alcanza) filtrando por `generated_by`,
  // la columna que agregó la migración 0009.
  const { data: recentData } = await supabase
    .from("scripts")
    .select("id, title, brief, type, created_at")
    .eq("client_id", client.id)
    .eq("generated_by", user.id)
    .eq("is_latest", true)
    .order("created_at", { ascending: false })
    .limit(5);

  const recent = (recentData ?? []) as RecentRow[];
  const puedeVerGuiones = hasFeature(client.features, "guiones");

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <span className="eyebrow">{portalClientLabel(client)}</span>
        <h2 className={s.title}>Generar guion</h2>
        <p className={s.subtitle}>
          Cuéntale a la IA de qué quieres hablar y te arma el guion con el
          criterio y el tono de tu marca. Cuando te guste, guárdalo: queda en tus
          guiones para que se produzca.
        </p>
      </div>

      <GenerarClient
        clientId={client.id}
        mode={client.aiGenerationMode}
        canSeeScripts={puedeVerGuiones}
        initialUsage={{
          used: usage?.used ?? 0,
          // ⚠️ El tope EFECTIVO que ya resolvió `getGenerationState`, no el
          // override crudo de `clients.ai_generation_limit`. Desde Fase E ese
          // `null` significa "el tope del plan" (40), no "sin tope": pasarlo
          // tal cual hacía que la pantalla anunciara generaciones ilimitadas
          // mientras el servidor cortaba a las 40.
          limit: usage?.limit ?? null,
          remaining: usage?.remaining ?? null,
          // Sin el saldo, el cupo agotado del ciclo bloqueaba la pantalla
          // aunque el cliente tuviera recargas pagadas.
          creditBalance: usage?.creditBalance ?? 0,
          nextSource: usage?.nextSource ?? "plan",
        }}
      />

      {recent.length > 0 && (
        <section className={s.recent}>
          <h3 className={s.recentTitle}>Lo que generaste antes</h3>
          <ul className={s.recentList}>
            {recent.map((r) => {
              const label = r.title || r.brief || "Guion sin título";
              return (
                <li key={r.id} className={s.recentItem}>
                  <span className={s.recentType}>
                    {TYPE_LABELS[r.type ?? ""] ?? "Guion"}
                  </span>
                  {puedeVerGuiones ? (
                    <Link href={`/portal/${client.id}/guiones/${r.id}`} className={s.recentLink}>
                      {label}
                    </Link>
                  ) : (
                    <span className={s.recentLabel}>{label}</span>
                  )}
                  <span className={s.recentDate}>{formatDate(r.created_at)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
