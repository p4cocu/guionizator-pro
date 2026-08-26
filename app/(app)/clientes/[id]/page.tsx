import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  EMPTY_APIFY_TOKEN_STATE,
  getApifyTokenState,
  type ApifyTokenState,
} from "@/lib/competencia/apifyToken";
import { listClientMembers, type PortalMember } from "@/lib/portal/members";
import { getDisplayName } from "@/lib/portal/profiles";
import { listPendingInvites, type ClientInvite } from "@/lib/portal/invites";
import { emptyAiUsage, getCycleAiUsage, type AiUsageSummary } from "@/lib/portal/usage";
import {
  emptyTranscriptionUsage,
  getCycleTranscriptionUsage,
  type TranscriptionUsageSummary,
} from "@/lib/competencia/transcriptionUsage";
import { getBillingState, type BillingState } from "@/lib/billing/access";
import { listCreditPurchases, type CreditPurchase } from "@/lib/billing/credits";
import { isStripeConfigured, isTestMode } from "@/lib/billing/stripe";
import BillingSection from "./BillingSection";
import ClienteForm from "../ClienteForm";
import PortalSection from "./PortalSection";
import ResearchSection from "./ResearchSection";
import ProductsSection from "./ProductsSection";
import InstagramSection from "./InstagramSection";
import ApifySection from "./ApifySection";
import DeleteClienteButton from "./DeleteClienteButton";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("nombre")
    .eq("id", id)
    .single();
  return { title: data ? `${data.nombre} — Guionizator Pro` : "Cliente" };
}

