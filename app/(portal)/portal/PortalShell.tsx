"use client";

/**
 * Shell del portal de cliente (Fase D, etapa 4).
 *
 * NO reusa `components/Sidebar.tsx`: ese tiene las 12 secciones internas
 * hardcodeadas (Cerebro, Tendencias, Recursos…), que son herramientas de Paco y
 * no entregables del cliente. Acá el menú se arma desde las secciones que la
 * marca tiene prendidas.
 *
 * Recibe todo como props planas: no importa nada de `lib/portal/access.ts`
 * (server-only). De `features.ts` sí importa, porque ese módulo es puro.
 */

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import { enabledPortalFeatures, type PortalFeature } from "@/lib/portal/features";
import s from "./portal.module.css";

export type PortalShellClient = {
  id: string;
  label: string;
  features: string[];
};

type Props = {
  client: PortalShellClient;
  /** Las otras marcas del usuario. Vacío = no se dibuja el selector. */
  otherClients: { id: string; label: string }[];
  email?: string | null;
  /** El dueño ve un aviso de que está mirando el portal como su cliente. */
  isOwnerPreview?: boolean;
  children: React.ReactNode;
};

export default function PortalShell({
  client,
  otherClients,
  email,
  isOwnerPreview,
  children,
}: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const close = useCallback(() => setMenuOpen(false), []);
  const toggle = useCallback(() => setMenuOpen((v) => !v), []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const features = enabledPortalFeatures(client.features);
  const current = features.find((f) => isActive(pathname, client.id, f));

  return (
    <div className={s.shell}>
      <aside
        className={`${s.sidebar} ${menuOpen ? s.sidebarOpen : ""} sidebar-dark-scope`}
      >
        <div className={s.brand}>
          <span className={s.brandMark} aria-hidden="true" />
          <span className={s.brandName}>{client.label}</span>
        </div>

        <nav className={s.nav}>
          <span className="eyebrow" style={{ paddingLeft: 14, opacity: 0.7 }}>
            Tu marca
          </span>

          {features.length === 0 && (
            <p className={s.navEmpty}>Todavía no hay secciones habilitadas.</p>
          )}

          {features.map((f) =>
            f.live && f.path ? (
              <Link
                key={f.slug}
                href={`/portal/${client.id}/${f.path}`}
                className={`${s.link} ${current?.slug === f.slug ? s.active : ""}`}
                onClick={close}
              >
                <span>{f.label}</span>
              </Link>
            ) : (
              // Habilitada pero sin pantalla todavía (etapas 5 y 6). Se muestra
              // atenuada en vez de ocultarse: el cliente ve qué le viene, y
              // Paco no tiene que apagar el flag mientras tanto.
              <span key={f.slug} className={`${s.link} ${s.linkSoon}`} aria-disabled="true">
                <span>{f.label}</span>
                <span className={s.soon}>Pronto</span>
              </span>
            ),
          )}

          {otherClients.length > 0 && (
            <>
              <span
                className="eyebrow"
                style={{ paddingLeft: 14, opacity: 0.7, marginTop: 14 }}
              >
                Cambiar de marca
              </span>
              {otherClients.map((c) => (
                <Link
                  key={c.id}
                  href={`/portal/${c.id}`}
                  className={`${s.link} ${s.linkMuted}`}
                  onClick={close}
                >
                  <span>{c.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className={s.sidebarFooter}>
          <Link href="/portal/perfil" className={`${s.link} ${s.linkMuted}`} onClick={close}>
            <span>Tu perfil</span>
          </Link>
          <div className={s.sidebarFooterNote}>
            <span className={s.dot} />
            <span>Portal de cliente</span>
          </div>
        </div>
      </aside>

      {menuOpen && <div className={s.overlay} onClick={close} aria-hidden="true" />}

      <div className={s.main}>
        <header className={s.topbar}>
          <div className={s.topbarLeft}>
            <button className={s.menuBtn} onClick={toggle} aria-label="Abrir menú">
              ☰
            </button>
            <h1 className={s.topbarTitle}>{current?.label ?? client.label}</h1>
          </div>
          <div className={s.topbarRight}>
            {email && (
              // Desde la etapa 9 el email es la puerta al perfil: es donde el
              // usuario ya busca "su cuenta".
              <Link href="/portal/perfil" className={s.user} title={`${email} — tu perfil`}>
                {email}
              </Link>
            )}
            <LogoutButton />
          </div>
        </header>

        <div className={`${s.content} blueprint`}>
          <div className={s.inner}>
            {isOwnerPreview && (
              <p className={s.preview}>
                Estás viendo el portal como lo ve tu cliente. Para cambiar qué
                secciones aparecen acá, entra a{" "}
                <Link href={`/clientes/${client.id}`} className={s.previewLink}>
                  el perfil de la marca
                </Link>{" "}
                → &ldquo;Portal del cliente&rdquo;.
              </p>
            )}
            {children}
          </div>
        </div>
      </div>

      <ThemeToggle />
    </div>
  );
}

/** ¿La ruta actual corresponde a esta sección de esta marca? */
function isActive(pathname: string, clientId: string, feature: PortalFeature): boolean {
  if (!feature.path) return false;
  const base = `/portal/${clientId}/${feature.path}`;
  return pathname === base || pathname.startsWith(base + "/");
}
