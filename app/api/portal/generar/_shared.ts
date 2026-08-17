/**
 * Lo que comparten las tres rutas de `/api/portal/generar/*` (Fase D, etapa 6).
 *
 * ⚠️ NO es un route handler: solo `route.ts` lo es, y este archivo no exporta
 * ningún método HTTP. El `_` del nombre lo marca como interno.
 *
 * Las tres rutas se autentican **por sesión de usuario**, así que NO van en
 * `PUBLIC_PATHS` (regla dura de `CLAUDE.md`: ahí solo va lo que se autentica
 * por su propio secreto). El middleware las protege como a cualquier otra.
 */

import { NextResponse } from "next/server";
import {
  generationErrorInfo,
  PortalGenerationError,
  rethrowIfNextControlFlow,
  type ScriptType,
} from "@/lib/portal/generate";

/** Los briefs largos son legítimos; los de 50k son un intento de inflar el prompt. */
export const MAX_BRIEF_LENGTH = 4000;

export type BaseBody = {
  client_id?: string;
  brief?: string;
  type?: string;
  big_idea?: string;
};

/** Valida lo que mandan las tres rutas. Lanza `PortalGenerationError` (400). */
export function readBase(body: BaseBody): {
  clientId: string;
  brief: string;
  type: ScriptType;
} {
  const clientId = body.client_id?.trim();
  const brief = body.brief?.trim();
  const type = body.type;

  if (!clientId) throw new PortalGenerationError("Falta la marca.");
  if (!brief) throw new PortalGenerationError("Escribe de qué quieres que hable el guion.");
  if (brief.length > MAX_BRIEF_LENGTH) {
    throw new PortalGenerationError(
      `El brief es demasiado largo (máximo ${MAX_BRIEF_LENGTH} caracteres).`,
    );
  }
  if (type !== "reel" && type !== "carousel") {
    throw new PortalGenerationError("Elige si es un Reel o un carrusel.");
  }

  return { clientId, brief, type };
}

/**
 * Traduce cualquier error a una respuesta JSON. Los 5xx quedan además en el log
 * del servidor: son bugs nuestros o caídas de la API, no cosas que el cliente
 * pueda arreglar.
 */
export function errorResponse(label: string, e: unknown): NextResponse {
  rethrowIfNextControlFlow(e);

  const { message, status } = generationErrorInfo(e);
  if (status >= 500) console.error(`[${label}]`, e);
  return NextResponse.json({ error: message }, { status });
}
