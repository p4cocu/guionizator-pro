/**
 * `/portal/[clientId]/investigacion` — el perfil de marca y la investigación
 * cargada, en solo lectura.
 *
 * Candado 2: revalida el flag `investigacion` antes de consultar.
 *
 * ⚠️ De la marca solo se muestra lo que trae la vista `portal_clients`
 * (nombre, marca, nicho). El resto de `clients` —notas internas incluidas— no
 * se lee ni se puede leer: el miembro no tiene policy de select sobre esa
 * tabla. Si algún día hace falta mostrar más campos, se agregan a la vista en
 * una migración, no con un `select` a `clients`.
 */

import { requirePortalClient, requirePortalSession, portalClientLabel } from "@/lib/portal/access";
import s from "./investigacion.module.css";

type Research = { id: string; fuente: string; resumen: string; created_at: string };
type Product = {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: string | null;
};

export default async function PortalInvestigacionPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { supabase, user } = await requirePortalSession();
  const client = await requirePortalClient(user.id, clientId, "investigacion");

  const [{ data: research }, { data: products }] = await Promise.all([
    supabase
      .from("client_research")
      .select("id, fuente, resumen, created_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_products")
      .select("id, nombre, descripcion, tipo")
      .eq("client_id", client.id)
      .order("created_at", { ascending: true }),
  ]);

  const investigacion = (research ?? []) as Research[];
  const productos = (products ?? []) as Product[];

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <span className="eyebrow">{portalClientLabel(client)}</span>
        <h2 className={s.title}>Investigación</h2>
        <p className={s.subtitle}>
          Lo que sabemos de tu marca y de tu mercado. Es la base con la que se
          escribe cada guion: si algo de acá no coincide con cómo ves tu negocio,
          dínoslo — cambia todo lo que sale después.
        </p>
      </div>

      <section className={s.section}>
        <h3 className={s.sectionTitle}>Tu marca</h3>
        <dl className={s.facts}>
          <div className={s.fact}>
            <dt>Nombre</dt>
            <dd>{client.nombre}</dd>
          </div>
          {client.marca && (
            <div className={s.fact}>
              <dt>Marca</dt>
              <dd>{client.marca}</dd>
            </div>
          )}
          {client.nicho && (
            <div className={s.fact}>
              <dt>Nicho</dt>
              <dd>{client.nicho}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className={s.section}>
        <h3 className={s.sectionTitle}>
          Qué vendes{productos.length > 0 ? ` (${productos.length})` : ""}
        </h3>
        {productos.length === 0 ? (
          <p className={s.empty}>Todavía no hay productos ni servicios cargados.</p>
        ) : (
          <div className={s.cards}>
            {productos.map((p) => (
              <article key={p.id} className={s.card}>
                <h4 className={s.cardTitle}>{p.nombre}</h4>
                {p.tipo && <span className={s.tipo}>{p.tipo}</span>}
                {p.descripcion && <p className={s.cardBody}>{p.descripcion}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={s.section}>
        <h3 className={s.sectionTitle}>
          Investigación{investigacion.length > 0 ? ` (${investigacion.length})` : ""}
        </h3>
        {investigacion.length === 0 ? (
          <p className={s.empty}>
            Todavía no hay investigación cargada para tu marca.
          </p>
        ) : (
          <div className={s.cards}>
            {investigacion.map((r) => (
              <article key={r.id} className={s.card}>
                <h4 className={s.cardTitle}>{r.fuente}</h4>
                <p className={s.cardBody}>{r.resumen}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
