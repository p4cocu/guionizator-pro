"use client";

import { usePathname } from "next/navigation";
import styles from "./Topbar.module.css";
import LogoutButton from "./LogoutButton";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/clientes": "Clientes",
  "/guiones": "Guiones",
  "/prompts": "Prompts de imagen",
  "/cerebro": "Cerebro",
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
          <span className={styles.user} title={email}>
            {email}
          </span>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}
