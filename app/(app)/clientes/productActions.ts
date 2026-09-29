"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MODEL_FAST } from "@/lib/ai/anthropic";
import { AiJsonError, generateJsonPlain } from "@/lib/ai/json";
import {
  LANDING_TEXT_MAX,
  PRODUCT_EXTRACT_SYSTEM,
  buildProductExtractPrompt,
  normalizeProductExtract,
} from "@/lib/ai/productPrompts";
import {
  PRODUCT_COLUMNS,
  PRODUCT_FIELD_MAX,
  sanitizeProductDetails,
  type Product,
  type ProductDetails,
  type ProductTipo,
} from "@/lib/products/fields";

/**
 * Productos y servicios de una marca + su ficha de oferta (migración `0016`).
 *
 * Todo va con la sesión del dueño: la policy "owners can manage their
 * client_products" ya lo cubre, y cada consulta repite `owner_id` igual que el
 * resto de `clientes/actions.ts`.
 */

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

function cleanTipo(tipo: string): ProductTipo {
  // `client_products.tipo` tiene CHECK en la base: nunca mandar otra cosa.
  return tipo === "producto" ? "producto" : "servicio";
}

/** Devuelve la fila completa: la ficha se abre sola para seguir llenándola. */
export async function addProduct(input: {
  clientId: string;
  nombre: string;
  descripcion: string;
  tipo: ProductTipo;
}): Promise<Product> {
  const { supabase, user } = await getAuthUser();
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre es obligatorio.");

  const { data, error } = await supabase
    .from("client_products")
    .insert({
      client_id: input.clientId,
      owner_id: user.id,
      nombre: nombre.slice(0, 200),
      descripcion: input.descripcion.trim().slice(0, PRODUCT_FIELD_MAX) || null,
      tipo: cleanTipo(input.tipo),
    })
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/clientes/${input.clientId}`);
  return data as unknown as Product;
}

export async function updateProduct(input: {
  productId: string;
  clientId: string;
  nombre: string;
  descripcion: string;
  tipo: ProductTipo;
  details: Partial<ProductDetails>;
}): Promise<Product> {
  const { supabase, user } = await getAuthUser();
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre es obligatorio.");

  const { data, error } = await supabase
    .from("client_products")
    .update({
      nombre: nombre.slice(0, 200),
      descripcion: input.descripcion.trim().slice(0, PRODUCT_FIELD_MAX) || null,
      tipo: cleanTipo(input.tipo),
      ...sanitizeProductDetails(input.details as Record<string, unknown>),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.productId)
    .eq("owner_id", user.id)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/clientes/${input.clientId}`);
  return data as unknown as Product;
}

/**
 * Borra el servicio. Los guiones hechos para él NO se borran: `scripts.product_id`
 * es `on delete set null`, solo pierden la etiqueta.
 */
export async function deleteProduct(productId: string, clientId: string) {
  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("client_products")
    .delete()
    .eq("id", productId)
    .eq("owner_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath(`/clientes/${clientId}`);
}

/**
 * Guarda UN campo de la ficha. Lo usa "Nuevo guion" cuando respondes una
 * pregunta de afinado y marcas "guardar en la ficha": así no te lo vuelve a
 * preguntar el próximo guion.
 */
export async function saveProductField(input: {
  productId: string;
  field: string;
  value: string;
}): Promise<void> {
  const { supabase, user } = await getAuthUser();
  const patch = sanitizeProductDetails({ [input.field]: input.value });
  if (Object.keys(patch).length === 0) throw new Error("Campo desconocido.");

  const { data, error } = await supabase
    .from("client_products")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", input.productId)
    .eq("owner_id", user.id)
    .select("client_id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/clientes/${data.client_id as string}`);
}

/**
 * Propone la ficha a partir del texto pegado de una landing. **No guarda**:
 * devuelve la propuesta y la pantalla la mete en el formulario para que la
 * revises. Un dato mal extraído que se guarda solo termina, sin que nadie lo
 * vea, dentro de todos los guiones de ese servicio.
 *
 * `MODEL_FAST` porque corre síncrona dentro de la Netlify Function (~26-30s).
 */
export async function extractProductFromLanding(input: {
  nombre: string;
  text: string;
}): Promise<{ descripcion: string | null; details: Partial<ProductDetails> }> {
  await getAuthUser();
  const text = input.text.trim();
  if (text.length < 80) {
    throw new Error("Pega más texto de la landing (al menos un par de párrafos).");
  }

  try {
    const raw = await generateJsonPlain({
      label: "product-extract",
      model: MODEL_FAST,
      maxTokens: 2048,
      system: PRODUCT_EXTRACT_SYSTEM,
      userMessage: buildProductExtractPrompt({
        nombre: input.nombre.trim() || "(sin nombre)",
        text: text.slice(0, LANDING_TEXT_MAX),
      }),
    });
    return normalizeProductExtract(raw);
  } catch (e) {
    if (e instanceof AiJsonError) {
      throw new Error("La IA no devolvió una ficha válida. Intenta de nuevo.");
    }
    throw e;
  }
}

/** Lista para selectores (Competencia → Adaptar). */
export async function getProductOptions(
  clientId: string,
): Promise<Pick<Product, "id" | "nombre" | "tipo">[]> {
  const { supabase, user } = await getAuthUser();
  const { data } = await supabase
    .from("client_products")
    .select("id, nombre, tipo")
    .eq("client_id", clientId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });
  return (data ?? []) as Pick<Product, "id" | "nombre" | "tipo">[];
}
