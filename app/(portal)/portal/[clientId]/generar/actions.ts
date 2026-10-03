"use server";

/**
 * Guardar un guion generado desde el portal (Fase D, etapa 6).
 *
 * ⚠️ NO reexportar tipos desde este archivo (regla de `CLAUDE.md`): en un módulo
 * `"use server"` un `export type` sobrevive al bundle como una referencia que en
 * runtime no existe y revienta la página al cargar.
 *
 * La generación vive en `/api/portal/generar/*` (necesita el `maxDuration` de un
 * route handler). Acá queda solo el guardado, que es instantáneo.
 *
 * `requireGenerationAccess` revalida sesión + acceso a la marca + flag
 * `generar_ia`: una server action es un endpoint público, así que no alcanza con
 * que la pantalla no dibuje el botón.
 *
 * **No cuenta contra el tope**: lo que se cobra es generar, y eso ya se registró
 * cuando la IA respondió. Guardar dos veces el mismo guion no gasta nada (crea
 * dos filas, eso sí — la UI bloquea el botón después del primer guardado).
 */

import { revalidatePath } from "next/cache";
import {
  assertCanGenerate,
  generationErrorInfo,
  getGenerationState,
  PortalGenerationError,
  requireGenerationAccess,
  rethrowIfNextControlFlow,
  saveGeneratedScript,
  settleGeneration,
} from "@/lib/portal/generate";
import { MODEL_FAST } from "@/lib/ai/anthropic";
import { reviewPortalHook } from "@/lib/portal/scriptHooks";
import type { HookReview } from "@/lib/hooks/prompts";
import { AiJsonError, generateJsonPlain } from "@/lib/ai/json";
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
import { PortalProductError, requireProductEditor, updatePortalProduct } from "@/lib/portal/products";

export type GuardarResult = { ok: true; scriptId: string } | { ok: false; error: string };

/** Un guion normal pesa ~3 KB. Esto es un tope grosero contra un payload absurdo. */
const MAX_CONTENT_BYTES = 60_000;
const MAX_TITLE_LENGTH = 200;
const MAX_BRIEF_LENGTH = 4000;

export async function guardarGuion(input: {
  clientId: string;
  type: string;
  brief: string;
  structureName: string;
  title: string | null;
  content: Record<string, unknown>;
  /** Servicio del guion (0016). Se revalida contra la marca antes de guardarlo. */
  productId?: string | null;
}): Promise<GuardarResult> {
  let scriptId: string;

  try {
    const { user, ctx } = await requireGenerationAccess(input.clientId, {
      productId: input.productId,
    });

    if (input.type !== "reel" && input.type !== "carousel") {
      throw new PortalGenerationError("Tipo de contenido desconocido.");
    }
    if (!input.content || typeof input.content !== "object" || Array.isArray(input.content)) {
      throw new PortalGenerationError("El guion llegó vacío. Vuelve a generarlo.");
    }
    // El contenido viaja por el browser, así que llega como lo mande el browser:
    // se acota el tamaño en vez de confiar en que sea lo que devolvió la IA.
    if (JSON.stringify(input.content).length > MAX_CONTENT_BYTES) {
      throw new PortalGenerationError("Ese guion es demasiado grande para guardarlo.");
    }

    scriptId = await saveGeneratedScript({
      clientId: input.clientId,
      ownerId: ctx.ownerId,
      userId: user.id,
      type: input.type,
      brief: input.brief.trim().slice(0, MAX_BRIEF_LENGTH),
      structureName: input.structureName.trim().slice(0, MAX_TITLE_LENGTH) || "Estructura libre",
      title: input.title?.trim().slice(0, MAX_TITLE_LENGTH) || null,
      content: input.content,
      // El cerebro NO viaja por el browser: se resuelve de nuevo en el servidor,
      // así la fila queda atada a la versión que realmente escribió el guion.
      brainVersionId: ctx.brainVersionId,
      productId: ctx.product?.id ?? null,
    });
  } catch (e) {
    // `redirect()` de `requirePortalSession` viaja como excepción: si se la
    // traga este catch, el usuario sin sesión ve "no se pudo guardar" en vez de
    // ir a /login.
    rethrowIfNextControlFlow(e);

    const { message, status } = generationErrorInfo(e);
    if (status >= 500) console.error("[portal/generar/guardar]", e);
    return { ok: false, error: message };
  }

  revalidatePath(`/portal/${input.clientId}/generar`);
  revalidatePath(`/portal/${input.clientId}/guiones`);
  // El guion aparece también en el tablero de Paco, con su badge.
  revalidatePath("/guiones");

  return { ok: true, scriptId };
}

// ─── Servicio: ideas, preguntas de afinado y guardar en la ficha (0016) ─────

type UsageSummary = {
  used: number;
  limit: number | null;
  remaining: number | null;
  creditBalance: number;
  nextSource: "plan" | "credit";
};

/**
 * "Dame ideas para este servicio". **Cuesta 1 generación** (decisión de Paco,
 * 2026-09-30): es una llamada a la IA de ~12s, y gratis sería una canilla
 * abierta con la API key del dueño. Mismo cierre que las otras acciones de
 * pago: `assertCanGenerate` antes, `settleGeneration` después (nunca
 * `logAiGeneration` pelado — ver CLAUDE.md).
 */
