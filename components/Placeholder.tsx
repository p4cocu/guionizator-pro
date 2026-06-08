import styles from "./Placeholder.module.css";

export default function Placeholder({
  phase,
  title,
  description,
}: {
  phase: string;
  title: string;
  description: string;
}) {
  return (
    <div className={`card ${styles.box}`}>
      <span className="badge badge--emerald">Próximamente · {phase}</span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.desc}>{description}</p>
      <hr className="rule-yellow" />
    </div>
  );
}
