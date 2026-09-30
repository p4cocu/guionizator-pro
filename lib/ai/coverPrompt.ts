/**
 * El prompt de portadas — **una sola definición** para el estudio
 * (`/api/ai/cover`) y el portal (`lib/portal/scriptTools.ts`).
 *
 * Antes estaba copiado en los dos lados, con la excusa de que la ruta es un
 * handler y no un módulo importable. El precio se vio el 2026-09-29: el estudio
 * empezó a mandar el servicio del guion (migración 0016) y el portal no, así que
 * el cliente recibía portadas con otro criterio que las de Paco. Mismo arreglo
 * que el copy (`copyPrompt.ts`, 0014): el TEXTO vive acá; lo que sigue separado
 * es la EJECUCIÓN (el portal lee con service role y cobra cupo).
 *
 * SERVER-ONLY: lee la guía de `knowledge/` con `fs`. Para que exista en
 * producción, `next.config.ts` incluye `knowledge/**` en el tracing de las
 * rutas que lo usan.
 */

import fs from "fs";
import path from "path";
import type { Product } from "@/lib/products/fields";

export type CoverIdea = {
  has_character: boolean;
  medium: string;
  subject: string;
  action: string;
  environment: string;
  style_vibe: string;
  technical_specs: string;
  prompt_en: string;
  cover_text: string;
  rationale_es: string;
};

export const COVER_SYSTEM = `Eres un experto en diseño de portadas de alto CTR para Reels y carruseles de Instagram.
Dominas neurociencia del scroll, copywriting de hooks y especificaciones técnicas de generadores de imagen IA (Flux, Midjourney, GPT-Image, Stable Diffusion).

Recibirás una guía de referencia sobre qué hace que una portada tenga alto CTR (safe zones, contraste, rostro vs. tipografía, regla de las 6 palabras, fórmulas de hook) y el contenido de un guion de Reel o carrusel.

Tu tarea: proponer EXACTAMENTE 3 conceptos de portada distintos entre sí, directamente relacionados con el contenido del guion, siguiendo la estructura de prompt:
[medium], [subject], [action/pose], [environment], [style/vibe], [technical specs]

Regla dura sobre personajes: de las 3 portadas, EXACTAMENTE 1 o 2 (nunca 0, nunca 3) deben incluir una referencia a colocar un personaje/rostro humano en la portada (con emoción extrema y clara, según la guía). El resto debe ser diseño tipográfico/color-block limpio, sin personaje.

Cada concepto debe traer también un "cover_text" (el texto que iría sobreimpreso en la portada, siguiendo la regla de las 6 palabras y alguna fórmula de hook de la guía) y una "rationale_es" breve (1-2 oraciones) explicando por qué esa portada es de alto CTR para este contenido específico.

Siempre devuelves un JSON válido. El prompt_en debe estar en inglés, listo para pegar en cualquier generador de imágenes. cover_text y rationale_es en español latinoamericano.`;

/**
 * Haiku 4.5 en los dos lados: Sonnet tardaba ~30s con la guía entera y daba 504
 * contra el límite de las funciones síncronas de Netlify.
 */
export const COVER_MAX_TOKENS = 1600;

/**
 * La guía de portadas de alto CTR. Si el archivo no está en el bundle, se
 * genera igual (con menos contexto) en vez de fallar.
 */
export function readCoverKnowledge(): string {
  try {
    return fs.readFileSync(
      path.join(process.cwd(), "knowledge", "portadas-reels-carruseles-alto-ctr.md"),
      "utf-8",
    );
  } catch {
    return "";
  }
}

function summarizeContent(type: string | null, content: Record<string, unknown> | null): string {
  if (type !== "carousel") {
    const voiceOff = typeof content?.voice_off === "string" ? content.voice_off : "";
    return voiceOff.slice(0, 2000);
  }
  const slides = Array.isArray(content?.slides) ? (content!.slides as unknown[]) : [];
  return slides
    .map((raw) => {
      const s = (raw ?? {}) as { number?: number; text?: string; body?: string };
      return `Slide ${s.number ?? "?"}: ${s.text ?? ""}${s.body ? ` — ${s.body}` : ""}`;
    })
    .join("\n")
    .slice(0, 2000);
}

/**
 * El servicio del guion (0016) en UNA línea: la portada vende el gancho, no la
 * ficha entera, y la ruta va justa contra el límite de Netlify.
 */
export function coverProductLine(
  product: Pick<Product, "nombre" | "para_quien" | "problema"> | null,
): string | null {
  if (!product) return null;
  return `Servicio que promueve: ${product.nombre}${
    product.para_quien ? ` (para: ${product.para_quien})` : ""
  }${product.problema ? ` — resuelve: ${product.problema}` : ""}`.slice(0, 400);
}

export function buildCoverPrompt(input: {
  type: string | null;
  brief: string | null;
  structureName: string | null;
  content: Record<string, unknown> | null;
  productLine?: string | null;
}): string {
  const { type, brief, structureName, content, productLine } = input;
  return `GUÍA DE REFERENCIA — QUÉ HACE UNA PORTADA DE ALTO CTR:
${readCoverKnowledge()}

---

GUION A CUBRIR:
Tipo: ${type === "carousel" ? "Carrusel (primera diapositiva, formato 4:5)" : "Reel (formato 9:16 vertical)"}
Estructura narrativa: ${structureName?.trim() || "—"}
Brief: ${brief?.trim() || "—"}
${productLine ? `${productLine}\n` : ""}
Contenido del guion:
${summarizeContent(type, content)}

---

Genera EXACTAMENTE 3 conceptos de portada para este contenido, relacionados directamente con él, siguiendo la estructura [medium], [subject], [action/pose], [environment], [style/vibe], [technical specs]. Recuerda: 1 o 2 (no 0, no 3) deben tener personaje/rostro humano.

Devuelve ÚNICAMENTE este JSON (sin markdown, sin explicaciones), un array de 3 objetos:
[
  {
    "has_character": true o false,
    "medium": "...",
    "subject": "...",
    "action": "...",
    "environment": "...",
    "style_vibe": "...",
    "technical_specs": "...",
    "prompt_en": "el prompt completo en inglés ensamblando los 6 campos anteriores, listo para pegar en un generador de imágenes",
    "cover_text": "texto corto sugerido para sobreimprimir en la portada (5-6 palabras, en español)",
    "rationale_es": "por qué esta portada es de alto CTR para este contenido específico"
  }
]`;
}
