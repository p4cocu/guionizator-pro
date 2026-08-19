"use client";

/**
 * Formulario de "elige tu contraseña nueva" (etapa 9). Se llega acá por un link
 * de recuperación, nunca desde el menú.
 *
 * La action va con `try/catch` y mensaje en línea (regla dura de `CLAUDE.md`).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setNewPassword } from "./actions";
import s from "./nueva.module.css";

export default function NuevaContrasenaForm({
  email,
  passwordMin,
}: {
  email: string | null;
  passwordMin: number;
}) {
  const router = useRouter();
  const [pass, setPass] = useState("");
  const [repeat, setRepeat] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setError(null);
    if (pass !== repeat) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }
    if (pass.length < passwordMin) {
      setError(`La contraseña necesita al menos ${passwordMin} caracteres.`);
      return;
    }

    setSaving(true);
    try {
      const res = await setNewPassword(pass);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
      // Ya está logueado con la sesión del link: `/` decide estudio o portal.
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1200);
    } catch {
      setError("No se pudo cambiar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <p className={s.ok}>
        Contraseña cambiada. Te llevamos adentro…
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={s.form}>
      {email && <p className={s.meta}>Estás cambiando la contraseña de {email}.</p>}

      <div className="field">
        <label className="field-label" htmlFor="nueva-pass">
          Contraseña nueva
        </label>
        <input
          id="nueva-pass"
          className="input"
          type="password"
          autoComplete="new-password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          disabled={saving}
          autoFocus
        />
        <span className={s.meta}>Al menos {passwordMin} caracteres.</span>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="nueva-pass-2">
          Repítela
        </label>
        <input
          id="nueva-pass-2"
          className="input"
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          disabled={saving}
        />
      </div>

      {error && <p className={s.error}>{error}</p>}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={saving || !pass || !repeat}
      >
        {saving ? "Guardando…" : "Guardar y entrar"}
      </button>
    </form>
  );
}
