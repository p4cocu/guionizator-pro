"use client";

import { useState } from "react";
import styles from "./guiones.module.css";

export default function ScriptIdChip({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button className={styles.idChip} onClick={copy} title={id}>
      {copied ? "✓ copiado" : `ID: ${id.slice(0, 8)}…`}
    </button>
  );
}