export async function pedirIdeasServicio(input: {
  clientId: string;
  productId: string;
  brief?: string | null;
}): Promise<
  { ok: true; ideas: ProductIdea[]; usage: UsageSummary } | { ok: false; error: string }
> {
  try {
    const { user, client, ctx } = await requireGenerationAccess(input.clientId, {
      productId: input.productId,
    });
    if (!ctx.product) throw new PortalGenerationError("Ese servicio ya no existe.", 404);

    const state = await assertCanGenerate(input.clientId, ctx.ownerId, client.aiGenerationLimit);

    let ideas: ProductIdea[];
    try {
      const raw = await generateJsonPlain({
        label: "portal:product-ideas",
        model: MODEL_FAST,
        maxTokens: 3000,
        system: PRODUCT_IDEAS_SYSTEM,
        // `ctx.clientContext` ya trae la ficha pegada debajo de la marca (y sin
        // `notas`), por eso el bloque del servicio va vacío.
        userMessage: buildProductIdeasPrompt({
          brandContext: ctx.clientContext,
          productContext: "",
          currentBrief: input.brief?.trim().slice(0, MAX_BRIEF_LENGTH) || null,
        }),
      });
      ideas = normalizeProductIdeas(raw);
    } catch (e) {
      if (e instanceof AiJsonError) {
        throw new PortalGenerationError("La IA no devolvió ideas válidas. Intenta de nuevo.", 502);
      }
      throw e;
    }
    // Sin ideas no se cobra: el cliente no recibió nada.
    if (ideas.length === 0) {
      throw new PortalGenerationError("La IA no devolvió ideas. Intenta de nuevo.", 502);
    }

    await settleGeneration({
      state,
      ownerId: ctx.ownerId,
      clientId: input.clientId,
      userId: user.id,
      endpoint: "portal:product-ideas",
    });

    const usage = await getGenerationState(input.clientId, ctx.ownerId, client.aiGenerationLimit, {
      freshBalance: true,
    });

    return {
      ok: true,
      ideas,
      usage: {
        used: usage.used,
        limit: usage.limit,
        remaining: usage.remaining,
        creditBalance: usage.creditBalance,
        nextSource: usage.nextSource,
      },
    };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    const { message, status } = generationErrorInfo(e);
    if (status >= 500) console.error("[portal/generar/ideas]", e);
    return { ok: false, error: message };
  }
}

/**
 * 1-2 preguntas sobre lo que le falta a la ficha. **Gratis** (llamada chica de
 * ~2s) y **nunca falla hacia el cliente**: cualquier error devuelve `[]` y el
 * flujo sigue directo, igual que en el estudio.
 */
export async function pedirPreguntasServicio(input: {
  clientId: string;
  productId: string;
  brief: string;
}): Promise<ProductQuestion[]> {
  try {
    const { ctx } = await requireGenerationAccess(input.clientId, { productId: input.productId });
    if (!ctx.product) return [];

    const missing = missingKeyFields(ctx.product);
    if (missing.length === 0) return [];

    const raw = await generateJsonPlain({
      label: "portal:product-questions",
      model: MODEL_FAST,
      maxTokens: 600,
      system: PRODUCT_QUESTIONS_SYSTEM,
      userMessage: buildProductQuestionsPrompt({
        brandContext: ctx.clientContext,
        productContext: "",
        missing,
        brief: input.brief.slice(0, MAX_BRIEF_LENGTH),
      }),
    });
    return normalizeProductQuestions(raw, missing);
  } catch (e) {
    rethrowIfNextControlFlow(e);
    if (!(e instanceof AiJsonError)) console.error("[portal/generar/preguntas]", e);
    return [];
  }
}

/** Guarda una respuesta de afinado en la ficha (solo `collaborator` o dueño). */
export async function guardarRespuestaEnFicha(input: {
  clientId: string;
  productId: string;
  field: string;
  value: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireProductEditor(input.clientId);
    await updatePortalProduct({
      clientId: input.clientId,
      productId: input.productId,
      details: { [input.field]: input.value },
    });
    revalidatePath(`/portal/${input.clientId}/investigacion`);
    return { ok: true };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    if (e instanceof PortalProductError) return { ok: false, error: e.message };
    console.error("[portal/generar/ficha]", e);
    return { ok: false, error: "No se pudo guardar en la ficha." };
  }
}

/**
 * "Revisar un gancho" (pestaña de `/generar`): califica lo que el cliente
 * escribió y propone una versión mejorada. Cuesta 1 generación
 * (`portal:hook-review`) y no guarda nada.
 */
export async function revisarGanchoSuelto(input: {
  clientId: string;
  verbal: string;
  textOverlay: string;
  visual: string;
  context: string;
}): Promise<{ ok: true; review: HookReview } | { ok: false; error: string }> {
  try {
    const review = await reviewPortalHook({
      clientId: input.clientId,
      verbal: input.verbal,
      textOverlay: input.textOverlay,
      visual: input.visual,
      context: input.context,
    });
    return { ok: true, review };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return { ok: false, error: generationErrorInfo(e).message };
  }
}
