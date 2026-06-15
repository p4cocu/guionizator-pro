"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

type NavItem = {
  href: string;
  label: string;
  phase?: string;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clientes", label: "Clientes", phase: "F2" },
  { href: "/guiones", label: "Guiones", phase: "F3" },
  { href: "/prompts", label: "Prompts", phase: "F4" },
  { href: "/instagram", label: "Instagram", phase: "F5" },
  { href: "/competencia", label: "Competencia", phase: "F5" },
  { href: "/cerebro", label: "Cerebro", phase: "F1" },
];

type Props = {
  isOpen?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ isOpen, onClose }: Props) {
  const pathname = usePathname();

  return (
    <aside
      className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""} sidebar-dark-scope`}
    >
      <div className={styles.brand}>
        <img
          src="https://res.cloudinary.com/dghuokhlw/image/upload/v1781072303/favicon1_dkjxxm.jpg"
          alt=""
          aria-hidden="true"
          className={`${styles.brandIcon} ${styles.brandIconLight}`}
        />
        <img
          src="https://res.cloudinary.com/dghuokhlw/image/upload/v1781072303/favicon2_tljxof.jpg"
          alt="Guionizator"
          className={`${styles.brandIcon} ${styles.brandIconDark}`}
        />
        <span className={styles.brandName}>
          Guionizator <span className="text-grad">Pro</span>
        </span>
      </div>

      <nav className={styles.nav}>
        <span className="eyebrow" style={{ paddingLeft: 14, opacity: 0.7 }}>
          Menú
        </span>
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.link} ${active ? styles.active : ""}`}
              onClick={onClose}
            >
              <span>{item.label}</span>
              {item.phase && <span className={styles.phase}>{item.phase}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <span className={styles.dot} />
        <span>v0 · Fase 0</span>
      </div>
    </aside>
  );
}
