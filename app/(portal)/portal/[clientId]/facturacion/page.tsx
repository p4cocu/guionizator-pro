/**
 * `/portal/[clientId]/facturacion` — lo que ve quien paga (Fase E).
 *
 * ## Dos cosas que la separan del resto del portal
 *
 * 1. **No es una sección configurable.** No tiene slug en
 *    `lib/portal/features.ts` a propósito: agregarlo obligaría a tocar el
 *    `clients_enabled_features_check` y no aporta nada — no es algo que Paco
 *    quiera prender o apagar por marca. Se muestra siempre, y solo a quien paga.
 *
 * 2. **Se salta el candado de cobro.** Es la única pantalla del portal que lo
 *    hace. Si el impago también cerrara esta, un cliente suspendido no tendría
 *    desde dónde actualizar su tarjeta: quedaría encerrado afuera con la única
 *    salida de escribirle a Paco.
 *
 * Quién entra: el **contacto de facturación** (quien pagó) o el dueño mirando
 * como cliente. Cualquier otro miembro recibe 404 — mismo criterio que el resto
 * del portal, no confirmamos que la pantalla exista.
 *
 * No va en `PUBLIC_PATHS`: se autentica por sesión.
 */

import { notFound } from "next/navigation";
import {
  portalClientLabel,
  requirePortalClient,
  requirePortalSession,
} from "@/lib/portal/access";
import { getBillingState } from "@/lib/billing/access";
import { getClientOwnerId } from "@/lib/portal/generate";
import { getAiUsageState } from "@/lib/portal/usage";
import { getTranscriptionUsageState } from "@/lib/competencia/transcriptionUsage";
import { listCreditPurchases } from "@/lib/billing/credits";
import { createServiceClient } from "@/lib/supabase/service";
import {
  effectiveLimit,
  PLAN_AI_CREDITS,
  PLAN_TRANSCRIPTIONS,
} from "@/lib/billing/plan";
import { isStripeConfigured } from "@/lib/billing/stripe";
import BillingClient from "./BillingClient";

export const metadata = { title: "Facturación — Guionizator Pro" };

type Props = {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ recarga?: string }>;
};

export default async function FacturacionPage({ params, searchParams }: Props) {
  const { clientId } = await params;
  const { recarga } = await searchParams;
  const { user } = await requirePortalSession();

  // ⚠️ `skipBillingGate`: ver el comentario de arriba.
  const client = await requirePortalClient(user.id, clientId, undefined, {
    skipBillingGate: true,
  });

  const billing = await getBillingState(clientId);
  const esDueño = client.role === "owner";
  const esContacto = billing.subscription?.billingContactUserId === user.id;
  if (!esDueño && !esContacto) notFound();

  const ownerId = await getClientOwnerId(clientId);
  const admin = createServiceClient();
  const exenta = billing.reason === "exempt";

  // Los dos medidores se leen con service role: el miembro no tiene select
  // sobre `ai_usage_log` ni sobre `transcription_usage_log`.
  const [aiUsage, transcriptionUsage, purchases] = await Promise.all([
    getAiUsageState(
      admin,
      clientId,
      ownerId,
      effectiveLimit(client.aiGenerationLimit, exenta, PLAN_AI_CREDITS),
      {
        cycleStart: billing.cycleStart,
        cycleEnd: billing.cycleEnd,
        creditBalance: billing.subscription?.creditBalance ?? 0,
      },
    ).catch((e) => {
      console.error("[portal/facturacion] no se pudo leer el consumo de IA:", e);
      return null;
    }),
    getTranscriptionUsageState(
      admin,
      clientId,
      ownerId,
      effectiveLimit(client.transcriptionLimit, exenta, PLAN_TRANSCRIPTIONS),
      { cycleStart: billing.cycleStart, cycleEnd: billing.cycleEnd },
    ).catch((e) => {
      console.error("[portal/facturacion] no se pudo leer el consumo de transcripción:", e);
      return null;
    }),
    listCreditPurchases(clientId, ownerId).catch((e) => {
      console.error("[portal/facturacion] no se pudieron leer las recargas:", e);
      return [];
    }),
  ]);

  return (
    <BillingClient
      clientId={clientId}
      clientLabel={portalClientLabel(client)}
      reason={billing.reason}
      cycleStart={billing.cycleStart}
      cycleEnd={billing.cycleEnd}
      graceUntil={billing.graceUntil}
      cancelAtPeriodEnd={billing.subscription?.cancelAtPeriodEnd ?? false}
      creditBalance={billing.subscription?.creditBalance ?? 0}
      hasStripeCustomer={Boolean(billing.subscription?.stripeCustomerId)}
      stripeConfigured={isStripeConfigured()}
      aiUsed={aiUsage?.used ?? 0}
      aiLimit={aiUsage?.limit ?? null}
      transcriptionUsed={transcriptionUsage?.used ?? 0}
      transcriptionLimit={transcriptionUsage?.limit ?? null}
      purchases={purchases}
      flash={recarga === "ok" ? "ok" : recarga === "cancelada" ? "cancelada" : null}
    />
  );
}
