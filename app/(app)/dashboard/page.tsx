import Link from "next/link";
import styles from "./dashboard.module.css";

const PHASES = [
  { id: "F0", label: "Setup, marca, login y deploy", done: true },
  { id: "F1", label: "Cerebro + knowledge + Claude", done: false },
  { id: "F2", label: "Clientes (cliente ideal, nicho…)", done: false },
  { id: "F3", label: "Generación de guiones (3 estructuras)", done: false },
  { id: "F4", label: "Edición IA + manual", done: false },
  { id: "F5", label: "Mejora continua / investigación", done: false },
];

export default function DashboardPage() {
  return (
    <div className={styles.page}>
      <section>
        <p className="eyebrow">Bienvenido</p>
        <h2 className={styles.h2}>
          Tu estudio de <span className="text-grad">guiones</span> está en pie.
        </h2>
        <p className={styles.lead}>
          Esqueleto de Fase 0 listo: identidad de marca, autenticación y shell de
          la app. Las próximas fases activan el cerebro, los clientes y la
          generación de guiones.
        </p>
      </section>

      <section className={styles.grid}>
        <Link href="/clientes" className={`card ${styles.cardLink}`}>
          <span className="badge badge--emerald">Fase 2</span>
          <h3 className={styles.cardTitle}>Clientes</h3>
          <p className={styles.cardDesc}>
            Define cliente ideal, nicho, dolor, deseo y tono por marca.
          </p>
        </Link>
        <Link href="/guiones" className={`card ${styles.cardLink}`}>
          <span className="badge badge--emerald">Fase 3</span>
          <h3 className={styles.cardTitle}>Guiones</h3>
          <p className={styles.cardDesc}>
            Brief → 3 estructuras → guion de Reel o carrusel.
          </p>
        </Link>
        <Link href="/cerebro" className={`card ${styles.cardLink}`}>
          <span className="badge badge--emerald">Fase 1</span>
          <h3 className={styles.cardTitle}>Cerebro</h3>
          <p className={styles.cardDesc}>
            El prompt maestro de guionista, editable y versionado.
          </p>
        </Link>
      </section>

      <section className={`card ${styles.roadmap}`}>
        <p className="eyebrow">Hoja de ruta</p>
        <ul className={styles.phaseList}>
          {PHASES.map((p) => (
            <li key={p.id} className={styles.phaseItem}>
              <span
                className={`${styles.phaseDot} ${p.done ? styles.phaseDotDone : ""}`}
              />
              <span className={styles.phaseId}>{p.id}</span>
              <span className={styles.phaseLabel}>{p.label}</span>
              {p.done && <span className={styles.phaseTag}>Listo</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
