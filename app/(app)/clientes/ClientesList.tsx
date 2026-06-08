import Link from "next/link";
import ClienteCard from "./ClienteCard";
import s from "./clientes.module.css";

type Cliente = {
  id: string;
  nombre: string;
  marca: string | null;
  nicho: string | null;
  tono: string | null;
  completeness: number;
};

type Props = {
  clientes: Cliente[];
};

export default function ClientesList({ clientes }: Props) {
  if (clientes.length === 0) {
    return (
      <div className={s.grid}>
        <div className={s.empty}>
          <div className={s.emptyIcon}>🎯</div>
          <h3 className={s.emptyTitle}>Sin clientes todavía</h3>
          <p className={s.emptyText}>
            Agrega tu primer cliente para que el cerebro genere guiones específicos para su marca, nicho y tono.
          </p>
          <Link href="/clientes/nuevo" className="btn btn-primary">
            + Nuevo cliente
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={s.grid}>
      {clientes.map((c) => (
        <ClienteCard key={c.id} {...c} />
      ))}
    </div>
  );
}
