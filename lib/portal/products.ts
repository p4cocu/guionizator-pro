/**
 * La ficha de servicio desde el portal (migración `0016`).
 *
 * El miembro **lee** `client_products` con su sesión (policy
 * `client_products_member_select`, ya existía desde `0006`), pero **no tiene
 * update**: darle una policy de update le dejaría tocar cualquier columna de
 * cualquier producto de su marca desde PostgREST, `client_id` incluido. Por eso
 * la edición va con service role y acá se filtra la marca a mano — mismo patrón
 * que la estrella de Competencia (`lib/portal/competencia.ts`).
 *
 * Quién edita: `collaborator` o el dueño. Un `viewer` ve la ficha pero no la
 * toca — mismo criterio que aprobar, editar guiones y la estrella.
 *
 * Qué edita: la descripción y los diez campos de la ficha. **No** el nombre,
 * el tipo, ni altas o bajas: el catálogo lo maneja Paco desde el estudio.
 *
 * SERVER-ONLY.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../supabase/service";
import { getPortalClient, requirePortalSession, type PortalClient } from "./access";
import { AI_FEATURE_SLUG, hasFeature } from "./features";
import { billingMessage, getBillingState } from "../billing/access";
import {
  PRODUCT_COLUMNS,
  PRODUCT_FIELD_MAX,
  sanitizeProductDetails,
  type Product,
  type ProductDetails,
} from "../products/fields";

export class PortalProductError extends Error {}

/** Los servicios de la marca, con la sesión del miembro (la RLS alcanza). */
export async function listPortalProducts(
  supabase: SupabaseClient,
  clientId: string,
): Promise<Product[]> {
  const { data, error } = await supabase
    .from("client_products")
    .select(PRODUCT_COLUMNS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[portal/products] no se pudieron leer los servicios:", error.message);
    return [];
  }
  return (data ?? []) as unknown as Product[];
}

/**
 * Candado de la edición. Server action = endpoint público: se revalida todo,
 * no alcanza con que la pantalla no dibuje el botón.
 *
 * Se acepta desde dos secciones: Investigación (donde vive la ficha) y Generar
 * (donde se contestan las preguntas de afinado y se ofrece guardarlas).
 */
export async function requireProductEditor(clientId: string): Promise<PortalClient> {
  const { user } = await requirePortalSession();
  const client = await getPortalClient(user.id, clientId);
  if (!client) throw new PortalProductError("Esa marca no existe.");

  if (!hasFeature(client.features, "investigacion") && !hasFeature(client.features, AI_FEATURE_SLUG)) {
    throw new PortalProductError("Esta sección no está habilitada para tu marca.");
  }
  if (client.role === "viewer") {
    throw new PortalProductError("Tu acceso es de solo lectura.");
  }
  if (client.role !== "owner") {
    const billing = await getBillingState(clientId);
    if (!billing.ok) throw new PortalProductError(billingMessage(billing));
  }
  return client;
}

export async function updatePortalProduct(input: {
  clientId: string;
  productId: string;
  descripcion?: string | null;
  details: Partial<ProductDetails>;
}): Promise<Product> {
  const patch: Record<string, unknown> = {
    ...sanitizeProductDetails(input.details as Record<string, unknown>),
    updated_at: new Date().toISOString(),
  };
  if (input.descripcion !== undefined) {
    patch.descripcion = (input.descripcion ?? "").trim().slice(0, PRODUCT_FIELD_MAX) || null;
  }

  const { data, error } = await createServiceClient()
    .from("client_products")
    .update(patch)
    .eq("id", input.productId)
    // ⚠️ El service role saltea la RLS: este filtro es lo único que impide
    // editar el servicio de otra marca con un id ajeno.
    .eq("client_id", input.clientId)
    .select(PRODUCT_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new PortalProductError("Ese servicio ya no existe.");
  return data as unknown as Product;
}
