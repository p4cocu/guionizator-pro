"use client";

/**
 * Perfil del usuario: nombre visible + contraseña (etapa 9).
 *
 * Lo usan las DOS pantallas —`/portal/perfil` y `/perfil` del estudio— con el
 * mismo componente a propósito: son la misma cuenta de Auth y la misma fila de
 * `portal_profiles`. Lo único que cambia entre las dos es el marco.
 *
 * Recibe los límites como props (`maxLength`, `passwordMin`) en vez de
 * importarlos de `lib/portal/profiles.ts`: ese módulo importa el service role y
 * no puede cruzar al bundle del browser. Es el mismo trato que ya tenía
 * `NameGate`.
 *
 * Las dos actions van con `try/catch` y mensaje en línea (regla dura de
 * `CLAUDE.md`): un `throw` sin capturar acá deja la pantalla de "This page
 * couldn't load".
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveOwnDisplayName, updateOwnPassword } from "@/app/(portal)/portal/profileActions";
import s from "./ProfileForm.module.css";

export default function ProfileForm({
  email,
  displayName,
  hint,
  minLength,
  maxLength,
  passwordMin,
}: {
  email: string | null;
  displayName: string;
  hint: string;
  minLength: number;
  maxLength: number;
  passwordMin: number;
}) {
  const router = useRouter();

  const [name, setName] = useState(displayName);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameOk, setNameOk] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passOk, setPassOk] = useState(false);

  const nameDirty = name.trim() !== displayName && name.trim().length >= minLength;

  async function submitName(e: React.FormEvent) {
    e.preventDefault();
    if (savingName || !nameDirty) return;

    setSavingName(true);
    setNameError(null);
    setNameOk(false);
    try {
      const res = await saveOwnDisplayName(name);
      if (!res.ok) {
        setNameError(res.error);
        return;
      }
      setName(res.name);
      setNameOk(true);
      router.refresh();
    } catch {
      setNameError("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSavingName(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (savingPass) return;

    setPassError(null);
    setPassOk(false);

    if (next !== repeat) {
      setPassError("Las dos contraseñas nuevas no coinciden.");
      return;
    }
    if (next.length < passwordMin) {
      setPassError(`La contraseña nueva necesita al menos ${passwordMin} caracteres.`);
      return;
    }

    setSavingPass(true);
    try {
      const res = await updateOwnPassword(current, next);
      if (!res.ok) {
        setPassError(res.error);
        return;
      }
      setCurrent("");
      setNext("");
      setRepeat("");
      setPassOk(true);
    } catch {
      setPassError("No se pudo cambiar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSavingPass(false);
    }
  }

  return (
    <div className={s.wrap}>
      <section className="card" style={{ padding: 24 }}>
        <p className="eyebrow">Cómo te ven</p>
        <h2 className={s.sectionTitle}>Tu nombre</h2>
        <p className={s.hint}>{hint}</p>

        <form onSubmit={submitName} className={s.form}>
          <div className="field">
            <label className="field-label" htmlFor="profile-name">
              Nombre
            </label>
            <input
              id="profile-name"
              className="input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameOk(false);
              }}
              maxLength={maxLength}
              disabled={savingName}
            />
          </div>

          {email && <p className={s.meta}>Tu cuenta es {email}. Eso no lo ve nadie más.</p>}
          {nameError && <p className={s.error}>{nameError}</p>}
          {nameOk && <p className={s.ok}>Listo, ese es tu nombre ahora.</p>}

          <div className={s.actions}>
            <button type="submit" className="btn btn-primary" disabled={savingName || !nameDirty}>
              {savingName ? "Guardando…" : "Guardar nombre"}
            </button>
          </div>
        </form>
      </section>

      <section className="card" style={{ padding: 24 }}>
        <p className="eyebrow">Acceso</p>
        <h2 className={s.sectionTitle}>Tu contraseña</h2>
        <p className={s.hint}>
          Para cambiarla necesitas la que usas hoy. Si no la recuerdas, cierra
          sesión y usa &ldquo;¿Olvidaste tu contraseña?&rdquo; en la pantalla de
          entrada.
        </p>

        <form onSubmit={submitPassword} className={s.form}>
          <div className="field">
            <label className="field-label" htmlFor="profile-current">
              Contraseña actual
            </label>
            <input
              id="profile-current"
              className="input"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              disabled={savingPass}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="profile-next">
              Contraseña nueva
            </label>
            <input
              id="profile-next"
              className="input"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => {
                setNext(e.target.value);
                setPassOk(false);
              }}
              disabled={savingPass}
            />
            <span className={s.meta}>Al menos {passwordMin} caracteres.</span>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="profile-repeat">
              Repite la nueva
            </label>
            <input
              id="profile-repeat"
              className="input"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              disabled={savingPass}
            />
          </div>

          {passError && <p className={s.error}>{passError}</p>}
          {passOk && <p className={s.ok}>Contraseña cambiada. La próxima vez entra con la nueva.</p>}

          <div className={s.actions}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingPass || !current || !next || !repeat}
            >
              {savingPass ? "Cambiando…" : "Cambiar contraseña"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
