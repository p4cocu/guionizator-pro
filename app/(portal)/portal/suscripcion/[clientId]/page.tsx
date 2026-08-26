/**
 * `/portal/suscripcion/[clientId]` — la pantalla de pago (Fase E).
 *
 * Es a donde manda `requirePortalClient` cuando la marca no está pagada. Se
 * llega acá por tres caminos distintos y los tres se ven parecido:
 *
 *  1. Alguien acaba de aceptar una invitación a una marca que nunca pagó.
 *  2. Falló el cobro y ya venció el periodo de gracia.
 *  3. La suscripción está cancelada.
 *
 * Vive **fuera de `[clientId]`** a propósito, igual que `/portal/perfil`: el
 * `PortalShell` se arma con las secciones de una marca a la que —justamente—
 * todavía no se puede entrar. Se dibuja como tarjeta suelta.
 *
 * ## Por qué esto resuelve "solo el primero paga"
 *
 * No hay ninguna lógica de "¿es el primer miembro?". Hay una pregunta sola:
 * ¿esta marca está pagada? Si lo está, `requirePortalClient` nunca redirige acá
 * y el segundo, tercero y quinto miembro entran directo y gratis. Si no lo
 * está, el que llegue puede pagar — y queda como contacto de facturación.
 *
 * No va en `PUBLIC_PATHS`: se autentica por sesión.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPortalClient,
  portalClientLabel,
  requirePortalSession,
} from "@/lib/portal/access";
import { billingMessage, getBillingState } from "@/lib/billing/access";
import { isStripeConfigured } from "@/lib/billing/stripe";
import {
  formatMxn,
  PLAN_AI_CREDITS,
  PLAN_PRICE_MXN,
  PLAN_TRANSCRIPTIONS,
} from "@/lib/billing/plan";
import { enabledPortalFeatures } from "@/lib/portal/features";
import LogoutButton from "@/components/LogoutButton";
import SubscribeButton from "./SubscribeButton";
import s from "../../portal.module.css";

export const metadata = { title: "Suscripción — Guionizator Pro" };

type Props = { params: Promise<{ clientId: string }> };

export default async function SuscripcionPage({ params }: Props) {
  const { clientId } = await params;
  const { user } = await requirePortalSession();

  // Mismo criterio que el resto del portal: 404 y no 403 — no le confirmamos a
  // nadie que esta marca existe.
  const client = await getPortalClient(user.id, clientId);
  if (!client) notFound();

  const billing = await getBillingState(clientId);

  // Si ya está paga, esta pantalla no tiene nada que hacer: se vuelve al portal.
  const yaEstaBien = billing.ok && billing.reason !== "grace";

  // ⚠️ Si la marca YA tiene suscripción en Stripe y lo que falló es el cobro, un
  // Checkout nuevo crearía una SEGUNDA suscripción para el mismo customer —
  // doble cobro. Ahí lo que corresponde es el Customer Portal, para actualizar
  // la tarjeta de la que ya existe. Checkout solo cuando no hay ninguna viva
  // (`none`) o cuando la anterior está cancelada.
  const necesitaActualizarTarjeta =
    Boolean(billing.subscription?.stripeSubscriptionId) &&
    (billing.reason === "unpaid" || billing.reason === "grace");

  // Pero el Customer Portal solo lo puede abrir quien pagó: si lo mira otro
  // miembro, el botón fallaría con 403. Mejor decirle a quién avisarle.
  const puedeGestionar =
    client.role === "owner" || billing.subscription?.billingContactUserId === user.id;

  const secciones = enabledPortalFeatures(client.features).filter((f) => f.live);

  return (
    <main className={`blueprint ${s.profileWrap}`}>
      <div className={s.profileInner}>
        <p className="eyebrow">{portalClientLabel(client)}</p>
        <h1 className={s.profileTitle}>
          {yaEstaBien ? "Todo en orden" : "Activa tu acceso"}
        </h1>

        {yaEstaBien ? (
          <>
            <p className={s.profileHint}>
              Esta marca ya tiene su suscripción activa.
            </p>
            <Link href={`/portal/${clientId}`} className="btn btn-primary">
              Entrar al portal
            </Link>
          </>
        ) : (
          <>
            <p className={s.profileHint}>{billingMessage(billing)}</p>

            <div className="card" style={{ padding: 24, marginTop: 20 }}>
              <p className="eyebrow">Plan</p>
              <p style={{ fontSize: 28, fontWeight: 700, margin: "6px 0 4px" }}>
                {formatMxn(PLAN_PRICE_MXN)}
                <span style={{ fontSize: 14, fontWeight: 400, opacity: 0.7 }}> / mes</span>
              </p>
              <ul style={{ margin: "14px 0 0", paddingLeft: 18, lineHeight: 1.8, fontSize: 14 }}>
                <li>
                  Acceso al portal
                  {secciones.length > 0
                    ? `: ${secciones.map((f) => f.label).join(", ")}`
                    : " de tu marca"}
                </li>
                <li>{PLAN_AI_CREDITS} generaciones con IA por mes</li>
                <li>{PLAN_TRANSCRIPTIONS} transcripciones por mes</li>
                <li>Todo tu equipo, sin costo extra por persona</li>
              </ul>
            </div>

            {!isStripeConfigured() ? (
              <p className={s.profileHint} style={{ marginTop: 18 }}>
                Los pagos no están disponibles en este momento. Escríbele a quien maneja tu
                contenido.
              </p>
            ) : necesitaActualizarTarjeta && !puedeGestionar ? (
              <p className={s.profileHint} style={{ marginTop: 18 }}>
                El pago de esta marca lo maneja otra persona de tu equipo. Pídele que actualice
                la tarjeta para que vuelvan a tener acceso.
              </p>
            ) : (
              <SubscribeButton
                clientId={clientId}
                mode={necesitaActualizarTarjeta ? "portal" : "checkout"}
              />
            )}

            <p className={s.profileHint} style={{ marginTop: 18, fontSize: 12 }}>
              Se cobra por marca, no por persona: una vez activa, todo tu equipo entra con su
              propio acceso. Puedes cancelar cuando quieras.
            </p>
          </>
        )}

        <div className={s.profileFooter}>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
