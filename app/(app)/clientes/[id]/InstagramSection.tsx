"use client";

import { useState, useTransition } from "react";
import {
  connectInstagram,
  disconnectInstagram,
  fetchInstagramMedia,
  refreshInstagramToken,
} from "../../instagram/actions";
import type { IgMedia } from "@/lib/instagram/client";
import s from "../clientes.module.css";

type Account = {
  id: string;
  ig_user_id: string;
  username: string | null;
  token_expires_at: string | null;
  created_at: string;
  /** Los escribe el cron diario refresh-instagram-tokens-scheduled. */
  last_refresh_attempt_at?: string | null;
  last_refresh_error?: string | null;
} | null;

type Props = {
  clientId: string;
  account: Account;
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export default function InstagramSection({ clientId, account }: Props) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [media, setMedia] = useState<IgMedia[] | null>(null);
  // Falla del cron diario. Se limpia en cuanto un refresh manual sale bien
  // (el prop viene del server component y no se revalida solo).
  const [autoError, setAutoError] = useState<string | null>(
    account?.last_refresh_error ?? null,
  );
  const [isPending, start] = useTransition();

  const expiresIn = account ? daysUntil(account.token_expires_at) : null;

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    start(async () => {
      const res = await connectInstagram(token, clientId);
      if (res.ok) {
        setToken("");
        setOk(`Conectado como @${res.username}`);
      } else {
        setError(res.error);
      }
    });
  }

  function handleLoadMedia() {
    if (!account) return;
    setError(null);
    start(async () => {
      const res = await fetchInstagramMedia(account.id);
      if (res.ok) setMedia(res.media);
      else setError(res.error);
    });
  }

  function handleRefresh() {
    if (!account) return;
    setError(null);
    setOk(null);
    start(async () => {
      try {
        await refreshInstagramToken(account.id);
        setAutoError(null);
        setOk("Token renovado por ~60 días más.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al renovar token");
      }
    });
  }

  function handleDisconnect() {
    if (!account) return;
    if (!confirm("¿Desconectar esta cuenta de Instagram?")) return;
    start(async () => {
      await disconnectInstagram(account.id, clientId);
      setMedia(null);
    });
  }

  return (
    <div className={s.productsSection}>
      <h2 className={s.productsTitle}>Instagram</h2>
      <p className={s.productsSubtitle}>
        Conectá la cuenta de Instagram de este cliente para traer sus posts y
        métricas reales.
      </p>

      {!account ? (
        <form onSubmit={handleConnect} className={s.productForm}>
          <label className="field-label" style={{ fontSize: 13 }}>
            Token de acceso (Instagram Login, ~60 días)
          </label>
          <textarea
            className="textarea"
            placeholder="Pegá aquí el long-lived token generado en Meta Developer (empieza con IGAA…)"
            rows={3}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={{ fontSize: 12, fontFamily: "monospace" }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isPending}
            style={{ fontSize: 13, justifySelf: "end", marginTop: 8 }}
          >
            {isPending ? "Validando…" : "Conectar cuenta"}
          </button>
        </form>
      ) : (
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
            <span className="badge">@{account.username}</span>
            {expiresIn !== null && (
              <span
                style={{
                  fontSize: 12,
                  color: expiresIn < 7 ? "var(--signal, #e6b800)" : "inherit",
                  opacity: 0.8,
                }}
              >
                Token vence en {expiresIn} día{expiresIn === 1 ? "" : "s"}
                {" · se renueva solo"}
              </span>
            )}
          </div>

          {autoError && (
            <p
              className={s.formError}
              style={{ marginTop: 0, marginBottom: 12, fontSize: 12 }}
            >
              La renovación automática falló: {autoError} — renová el token a
              mano o reconectá la cuenta.
            </p>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={handleLoadMedia}
              disabled={isPending}
              className="btn btn-secondary"
              style={{ fontSize: 13 }}
            >
              {isPending ? "…" : "Ver posts y métricas"}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isPending}
              className="btn btn-ghost"
              style={{ fontSize: 13 }}
            >
              Renovar token
            </button>
            <button
              onClick={handleDisconnect}
              disabled={isPending}
              className="btn btn-ghost"
              style={{ fontSize: 13, marginLeft: "auto" }}
            >
              Desconectar
            </button>
          </div>

          {media && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                gap: 10,
                marginTop: 16,
              }}
            >
              {media.length === 0 && (
                <p style={{ fontSize: 13, opacity: 0.7 }}>
                  Esta cuenta no tiene posts todavía.
                </p>
              )}
              {media.map((m) => (
                <a
                  key={m.id}
                  href={m.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    borderRadius: 10,
                    overflow: "hidden",
                    border: "1px solid var(--border, rgba(255,255,255,0.1))",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  {(m.thumbnail_url || m.media_url) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.thumbnail_url || m.media_url}
                      alt={m.caption?.slice(0, 40) ?? "post"}
                      style={{
                        width: "100%",
                        aspectRatio: "1",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  )}
                  <div style={{ padding: "6px 8px" }}>
                    <span style={{ fontSize: 10, opacity: 0.6 }}>
                      {m.media_type === "VIDEO"
                        ? "Reel/Video"
                        : m.media_type === "CAROUSEL_ALBUM"
                          ? "Carrusel"
                          : "Imagen"}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className={s.formError} style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
      {ok && (
        <p style={{ marginTop: 10, fontSize: 13, color: "var(--emerald, #34d399)" }}>
          {ok}
        </p>
      )}
    </div>
  );
}
