/**
 * Pestañas de la sección Guiones: lo que está en proceso vs. lo ya subido.
 *
 * Son links (no estado de cliente) por la misma razón que las de
 * `/guiones/nuevo`: cada vista es una consulta distinta y se resuelve en el
 * servidor. Se arrastran `cliente` y `tipo` para no perder el filtro al
 * cambiar de pestaña; el filtro de estado no, porque en "Hechos" el estado
 * está fijo en `publicado`.
 */

import Link from "next/link";
import styles from "./guiones.module.css";

export default function GuionesTabs({
  active,
  cliente,
  tipo,
  doneCount,
}: {
  active: "proceso" | "hechos";
  cliente?: string;
  tipo?: string;
  doneCount: number;
}) {
  const p = new URLSearchParams();
  if (cliente) p.set("cliente", cliente);
  if (tipo) p.set("tipo", tipo);
  const qs = p.toString();
  const suffix = qs ? `?${qs}` : "";

  return (
    <div className={styles.modeTabs}>
      <Link
        href={`/guiones${suffix}`}
        className={`${styles.modeTab} ${active === "proceso" ? styles.modeTabActive : ""}`}
      >
        ✍️ En proceso
      </Link>
      <Link
        href={`/guiones/hechos${suffix}`}
        className={`${styles.modeTab} ${active === "hechos" ? styles.modeTabActive : ""}`}
      >
        ✓ Hechos{doneCount > 0 ? ` · ${doneCount}` : ""}
      </Link>
    </div>
  );
}
