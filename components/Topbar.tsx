"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Topbar.module.css";
import LogoutButton from "./LogoutButton";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/clientes": "Clientes",
  "/guiones": "Guiones",
  "/prompts": "Prompts de imagen",
  "/cerebro": "Cerebro",
  "/perfil": "Tu perfil",
};

function titleFor(pathname: string): string {
  const match = Object.keys(TITLES).find(
    (k) => pathname === k || pathname.startsWith(k + "/"),
  );
  return match ? TITLES[match] : "Guionizator Pro";
}

type Props = {
  email?: string | null;
  onMenuToggle?: () => void;
};

export default function Topbar({ email, onMenuToggle }: Props) {
  const pathname = usePathname();
  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button
          className={styles.menuBtn}
          onClick={onMenuToggle}
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <h1 className={styles.title}>{titleFor(pathname)}</h1>
      </div>
      <div className={styles.right}>
        {email && (
          // Link al perfil desde la etapa 9 (mismo criterio que la topbar del
          // portal): el email es donde uno busca su cuenta.
          <Link href="/perfil" className={styles.user} title={`${email} — tu perfil`}>
            {email}
          </Link>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}
