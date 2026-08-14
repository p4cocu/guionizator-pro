/**
 * Pantalla suelta del portal (sin sidebar): "no tenés acceso" y "tu marca
 * todavía no tiene secciones". Reemplaza a `PortalPending`, que existía solo
 * mientras `/portal` no estaba construido.
 *
 * Server component: `LogoutButton` es el único pedazo cliente.
 */

import LogoutButton from "@/components/LogoutButton";

export default function PortalNotice({
  eyebrow,
  title,
  children,
  showLogout = true,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  showLogout?: boolean;
}) {
  return (
    <main
      className="blueprint"
      style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "32px 20px" }}
    >
      <div className="card" style={{ maxWidth: 460, width: "100%", padding: 32 }}>
        <p className="eyebrow">{eyebrow}</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1.2,
            margin: "6px 0 10px",
          }}
        >
          {title}
        </h1>
        <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.55 }}>
          {children}
        </div>
        {showLogout && (
          <div style={{ marginTop: 24 }}>
            <LogoutButton />
          </div>
        )}
      </div>
    </main>
  );
}
