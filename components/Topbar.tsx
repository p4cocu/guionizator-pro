"use client";

import { usePathname } from "next/navigation";
import styles from "./Topbar.module.css";
import LogoutButton from "./LogoutButton";

const TITLES: Record<string, string> = {
  "/dashboard": "Inicio",
  "/clientes": "Clientes",
  "/guiones": "Guiones",
  "/cerebro": "Cerebro",
};

function titleFor(pathname: string): string {
  const match = Object.keys(TITLES).find(
    (k) => pathname === k || pathname.startsWith(k + "/"),
  );
  return match ? TITLES[match] : "Guionizator Pro";
}

export default function Topbar({ email }: { email?: string | null }) {
  const pathname = usePathname();
  return (
    <header className={styles.topbar}>
      <h1 className={styles.title}>{titleFor(pathname)}</h1>
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
