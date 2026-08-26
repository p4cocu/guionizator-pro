"use client";

/**
 * Pantalla de facturación del cliente (Fase E).
 *
 * Tres bloques: en qué estado está la suscripción, cuánto le queda del ciclo, y
 * los botones (recargar créditos / gestionar la suscripción en Stripe).
 *
 * Los dos botones abren páginas hospedadas por Stripe: acá no se pide ni se
 * muestra un solo dato de tarjeta. Cada `fetch` chequea `res.ok` explícitamente
 * — una respuesta no-2xx no lanza en `fetch`, y darla por buena es la trampa
 * que ya rompió dos veces los jobs de este repo.
 */

import { useState } from "react";
import type { BillingReason } from "@/lib/billing/access";
import type { CreditPurchase } from "@/lib/billing/credits";
import { CREDIT_PACKS, formatMxn, PLAN_PRICE_MXN } from "@/lib/billing/plan";
import s from "./facturacion.module.css";

type Props = {
  clientId: string;
  clientLabel: string;
  reason: BillingReason;
  cycleStart: string | null;
  cycleEnd: string | null;
  graceUntil: string | null;
  cancelAtPeriodEnd: boolean;
  creditBalance: number;
  hasStripeCustomer: boolean;
  stripeConfigured: boolean;
  aiUsed: number;
  aiLimit: number | null;
  transcriptionUsed: number;
  transcriptionLimit: number | null;
  purchases: CreditPurchase[];
  flash: "ok" | "cancelada" | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function estadoLabel(reason: BillingReason): { text: string; tone: string } {
  switch (reason) {
    case "exempt":
      return { text: "Cortesía", tone: s.toneOk };
    case "active":
      return { text: "Activa", tone: s.toneOk };
    case "grace":
      return { text: "Pago pendiente", tone: s.toneWarn };
    case "unpaid":
      return { text: "Suspendida", tone: s.toneBad };
    case "canceled":
      return { text: "Cancelada", tone: s.toneBad };
    case "none":
      return { text: "Sin activar", tone: s.toneBad };
  }
}

export default function BillingClient(props: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const estado = estadoLabel(props.reason);
  const exenta = props.reason === "exempt";

  async function go(endpoint: string, body: Record<string, string>, busyKey: string) {
    setLoading(busyKey);
    setError(null);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;

      if (!res.ok || !data?.url) {
        setError(data?.error ?? "No pudimos abrir el pago. Intenta de nuevo en un momento.");
        setLoading(null);
        return;
      }

      // No se apaga `loading`: la pestaña se va a Stripe.
      window.location.href = data.url;
    } catch {
      setError("No pudimos conectar con el sistema de pagos. Revisa tu conexión.");
      setLoading(null);
    }
  }

  return (
    <div>
      <p className="eyebrow">{props.clientLabel}</p>
      <h1 className={s.title}>Facturación</h1>

      {props.flash === "ok" && (
        <p className={s.flashOk}>
          Listo, tus créditos ya están cargados. Si el saldo de abajo todavía no lo refleja, recarga
          la página en unos segundos.
        </p>
      )}
      {props.flash === "cancelada" && (
        <p className={s.flashNeutral}>Cancelaste la compra. No se cobró nada.</p>
      )}

      {/* ── Estado ─────────────────────────────────────────────────────── */}
      <section className={`card ${s.block}`}>
        <div className={s.stateRow}>
          <div>
            <p className="eyebrow">Tu plan</p>
            <p className={s.planPrice}>
              {exenta ? "Cortesía" : `${formatMxn(PLAN_PRICE_MXN)} / mes`}
            </p>
          </div>
          <span className={`${s.badge} ${estado.tone}`}>{estado.text}</span>
        </div>

        {props.cycleStart && props.cycleEnd && (
          <p className={s.meta}>
            Ciclo actual: {formatDate(props.cycleStart)} – {formatDate(props.cycleEnd)}
            {props.cancelAtPeriodEnd ? " · tu suscripción termina al cerrar este ciclo" : ""}
          </p>
        )}

        {props.graceUntil && props.reason === "grace" && (
          <p className={s.metaWarn}>
            No pudimos cobrar tu tarjeta. Tienes hasta el {formatDate(props.graceUntil)} para
            actualizarla antes de que se suspenda el acceso.
          </p>
        )}

        {props.stripeConfigured && props.hasStripeCustomer && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading !== null}
            onClick={() => go("/api/billing/portal", { clientId: props.clientId }, "portal")}
          >
            {loading === "portal" ? "Abriendo…" : "Gestionar suscripción"}
          </button>
        )}

        {props.stripeConfigured && props.hasStripeCustomer && (
          <p className={s.hint}>
            Cambia tu tarjeta, descarga tus recibos o cancela. Se abre en la página segura de
            Stripe.
          </p>
        )}
      </section>

      {/* ── Consumo del ciclo ──────────────────────────────────────────── */}
      <section className={`card ${s.block}`}>
        <p className="eyebrow">Consumo de este ciclo</p>

        <div className={s.meters}>
          <Meter
            label="Generaciones con IA"
            used={props.aiUsed}
            limit={props.aiLimit}
            hint="Guiones, adaptaciones, portadas y copies."
          />
          <Meter
            label="Transcripciones"
            used={props.transcriptionUsed}
            limit={props.transcriptionLimit}
            hint="Videos de la competencia pasados a texto."
          />
        </div>

        {!exenta && (
          <p className={s.hint}>
            Créditos comprados disponibles: <strong>{props.creditBalance}</strong>. No vencen: se
            usan solo cuando ya agotaste las generaciones del ciclo.
          </p>
        )}
      </section>

      {/* ── Recargas ───────────────────────────────────────────────────── */}
      {!exenta && props.stripeConfigured && (
        <section className={`card ${s.block}`}>
          <p className="eyebrow">Comprar más generaciones</p>
          <p className={s.hint}>
            Pago único. Los créditos no vencen y quedan disponibles para los próximos ciclos.
          </p>

          <div className={s.packs}>
            {CREDIT_PACKS.map((pack) => (
              <button
                key={pack.key}
                type="button"
                className={`btn btn-secondary ${s.pack}`}
                disabled={loading !== null}
                onClick={() =>
                  go(
                    "/api/billing/credits",
                    { clientId: props.clientId, pack: pack.key },
                    `pack-${pack.key}`,
                  )
                }
              >
                <span className={s.packLabel}>{pack.label}</span>
                <span className={s.packPrice}>
                  {loading === `pack-${pack.key}` ? "Abriendo…" : formatMxn(pack.priceMxn)}
                </span>
                <span className={s.packHint}>{pack.hint}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Historial ──────────────────────────────────────────────────── */}
      {props.purchases.length > 0 && (
        <section className={`card ${s.block}`}>
          <p className="eyebrow">Recargas anteriores</p>
          <ul className={s.history}>
            {props.purchases.map((p) => (
              <li key={p.id} className={s.historyRow}>
                <span>+{p.credits} créditos</span>
                <span className={s.historyMeta}>
                  {formatDate(p.createdAt)}
                  {p.amountCents !== null
                    ? ` · ${formatMxn(Math.round(p.amountCents / 100))}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Meter({
  label,
  used,
  limit,
  hint,
}: {
  label: string;
  used: number;
  limit: number | null;
  hint: string;
}) {
  // Sin tope (marca de cortesía): no hay barra que dibujar, solo el conteo.
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const agotado = limit !== null && used >= limit;

  return (
    <div className={s.meter}>
      <div className={s.meterHead}>
        <span className={s.meterLabel}>{label}</span>
        <span className={agotado ? s.meterCountOver : s.meterCount}>
          {used}
          {limit !== null ? ` / ${limit}` : ""}
        </span>
      </div>

      {limit !== null && (
        <div className={s.meterTrack}>
          <div
            className={agotado ? s.meterFillOver : s.meterFill}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <p className={s.meterHint}>{limit === null ? "Sin tope. " : ""}{hint}</p>
    </div>
  );
}