export default async function ClienteDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // El estado del token de Apify ya no sale de `clients`: vive en
  // `client_secrets`, que solo se lee con service role (migración 0006). Si la
  // key no está configurada, mostramos la sección vacía en vez de tumbar todo
  // el perfil del cliente.
  const apifyState: Promise<ApifyTokenState> = getApifyTokenState(id, user.id).catch((e) => {
    console.error("[clientes/[id]] no se pudo leer el estado del token de Apify:", e);
    return EMPTY_APIFY_TOKEN_STATE;
  });

  // Igual que Apify: ni la lista de miembros ni el consumo de IA valen tumbar el
  // perfil. Los emails salen de `auth.users` vía service role y el conteo de
  // `ai_usage_log`; si algo de eso falla, el panel se dibuja vacío y el motivo
  // queda en el log del servidor.
  const membersPromise: Promise<PortalMember[]> = listClientMembers(supabase, id, user.id).catch(
    (e) => {
      console.error("[clientes/[id]] no se pudieron leer los miembros del portal:", e);
      return [];
    },
  );

  // El estado de cobro decide qué periodo se cuenta: desde Fase E los dos
  // medidores cortan por CICLO DE FACTURACIÓN, no por mes calendario. Si la
  // marca no tiene suscripción de Stripe (exenta, o todavía sin pagar),
  // `cycleStart` viene `null` y los contadores caen al mes UTC de siempre.
  const billing: BillingState = await getBillingState(id);

  const usagePromise: Promise<AiUsageSummary> = getCycleAiUsage(
    supabase,
    id,
    user.id,
    billing.cycleStart,
    billing.cycleEnd,
  ).catch((e) => {
    console.error("[clientes/[id]] no se pudo leer el consumo de IA:", e);
    return emptyAiUsage();
  });

  const purchasesPromise: Promise<CreditPurchase[]> = listCreditPurchases(id, user.id).catch(
    (e) => {
      console.error("[clientes/[id]] no se pudieron leer las recargas:", e);
      return [];
    },
  );

  // El nombre propio en el portal es global (una fila por usuario), pero se
  // edita desde acá porque es donde se ve el efecto. `getDisplayName` ya
  // devuelve `null` en vez de lanzar si falla.
  const ownNamePromise: Promise<string | null> = getDisplayName(user.id);

  const invitesPromise: Promise<ClientInvite[]> = listPendingInvites(supabase, id).catch((e) => {
    console.error("[clientes/[id]] no se pudieron leer las invitaciones:", e);
    return [];
  });

  const transcriptionUsagePromise: Promise<TranscriptionUsageSummary> = getCycleTranscriptionUsage(
    supabase,
    id,
    user.id,
    billing.cycleStart,
    billing.cycleEnd,
  ).catch((e) => {
    console.error("[clientes/[id]] no se pudo leer el consumo de transcripción:", e);
    return emptyTranscriptionUsage();
  });

  const [
    { data: cliente },
    { data: research },
    { data: products },
    { data: igAccount },
    apify,
    members,
    aiUsage,
    invites,
    transcriptionUsage,
    ownPortalName,
    creditPurchases,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single(),
    supabase
      .from("client_research")
      .select("id, fuente, resumen, created_at")
      .eq("client_id", id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_products")
      .select("id, nombre, descripcion, tipo, created_at")
      .eq("client_id", id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("instagram_accounts")
      .select(
        "id, ig_user_id, username, token_expires_at, created_at, last_refresh_attempt_at, last_refresh_error",
      )
      .eq("client_id", id)
      .eq("owner_id", user.id)
      .maybeSingle(),
    apifyState,
    membersPromise,
    usagePromise,
    invitesPromise,
    transcriptionUsagePromise,
    ownNamePromise,
    purchasesPromise,
  ]);

  if (!cliente) notFound();

  return (
    <div>
      <ClienteForm
        clienteId={id}
        initial={{
          nombre: cliente.nombre ?? "",
          marca: cliente.marca ?? "",
          que_vende: cliente.que_vende ?? "",
          cliente_ideal: cliente.cliente_ideal ?? "",
          nicho: cliente.nicho ?? "",
          dolor: cliente.dolor ?? "",
          deseo: cliente.deseo ?? "",
          tono: cliente.tono ?? "",
          notas: cliente.notas ?? "",
        }}
      />
      <div style={{ maxWidth: 760 }}>
        <ProductsSection clientId={id} products={products ?? []} />
        {/* Configuración de qué ve el cliente en /portal (Fase D). */}
        <PortalSection
          clientId={id}
          initialFeatures={(cliente.enabled_features as string[] | null) ?? []}
          initialLimit={(cliente.ai_generation_limit as number | null) ?? null}
          initialMode={(cliente.ai_generation_mode as string | null) ?? "simple"}
          initialTranscriptionLimit={(cliente.transcription_limit as number | null) ?? null}
          transcriptionUsage={transcriptionUsage}
          usage={aiUsage}
          initialMembers={members}
          initialInvites={invites}
          initialOwnName={ownPortalName}
        />
        {/* Cobro con Stripe (Fase E). Va después del panel del portal porque
            decide si ese portal se puede usar. */}
        <BillingSection
          clientId={id}
          state={{
            reason: billing.reason,
            ok: billing.ok,
            exempt: billing.subscription?.exempt ?? false,
            status: billing.subscription?.status ?? null,
            cycleStart: billing.cycleStart,
            cycleEnd: billing.cycleEnd,
            graceUntil: billing.graceUntil,
            cancelAtPeriodEnd: billing.subscription?.cancelAtPeriodEnd ?? false,
            creditBalance: billing.subscription?.creditBalance ?? 0,
            stripeCustomerId: billing.subscription?.stripeCustomerId ?? null,
            billingContactUserId: billing.subscription?.billingContactUserId ?? null,
          }}
          members={members}
          purchases={creditPurchases}
          stripeConfigured={isStripeConfigured()}
          testMode={isTestMode()}
        />
        {/* Solo el estado enmascarado: `apify_token_cipher` NUNCA cruza al cliente. */}
        <ApifySection clientId={id} initial={apify} />
        <InstagramSection clientId={id} account={igAccount ?? null} />
        <ResearchSection clientId={id} entries={research ?? []} />
        <DeleteClienteButton clienteId={id} />
      </div>
    </div>
  );
}
