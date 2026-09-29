/**
 * La ficha de un producto/servicio (migración `0016`), en markdown, lista para
 * meter en un prompt.
 *
 * Se pega DEBAJO del perfil de la marca (`buildClientContext`): la marca dice
 * cómo habla, el servicio dice qué se está promoviendo. La lectura con filtro
 * de dueño vive en `lib/products/load.ts`; esto es solo texto.
 *
 * Módulo puro.
 */

import { PRODUCT_FIELDS, type Product } from "@/lib/products/fields";

/**
 * Regla anti-invención. Va pegada a los datos, no en el system prompt: es ahí
 * donde el modelo la respeta (mismo criterio que la referencia de competencia
 * en `copyPrompt.ts`). Sin ella, un guion de venta "completa" la prueba social
 * con un "más de 500 clientes felices" que nadie dijo.
 */
const NO_INVENT_RULE =
  "⚠️ Regla dura: NO inventes precios, cifras, resultados, casos, testimonios, garantías ni plazos que no estén en esta ficha. Si un dato no está, no lo menciones.";

export function buildProductContext(p: Pick<Product, "nombre" | "descripcion" | "tipo"> & Partial<Product>): string {
  const label = p.tipo === "producto" ? "Producto" : "Servicio";
  const data = [
    `## ${label} que promueve este contenido: ${p.nombre}`,
    p.descripcion?.trim() ? `**Qué es:** ${p.descripcion.trim()}` : null,
    ...PRODUCT_FIELDS.map((f) => {
      const v = p[f.key];
      return typeof v === "string" && v.trim() ? `**${f.promptLabel}:** ${v.trim()}` : null;
    }),
  ].filter((l): l is string => l !== null);
  return `${data.join("\n")}\n\n${NO_INVENT_RULE}`;
}

/**
 * Instrucción para los pasos del flujo de guion (Big Idea, estructuras, guion)
 * cuando hay un servicio elegido. Va en el mensaje del usuario, junto al brief.
 */
export const PRODUCT_SCRIPT_GUIDANCE = `Este contenido PROMUEVE el servicio/producto de la ficha de arriba:
- El problema, el público y el cierre salen de la ficha, no de supuestos genéricos.
- Aporta valor primero y haz que el servicio aparezca como la solución natural, sin sonar a anuncio.
- Si la ficha trae objeciones, prueba social o un proceso, úsalos donde sumen; si trae CTA, el cierre invita a ESE CTA.`;

/** Concatena perfil de marca + ficha. `null`/vacío = solo la marca. */
export function withProductContext(brandContext: string, productContext: string | null): string {
  return productContext ? `${brandContext}\n\n${productContext}` : brandContext;
}
