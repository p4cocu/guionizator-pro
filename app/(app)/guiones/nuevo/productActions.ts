"use server";

import { createClient } from "@/lib/supabase/server";
import { MODEL_FAST } from "@/lib/ai/anthropic";
import { AiJsonError, generateJsonPlain } from "@/lib/ai/json";
import { buildClientContext } from "@/lib/ai/clientContext";
import { buildProductContext } from "@/lib/ai/productContext";
import {
  PRODUCT_IDEAS_SYSTEM,
  PRODUCT_QUESTIONS_SYSTEM,
  buildProductIdeasPrompt,
  buildProductQuestionsPrompt,
  normalizeProductIdeas,
  normalizeProductQuestions,
  type ProductIdea,
  type ProductQuestion,
} from "@/lib/ai/productPrompts";
import { missingKeyFields } from "@/lib/products/fields";
import { loadProduct } from "@/lib/products/load";

/**
 * La IA alrededor del servicio elegido en `/guiones/nuevo` (migración `0016`).
 *
 * Las dos van con `MODEL_FAST`: corren síncronas dentro de la Netlify Function
 * (~26-30s) mientras el usuario espera en el paso 1.
 */

async function loadBrandAndProduct(clientId: string, productId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const [{ data: client }, product] = await Promise.all([
    supabase
      .from("clients")
      .select("nombre, marca, que_vende, cliente_ideal, nicho, dolor, deseo, tono, notas")
      .eq("id", clientId)
      .eq("owner_id", user.id)
      .maybeSingle(),
    loadProduct(supabase, { productId, ownerId: user.id, clientId }),
  ]);

  if (!client) throw new Error("Esa marca no existe o no es tuya.");
  if (!product) throw new Error("Ese servicio ya no existe en esta marca.");
  return { client, product };
}

/**
 * "Dame ideas para este servicio": 9 ideas (3 por etapa del embudo). No se
 * guardan: elegir una llena el brief y el flujo sigue igual que siempre.
 */
export async function suggestProductIdeas(input: {
  client_id: string;
  product_id: string;
  type: "reel" | "carousel" | null;
  brief?: string | null;
}): Promise<ProductIdea[]> {
  const { client, product } = await loadBrandAndProduct(input.client_id, input.product_id);

  try {
    const raw = await generateJsonPlain({
      label: "product-ideas",
      model: MODEL_FAST,
      maxTokens: 3000,
      system: PRODUCT_IDEAS_SYSTEM,
      userMessage: buildProductIdeasPrompt({
        brandContext: buildClientContext(client),
        productContext: buildProductContext(product),
        preferredType: input.type,
        currentBrief: input.brief ?? null,
      }),
    });
    const ideas = normalizeProductIdeas(raw);
    if (ideas.length === 0) throw new Error("La IA no devolvió ideas. Intenta de nuevo.");
    return ideas;
  } catch (e) {
    if (e instanceof AiJsonError) throw new Error("La IA no devolvió ideas válidas. Intenta de nuevo.");
    throw e;
  }
}

/**
 * 1-2 preguntas sobre los campos clave que le faltan a la ficha. Igual que
 * `suggestCopyQuestions`: **nunca lanza por culpa del modelo** — si algo sale
 * mal devuelve `[]` y el flujo sigue directo a la Big Idea.
 */
export async function suggestProductQuestions(input: {
  client_id: string;
  product_id: string;
  brief: string;
}): Promise<ProductQuestion[]> {
  const { client, product } = await loadBrandAndProduct(input.client_id, input.product_id);

  const missing = missingKeyFields(product);
  if (missing.length === 0) return [];

  try {
    const raw = await generateJsonPlain({
      label: "product-questions",
      model: MODEL_FAST,
      maxTokens: 600,
      system: PRODUCT_QUESTIONS_SYSTEM,
      userMessage: buildProductQuestionsPrompt({
        brandContext: buildClientContext(client),
        productContext: buildProductContext(product),
        missing,
        brief: input.brief,
      }),
    });
    return normalizeProductQuestions(raw, missing);
  } catch (e) {
    if (e instanceof AiJsonError) return [];
    throw e;
  }
}
