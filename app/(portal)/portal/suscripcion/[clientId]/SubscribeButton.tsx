"use client";

/**
 * Botón que arranca el Checkout (Fase E).
 *
 * No usa Stripe.js: el servidor crea la sesión y devuelve una URL de
 * `checkout.stripe.com` a la que redirigimos. Ningún dato de tarjeta pasa por
 * esta app, y no hace falta publishable key en el browser.
 *
 * El `fetch` chequea `res.ok` explícitamente: una respuesta no-2xx **no** lanza
 * en `fetch`, y dar por bueno un error es exactamente la trampa que ya rompió
 * dos veces los jobs de este repo.
 */

import { useState } from "react";

type Props = {
  clientId: string;
  /**
   * `checkout` = alta nueva. `portal` = ya hay una suscripción en Stripe y lo
   * que falló fue el cobro: hay que mandarlo a actualizar la tarjeta, no a
   * crear una segunda suscripción para el mismo customer.
   */
  mode: "checkout" | "portal";
};

export default function SubscribeButton({ clientId, mode }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(mode === "portal" ? "/api/billing/portal" : "/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });

      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;

      if (!res.ok || !data?.url) {
        setError(data?.error ?? "No pudimos abrir el pago. Intenta de nuevo en un momento.");
        setLoading(false);
        return;
      }

      // No se apaga `loading`: la pestaña se va a Stripe y volver el botón a su
      // estado normal solo invita a un segundo clic (y a una segunda sesión).
      window.location.href = data.url;
    } catch {
      setError("No pudimos conectar con el sistema de pagos. Revisa tu conexión.");
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <button
        type="button"
        className="btn btn-primary"
        style={{ width: "100%" }}
        disabled={loading}
        onClick={start}
      >
        {loading
          ? "Abriendo…"
          : mode === "portal"
            ? "Actualizar mi tarjeta"
            : "Activar suscripción"}
      </button>

      {error && (
        <p style={{ marginTop: 10, fontSize: 13, color: "var(--flare)" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
