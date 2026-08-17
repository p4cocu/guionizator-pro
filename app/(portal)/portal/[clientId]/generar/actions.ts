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
  generationErrorInfo,
  PortalGenerationError,
  requireGenerationAccess,
  rethrowIfNextControlFlow,
  saveGeneratedScript,
} from "@/lib/portal/generate";

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
}): Promise<GuardarResult> {
  let scriptId: string;

  try {
    const { user, ctx } = await requireGenerationAccess(input.clientId);

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
