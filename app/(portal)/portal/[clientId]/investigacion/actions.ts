"use server";

/**
 * Editar la ficha de un servicio desde el portal (migración `0016`).
 *
 * ⚠️ En un módulo `"use server"` solo se exportan funciones async (regla de
 * CLAUDE.md): nada de `export type` ni `export const` acá.
 *
 * El candado y la escritura viven en `lib/portal/products.ts`: `collaborator`
 * o dueño, marca pagada, y el update con service role filtrando `client_id`
 * a mano. Solo ficha y descripción — nombre, tipo, altas y bajas son del
 * estudio.
 */

import { revalidatePath } from "next/cache";
import { rethrowIfNextControlFlow } from "@/lib/portal/generate";
import {
  PortalProductError,
  requireProductEditor,
  updatePortalProduct,
} from "@/lib/portal/products";
import type { Product, ProductDetails } from "@/lib/products/fields";

export async function guardarFichaServicio(input: {
  clientId: string;
  productId: string;
  descripcion: string;
  details: Partial<ProductDetails>;
}): Promise<{ ok: true; product: Product } | { ok: false; error: string }> {
  try {
    await requireProductEditor(input.clientId);
    const product = await updatePortalProduct({
      clientId: input.clientId,
      productId: input.productId,
      descripcion: input.descripcion,
      details: input.details,
    });
    revalidatePath(`/portal/${input.clientId}/investigacion`);
    // La ficha también la ve Paco en el estudio.
    revalidatePath(`/clientes/${input.clientId}`);
    return { ok: true, product };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    if (e instanceof PortalProductError) return { ok: false, error: e.message };
    console.error("[portal/investigacion/ficha]", e);
    return { ok: false, error: "No se pudo guardar la ficha." };
  }
}
