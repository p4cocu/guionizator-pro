"use client";

import { useState, useTransition } from "react";
import { toggleScriptFeatured } from "./actions";
import styles from "./guiones.module.css";

export default function StarButton({
  scriptId,
  featured,
}: {
  scriptId: string;
  featured: boolean;
}) {
  const [on, setOn] = useState(featured);
  const [pending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    // La tarjeta es un <Link>: evitamos navegar al togglear la estrella.
    e.preventDefault();
    e.stopPropagation();
    const next = !on;
    setOn(next); // optimista
    startTransition(async () => {
      try {
        await toggleScriptFeatured(scriptId, next);
      } catch {
        setOn(!next); // revertir si falla
      }
    });
  }

  return (
    <button
      type="button"
      className={`${styles.starBtn} ${on ? styles.starBtnOn : ""}`}
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      aria-label={on ? "Quitar destacado" : "Destacar guion"}
      title={on ? "Quitar destacado" : "Destacar (desarrollar pronto)"}
    >
      {on ? "★" : "☆"}
    </button>
  );
}
