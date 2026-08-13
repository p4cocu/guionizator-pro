"use client";

import { useState, useTransition } from "react";
import {
  checkApifyToken,
  removeApifyToken,
  saveApifyToken,
  type ApifyUsageInfo,
} from "../actions";
import type { ApifyTokenState } from "@/lib/competencia/apifyToken";
import s from "../clientes.module.css";

type Props = {
  clientId: string;
  initial: ApifyTokenState;
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatUsage(u: ApifyUsageInfo): string {
  const used = u.usedUsd != null ? `$${u.usedUsd.toFixed(2)}` : "—";
  const limit = u.limitUsd != null ? ` de $${u.limitUsd.toFixed(2)}` : "";
  const cycle = u.cycleEndsAt
    ? ` · el ciclo cierra el ${formatDate(u.cycleEndsAt)}`
    : "";
  return `Consumo del mes: ${used}${limit}${cycle}`;
}

export default function ApifySection({ clientId, initial }: Props) {
  const [state, setState] = useState<ApifyTokenState>(initial);
  const [token, setToken] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [usage, setUsage] = useState<ApifyUsageInfo | null>(null);
  const [isPending, start] = useTransition();

  const hasToken = state.last4 !== null;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    start(async () => {
      const res = await saveApifyToken(clientId, token);
      if (res.ok) {
        setState(res.state);
        setToken("");
        setEditing(false);
        setUsage(null);
        setOk(
          res.username
            ? `Token guardado y validado — cuenta de Apify: ${res.username}.`
            : "Token guardado y validado.",
        );
      } else {
        setError(res.error);
      }
    });
  }

  function handleCheck() {
    setError(null);
    setOk(null);
    start(async () => {
      const res = await checkApifyToken(clientId);
      if (res.ok) {
        setState(res.state);
        setUsage(res.usage);
        setOk(res.username ? `Token válido (${res.username}).` : "Token válido.");
      } else {
        setState((prev) => ({ ...prev, valid: false }));
        setError(res.error);
      }
    });
  }

  function handleRemove() {
    if (!confirm("¿Eliminar el token de Apify de este cliente? Volverá a usar el token global.")) {
      return;
    }
    setError(null);
    setOk(null);
    start(async () => {
      try {
        await removeApifyToken(clientId);
        setState({ last4: null, valid: false, checkedAt: null });
        setUsage(null);
        setOk("Token eliminado. Este cliente usará el token global.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo eliminar el token.");
      }
    });
  }

  return (
    <div className={s.productsSection}>
      <h2 className={s.productsTitle}>Apify (scraping de competencia)</h2>
      <p className={s.productsSubtitle}>
        Token propio de este cliente para buscar competencia. Cada marca paga su
        propio scraping. Si lo dejas vacío, se usa el token global de la app.
      </p>

      {hasToken && !editing ? (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <span className="badge" style={{ fontFamily: "monospace" }}>
              apify_api_••••{state.last4}
            </span>
            <span
              style={{
                fontSize: 12,
                opacity: 0.85,
                color: state.valid ? "var(--emerald, #34d399)" : "var(--flare, #ef4444)",
              }}
            >
              {state.valid ? "Válido" : "Inválido — reemplázalo"}
            </span>
            {state.checkedAt && (
              <span style={{ fontSize: 12, opacity: 0.6 }}>
                Verificado el {formatDate(state.checkedAt)}
              </span>
            )}
          </div>

          {usage && (
            <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>{formatUsage(usage)}</p>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={handleCheck}
              disabled={isPending}
              className="btn btn-secondary"
              style={{ fontSize: 13 }}
            >
              {isPending ? "…" : "Verificar y ver crédito"}
            </button>
            <button
              onClick={() => {
                setEditing(true);
                setError(null);
                setOk(null);
              }}
              disabled={isPending}
              className="btn btn-ghost"
              style={{ fontSize: 13 }}
            >
              Reemplazar
            </button>
            <button
              onClick={handleRemove}
              disabled={isPending}
              className="btn btn-ghost"
              style={{ fontSize: 13, marginLeft: "auto" }}
            >
              Eliminar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className={s.productForm}>
          <label className="field-label" style={{ fontSize: 13 }}>
            Token de API de Apify (apify.com → Settings → Integrations → API tokens)
          </label>
          <textarea
            className="textarea"
            placeholder="apify_api_…"
            rows={2}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={{ fontSize: 12, fontFamily: "monospace" }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setToken("");
                  setError(null);
                }}
                className="btn btn-ghost"
                style={{ fontSize: 13 }}
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isPending || !token.trim()}
              style={{ fontSize: 13 }}
            >
              {isPending ? "Validando…" : "Guardar token"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className={s.formError} style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
      {ok && (
        <p style={{ marginTop: 10, fontSize: 13, color: "var(--emerald, #34d399)" }}>{ok}</p>
      )}
    </div>
  );
}
