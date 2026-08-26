"use client";

/**
 * Sección "Facturación" del perfil de una marca (Fase E).
 *
 * Es la vista de Paco sobre el cobro: en qué estado está la suscripción, qué
 * ciclo se está contando, cuántas recargas compró el cliente, quién paga, y el
 * switch de exención.
 *
 * Va **después** de "Portal del cliente" a propósito: los flags de allá deciden
 * qué secciones se dibujan; esto decide si ese portal se puede usar.
 *
 * Todas las llamadas van dentro de try/catch — un server action de mutación sin
 * catch deja la pantalla en "This page couldn't load" (regla dura de CLAUDE.md).
 */

import { useState, useTransition } from "react";
import { setClientBillingContact, setClientExempt } from "../billingActions";
import type { BillingReason } from "@/lib/billing/access";
import { formatMxn, PLAN_AI_CREDITS, PLAN_PRICE_MXN, PLAN_TRANSCRIPTIONS } from "@/lib/billing/plan";
import type { CreditPurchase } from "@/lib/billing/credits";
import type { PortalMember } from "@/lib/portal/members";
import { subscriptionStatusLabel } from "@/lib/billing/status";
import s from "../clientes.module.css";

type StateProps = {
  reason: BillingReason;
  ok: boolean;
  exempt: boolean;
  status: string | null;
  cycleStart: string | null;
  cycleEnd: string | null;
  graceUntil: string | null;
  cancelAtPeriodEnd: boolean;
  creditBalance: number;
  stripeCustomerId: string | null;
  billingContactUserId: string | null;
};

