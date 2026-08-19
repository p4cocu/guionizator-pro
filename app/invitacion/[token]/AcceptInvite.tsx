"use client";

/**
 * Pantalla pública de invitación al portal (Fase D, etapa 3).
 *
 * Tres caminos según con qué llega la persona:
 *  - Sin sesión → crea su cuenta (o entra, si ya la tiene) con el email
 *    invitado, que se muestra fijo: no se puede cambiar. Si Supabase exige
 *    confirmar el correo, el link de confirmación vuelve acá vía
 *    `/auth/callback?next=/invitacion/<token>`.
 *  - Con sesión de OTRO email → no se acepta nada. Se le ofrece cerrar sesión.
 *  - Con sesión del email invitado → un botón y listo.
 *
 * La validación de verdad (hash del token, vencimiento y email) la hace el
 * server action: esto es solo la UI.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { acceptInviteAction } from "./actions";
import { portalMemberRoleLabel, type PortalMemberRole } from "@/lib/portal/roles";
import s from "../invitacion.module.css";

type Props = {
  token: string;
  clientName: string;
  invitedEmail: string;
  role: PortalMemberRole;
  sessionEmail: string | null;
  /** ¿Todavía no eligió nombre visible? (etapa 8) */
  needsName: boolean;
  nameHint: string;
  nameMaxLength: number;
};

type Mode = "signup" | "login";

export default function AcceptInvite({
  token,
  clientName,
  invitedEmail,
  role,
  sessionEmail,
  needsName,
  nameHint,
  nameMaxLength,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const emailMatches =
    sessionEmail !== null && sessionEmail.toLowerCase() === invitedEmail.toLowerCase();

  async function accept() {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await acceptInviteAction(token, needsName ? displayName : undefined);
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aceptar la invitación.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const supabase = createClient();

    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: invitedEmail,
          password,
        });
        if (authError) throw authError;
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email: invitedEmail,
          password,
          options: {
            // Vuelve exactamente a esta invitación después de confirmar.
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/invitacion/${token}`,
          },
        });
        if (authError) throw authError;

        if (!data.session) {
          setNotice(
            "Cuenta creada. Revisa tu correo y haz clic en el enlace de confirmación: te trae de vuelta a esta invitación.",
          );
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar.");
      setLoading(false);
      return;
    }

    // Con la sesión ya creada, aceptar es el paso siguiente inmediato.
    await accept();
  }

  async function signOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    setLoading(false);
  }

  if (done) {
    return (
      <div className={s.done}>
        <div className={s.doneIcon}>✓</div>
        <h1 className={s.heading}>Listo, ya tienes acceso</h1>
        <p className={s.sub}>
          Tu cuenta quedó vinculada a <strong>{clientName}</strong> como{" "}
          {portalMemberRoleLabel(role).toLowerCase()}.
        </p>
        <p className={s.footNote}>
          Ya puedes entrar a ver tu contenido.
        </p>
        <Link href="/portal" className="btn btn-primary" style={{ width: "100%", marginTop: 12 }}>
          Ir a mi portal →
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="eyebrow">Invitación</p>
      <h1 className={s.heading}>Te invitaron a {clientName}</h1>
      <p className={s.sub}>
        La invitación es para <span className={s.invitedEmail}>{invitedEmail}</span>.
      </p>

      <p className={s.roleNote}>
        Vas a entrar como <strong>{portalMemberRoleLabel(role)}</strong>:{" "}
        {role === "collaborator"
          ? "puedes ver el contenido de la marca, comentarlo y editar los guiones."
          : "puedes ver el contenido de la marca y comentarlo."}
      </p>

      {sessionEmail && !emailMatches ? (
        <>
          <p className={s.error}>
            Estás con la cuenta <strong>{sessionEmail}</strong>, y esta invitación es
            para {invitedEmail}. Cierra sesión y entra con la cuenta invitada.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: "100%", marginTop: 16 }}
            onClick={signOut}
            disabled={loading}
          >
            {loading ? "Un momento…" : "Cerrar sesión"}
          </button>
        </>
      ) : emailMatches ? (
        <>
          {needsName && (
            <div className={s.form} style={{ marginBottom: 16 }}>
              <div>
                <label className="field-label" htmlFor="display-name">
                  ¿Cómo te llamamos?
                </label>
                <input
                  id="display-name"
                  className="input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ej: Ana Martínez"
                  maxLength={nameMaxLength}
                  required
                />
                <p className={s.footNote} style={{ marginTop: 8 }}>
                  {nameHint}
                </p>
              </div>
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={accept}
            disabled={loading || (needsName && displayName.trim().length < 2)}
          >
            {loading ? "Un momento…" : `Aceptar acceso a ${clientName}`}
          </button>
          {error && (
            <p className={s.error} style={{ marginTop: 14 }}>
              {error}
            </p>
          )}
        </>
      ) : (
        <>
          <form onSubmit={handleAuth} className={s.form}>
            <div>
              <label className="field-label" htmlFor="email">
                Correo
              </label>
              {/* Fijo a propósito: la invitación vale solo para este email. */}
              <input
                id="email"
                type="email"
                className="input"
                value={invitedEmail}
                readOnly
                disabled
              />
            </div>
            {needsName && mode === "signup" && (
              <div>
                <label className="field-label" htmlFor="display-name-signup">
                  ¿Cómo te llamamos?
                </label>
                <input
                  id="display-name-signup"
                  className="input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ej: Ana Martínez"
                  maxLength={nameMaxLength}
                  minLength={2}
                  required
                />
                <p className={s.footNote} style={{ marginTop: 8 }}>
                  {nameHint}
                </p>
              </div>
            )}
            <div>
              <label className="field-label" htmlFor="password">
                {mode === "signup" ? "Elige una contraseña" : "Contraseña"}
              </label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={6}
                required
              />
            </div>

            {error && <p className={s.error}>{error}</p>}
            {notice && <p className={s.notice}>{notice}</p>}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={loading}
            >
              {loading
                ? "Un momento…"
                : mode === "signup"
                  ? "Crear cuenta y aceptar"
                  : "Entrar y aceptar"}
            </button>
          </form>

          <button
            type="button"
            className={s.toggle}
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError(null);
              setNotice(null);
            }}
          >
            {mode === "signup" ? "¿Ya tienes cuenta? Entra" : "¿No tienes cuenta? Créala"}
          </button>
        </>
      )}

      <p className={s.footNote}>
        ¿No esperabas esta invitación? Ignora este link: sin aceptarlo no pasa nada.{" "}
        <Link href="/login" style={{ color: "inherit" }}>
          Ir al inicio
        </Link>
        .
      </p>
    </>
  );
}
