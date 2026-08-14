/**
 * Pantalla de espera para miembros del portal (Fase D, etapa 3).
 *
 * Un invitado que aceptó su invitación ya tiene cuenta y membresía, pero
 * `/portal` todavía no existe (etapa 4). Sin esto aterrizaría en `/dashboard` y
 * vería el shell interno completo: sidebar con las 12 secciones, todas vacías
 * porque la RLS no le deja leer nada. No es una fuga —es RLS quien manda— pero
 * es una pantalla que no le habla a él.
 *
 * Cuando exista `/portal`, esto se reemplaza por `redirect("/portal")` en
 * `app/(app)/layout.tsx`.
 */

import LogoutButton from "@/components/LogoutButton";

export default function PortalPending({ email }: { email?: string }) {
  return (
    <main
      className="blueprint"
      style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "32px 20px" }}
    >
      <div className="card" style={{ maxWidth: 460, width: "100%", padding: 32 }}>
        <p className="eyebrow">Tu acceso está activo</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1.2,
            margin: "6px 0 10px",
          }}
        >
          Tu portal está en camino
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.55, margin: 0 }}>
          Ya quedaste vinculado a tu marca{email ? ` con ${email}` : ""}. La pantalla
          donde vas a ver tus reportes, guiones y calendario se está terminando —
          te avisamos apenas esté lista. No hace falta que hagas nada más.
        </p>
        <div style={{ marginTop: 24 }}>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
