import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NuevoGuionForm from "./NuevoGuionForm";
import NuevaPublicacionForm from "./NuevaPublicacionForm";
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
    modo,
  } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: clientes } = await supabase
    .from("clients")
    .select("id, nombre, marca")
    .eq("owner_id", user!.id)
    .order("nombre");

  const esExterna = modo === "externa";

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
