"use client";

/**
 * "¿Cómo te llamamos?" — puerta obligatoria del portal (Fase D, etapa 8).
 *
 * Se dibuja en lugar de cualquier pantalla de `/portal` mientras el usuario no
 * tenga fila en `portal_profiles`. Cubre tres casos de una: el que aceptó su
 * invitación antes de que existiera el campo, el que entró por otro camino, y
 * Paco la primera vez que abre "Ver como cliente" (que es lo que hace que sus
 * comentarios dejen de mostrar su email al cliente).
 *
 * No es un modal esquivable a propósito: el nombre es la única forma de saber
 * quién pidió qué cuando hay más de una persona por marca.
 *
 * La action va con `try/catch` y mensaje en línea (regla dura de `CLAUDE.md`).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { saveOwnDisplayName } from "./profileActions";

export default function NameGate({
  email,
  hint,
  maxLength,
}: {
  email: string | null;
  hint: string;
  maxLength: number;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || name.trim().length < 2) return;

    setSaving(true);
    setError(null);
    try {
      const res = await saveOwnDisplayName(name);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      className="blueprint"
      style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "32px 20px" }}
    >
      <div className="card" style={{ maxWidth: 460, width: "100%", padding: 32 }}>
        <p className="eyebrow">Un paso y entramos</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1.2,
            margin: "6px 0 10px",
          }}
        >
          ¿Cómo te llamamos?
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.55 }}>{hint}</p>

        <form onSubmit={submit} style={{ marginTop: 20, display: "grid", gap: 10 }}>
          <label className="field-label" htmlFor="portal-display-name">
            Tu nombre
          </label>
          <input
            id="portal-display-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Ana Martínez"
            maxLength={maxLength}
            autoFocus
            disabled={saving}
          />
          {email && (
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
              Entraste como {email}
            </span>
          )}
          {error && (
            <p style={{ fontSize: 13, color: "var(--flare)", margin: 0 }}>{error}</p>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || name.trim().length < 2}
          >
            {saving ? "Guardando…" : "Entrar"}
          </button>
        </form>

        <div style={{ marginTop: 24 }}>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
