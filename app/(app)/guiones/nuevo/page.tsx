import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NuevoGuionForm from "./NuevoGuionForm";
import NuevaPublicacionForm from "./NuevaPublicacionForm";
import { PRODUCT_COLUMNS, toProductOption, type Product } from "@/lib/products/fields";
import styles from "../guiones.module.css";

/**
 * Dos formas de que nazca una pieza:
 *
 *   - "Generar guion" (por defecto): el flujo de siempre, brief → Big Idea →
 *     estructuras → guion.
 *   - "Ya grabé el video" (`?modo=externa`): el video se hizo FUERA de la app y
 *     lo único que hace falta es el copy y la portada (migración `0014`).
 *
 * Las pestañas son links y no estado de cliente a propósito: `NuevoGuionForm`
 * son 1000+ líneas y no tiene sentido montarlo para registrar una publicación
 * externa.
 */
export default async function NuevoGuionPage({
  searchParams,
}: {
  searchParams: Promise<{
    brief?: string;
    client_id?: string;
    calendar_id?: string;
    type?: string;
    source_post_permalink?: string;
    source_post_id?: string;
    /** Servicio preelegido (viene de Competencia → Adaptar, migración 0016). */
    product_id?: string;
    modo?: string;
  }>;
}) {
  const {
    brief,
    client_id,
    calendar_id,
    type,
    source_post_permalink,
    source_post_id,
    product_id,
    modo,
  } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esExterna = modo === "externa";

  const [{ data: clientes }, { data: productRows }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, nombre, marca")
      .eq("owner_id", user!.id)
      .order("nombre"),
    // Los servicios de TODAS las marcas: el formulario filtra por la elegida y
    // así cambiar de marca no necesita otro viaje. Son pocas filas.
    esExterna
      ? Promise.resolve({ data: [] })
      : supabase
          .from("client_products")
          .select(PRODUCT_COLUMNS)
          .eq("owner_id", user!.id)
          .order("created_at", { ascending: true }),
  ]);

  const products = ((productRows ?? []) as unknown as Product[]).map(toProductOption);

  return (
    <div className={styles.formPage}>
      <div className={styles.formHeader}>
        <Link href="/guiones" className={styles.formBack}>
          ← Guiones
        </Link>
        <h1 className={styles.formTitle}>
          {esExterna ? "Nueva publicación" : "Nuevo guion"}
        </h1>
      </div>

      <div className={styles.modeTabs}>
        <Link
          href="/guiones/nuevo"
          className={`${styles.modeTab} ${!esExterna ? styles.modeTabActive : ""}`}
        >
          ✦ Generar guion
        </Link>
        <Link
          href="/guiones/nuevo?modo=externa"
          className={`${styles.modeTab} ${esExterna ? styles.modeTabActive : ""}`}
        >
          ⏺ Ya grabé el video
        </Link>
      </div>

      {!clientes?.length ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ marginBottom: 16, color: "var(--text-muted)" }}>
            Necesitas al menos un cliente para generar guiones.
          </p>
          <Link href="/clientes/nuevo" className="btn btn-primary">
            Crear cliente
          </Link>
        </div>
      ) : esExterna ? (
        <NuevaPublicacionForm clientes={clientes} initialClientId={client_id} />
      ) : (
        <NuevoGuionForm
          clientes={clientes}
          products={products}
          initialProductId={product_id}
          initialBrief={brief}
          initialClientId={client_id}
          initialCalendarId={calendar_id}
          initialType={type === "carousel" ? "carousel" : type === "reel" ? "reel" : undefined}
          initialSourcePostPermalink={source_post_permalink}
          initialSourcePostId={source_post_id}
        />
      )}
    </div>
  );
}
