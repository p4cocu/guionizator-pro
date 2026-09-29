/**
 * Lectura de la ficha de un producto/servicio para los prompts (migración `0016`).
 *
 * El `product_id` llega del browser (o de un guion que un `collaborator` pudo
 * editar), así que se filtra SIEMPRE por `owner_id` y, cuando se conoce, por
 * `client_id`: sin lo segundo, un guion de la marca A podría terminar
 * promoviendo el servicio de la marca B del mismo dueño.
 *
 * Nunca lanza: un servicio que no se encuentra (borrado, de otra marca) se
 * trata como "sin servicio" y se genera igual con el perfil de la marca.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_COLUMNS, type Product } from "./fields";
import { buildProductContext } from "@/lib/ai/productContext";

export async function loadProduct(
  supabase: SupabaseClient,
  opts: { productId: string | null | undefined; ownerId: string; clientId?: string | null },
): Promise<Product | null> {
  if (!opts.productId) return null;

  let query = supabase
    .from("client_products")
    .select(PRODUCT_COLUMNS)
    .eq("id", opts.productId)
    .eq("owner_id", opts.ownerId);
  if (opts.clientId) query = query.eq("client_id", opts.clientId);

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("[products/load] no se pudo leer la ficha:", error.message);
    return null;
  }
  return (data as unknown as Product | null) ?? null;
}

/** Atajo: la ficha ya convertida en bloque de prompt, o `null`. */
export async function loadProductContext(
  supabase: SupabaseClient,
  opts: { productId: string | null | undefined; ownerId: string; clientId?: string | null },
): Promise<string | null> {
  const product = await loadProduct(supabase, opts);
  return product ? buildProductContext(product) : null;
}
