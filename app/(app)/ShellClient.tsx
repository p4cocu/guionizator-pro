"use client";

import { useState, useCallback, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import ThemeToggle from "@/components/ThemeToggle";
import styles from "./shell.module.css";

export default function ShellClient({
  email,
  children,
}: {
  email?: string | null;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const close = useCallback(() => setSidebarOpen(false), []);
  const toggle = useCallback(() => setSidebarOpen((v) => !v), []);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <div className={styles.shell}>
      <Sidebar isOpen={sidebarOpen} onClose={close} />
      {sidebarOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={close}
          aria-hidden="true"
        />
      )}
      <div className={styles.main}>
        <Topbar email={email} onMenuToggle={toggle} />
        <div className={`${styles.content} blueprint`}>
          <div className={styles.inner}>{children}</div>
        </div>
      </div>
      <ThemeToggle />
    </div>
  );
}