type Props = {
  clientId: string;
  state: StateProps;
  members: PortalMember[];
  purchases: CreditPurchase[];
  /** ¿Hay `STRIPE_SECRET_KEY`? Sin eso el panel avisa en vez de mentir. */
  stripeConfigured: boolean;
  /** ¿Estamos apuntando a la cuenta de test? Se avisa para no confundir cobros. */
  testMode: boolean;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Cómo se lee el estado real, ya combinando exención y gracia.
 *
 * `exempt` se pasa aparte (y no se lee de `state.reason`) para que el switch
 * optimista cambie la etiqueta en el acto: `reason` viene del servidor y no se
 * actualiza hasta que revalide la página.
 */
function describe(
  state: StateProps,
  exempt: boolean,
): { label: string; tone: "ok" | "warn" | "bad" } {
  if (exempt) return { label: "Interna / cortesía", tone: "ok" };

  switch (state.reason) {
    case "exempt":
      return { label: "Interna / cortesía", tone: "ok" };
    case "active":
      return { label: "Al día", tone: "ok" };
    case "grace":
      return { label: "Pago vencido — en gracia", tone: "warn" };
    case "unpaid":
      return { label: "Suspendida por falta de pago", tone: "bad" };
    case "canceled":
      return { label: "Cancelada", tone: "bad" };
    case "none":
      return { label: "Sin suscripción", tone: "bad" };
  }
}

export default function BillingSection({
  clientId,
  state,
  members,
  purchases,
  stripeConfigured,
  testMode,
}: Props) {
  const [exempt, setExempt] = useState(state.exempt);
  const [contact, setContact] = useState(state.billingContactUserId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const estado = describe(state, exempt);

  function toggleExempt(next: boolean) {
    const previous = exempt;
    setExempt(next);
    setError(null);
    setOk(null);

    start(async () => {
      try {
        const res = await setClientExempt(clientId, next);
        if (res.ok) {
          setOk(next ? "Marca exenta: no paga y no se corta." : "Exención quitada.");
        } else {
          setExempt(previous);
          setError(res.error);
        }
      } catch (e) {
        setExempt(previous);
        setError(e instanceof Error ? e.message : "No se pudo cambiar la exención.");
      }
    });
  }

  function changeContact(userId: string) {
    const previous = contact;
    setContact(userId);
    setError(null);
    setOk(null);

    start(async () => {
      try {
        const res = await setClientBillingContact(clientId, userId || null);
        if (res.ok) {
          setOk("Contacto de facturación actualizado.");
        } else {
          setContact(previous);
          setError(res.error);
        }
      } catch (e) {
        setContact(previous);
        setError(e instanceof Error ? e.message : "No se pudo cambiar el contacto.");
      }
    });
  }

  return (
    <div className={s.productsSection}>
      <h2 className={s.productsTitle}>Facturación</h2>
      <p className={s.productsSubtitle}>
        {formatMxn(PLAN_PRICE_MXN)}/mes por marca — incluye el portal, {PLAN_AI_CREDITS}{" "}
        generaciones y {PLAN_TRANSCRIPTIONS} transcripciones por ciclo. Adentro pueden entrar
        todos los miembros que quiera sin costo extra.
      </p>

      {!stripeConfigured && (
        <p className={s.usageText}>
          <strong className={s.usageOver}>Stripe no está configurado en este entorno.</strong> Falta
          <code> STRIPE_SECRET_KEY</code>: el estado que se ve abajo es el de la base, pero no se
          puede cobrar ni abrir el portal de Stripe.
        </p>
      )}

      {testMode && (
        <p className={s.usageText}>
          <strong>Modo test.</strong> Los cobros de este entorno no son reales.
        </p>
      )}

      {/* ── Estado ─────────────────────────────────────────────────────── */}
      <div className={s.portalGroup}>
        <p className={s.portalGroupTitle}>Estado</p>

        <p className={s.usageText}>
          <strong className={estado.tone === "ok" ? undefined : s.usageOver}>{estado.label}</strong>
          {state.status && !exempt ? ` · Stripe dice "${subscriptionStatusLabel(state.status)}"` : ""}
        </p>

        {state.cycleStart && (
          <p className={s.usageText}>
            Ciclo en curso: {formatDate(state.cycleStart)}
            {state.cycleEnd ? ` – ${formatDate(state.cycleEnd)}` : ""}
            {state.cancelAtPeriodEnd ? " · se cancela al terminar" : ""}
          </p>
        )}

        {!state.cycleStart && !exempt && (
          <p className={s.usageText}>
            Sin ciclo de facturación: los contadores caen al mes calendario (UTC) hasta que pague.
          </p>
        )}

        {state.graceUntil && !exempt && (
          <p className={s.usageText}>
            <strong className={s.usageOver}>
              Gracia hasta el {formatDate(state.graceUntil)}
            </strong>{" "}
            — después de esa fecha el portal se le cierra.
          </p>
        )}

        {state.stripeCustomerId && (
          <p className={s.usageText}>
            Cliente en Stripe:{" "}
            <a
              href={`https://dashboard.stripe.com/${testMode ? "test/" : ""}customers/${state.stripeCustomerId}`}
              target="_blank"
              rel="noreferrer"
            >
              {state.stripeCustomerId}
            </a>
          </p>
        )}
      </div>

      {/* ── Exención ───────────────────────────────────────────────────── */}
      <div className={s.portalGroup}>
        <p className={s.portalGroupTitle}>Cobro</p>

        <label className={`${s.featureRow} ${exempt ? s.featureRowOn : ""}`}>
          <input
            type="checkbox"
            className={s.switchInput}
            checked={exempt}
            disabled={isPending}
            onChange={(e) => toggleExempt(e.target.checked)}
          />
          <span className={s.switchTrack}>
            <span className={s.switchThumb} />
          </span>
          <span className={s.featureText}>
            <span className={s.featureLabel}>Marca interna o de cortesía</span>
            <span className={s.featureDescription}>
              No paga, nunca se corta y no tiene topes de IA ni de transcripción. Es lo que tienen
              tus propias marcas. Apagarlo hace que la próxima vez que entre un miembro se le pida
              pagar — no cancela nada en Stripe.
            </span>
          </span>
        </label>
      </div>

      {/* ── Créditos comprados ─────────────────────────────────────────── */}
      <div className={s.portalGroup}>
        <p className={s.portalGroupTitle}>Créditos comprados</p>

        <p className={s.usageText}>
          Saldo actual: <strong>{state.creditBalance}</strong>{" "}
          {state.creditBalance === 1 ? "crédito" : "créditos"}. No vencen: se usan solo cuando ya se
          agotó el cupo del ciclo.
        </p>

        {purchases.length === 0 ? (
          <p className={s.memberEmpty}>Todavía no compró ninguna recarga.</p>
        ) : (
          <div className={s.memberList}>
            {purchases.map((p) => (
              <div key={p.id} className={s.memberRow}>
                <div className={s.memberInfo}>
                  <span className={s.memberEmail}>+{p.credits} créditos</span>
                  <span className={s.memberMeta}>
                    {formatDate(p.createdAt)}
                    {p.amountCents !== null
                      ? ` · ${formatMxn(Math.round(p.amountCents / 100))}`
                      : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Contacto de facturación ────────────────────────────────────── */}
      <div className={s.portalGroup}>
        <p className={s.portalGroupTitle}>Quién paga</p>

        <p className={s.usageText}>
          Es el único miembro que ve la facturación y puede comprar recargas. Lo fija solo el
          Checkout (queda quien pagó); esto es para corregirlo si esa persona se fue.
        </p>

        <select
          className="input"
          value={contact}
          disabled={isPending || members.length === 0}
          onChange={(e) => changeContact(e.target.value)}
          style={{ maxWidth: 360 }}
        >
          <option value="">— Sin contacto asignado —</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.displayName ?? m.email ?? m.userId}
              {m.email && m.displayName ? ` (${m.email})` : ""}
            </option>
          ))}
        </select>

        {members.length === 0 && (
          <p className={s.memberEmpty}>Esta marca todavía no tiene miembros a quién asignarle.</p>
        )}
      </div>

      {error && <p className={s.usageOver}>{error}</p>}
      {ok && <p className={s.portalOk}>{ok}</p>}
    </div>
  );
}
