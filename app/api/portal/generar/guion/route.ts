/**
 * `POST /api/portal/generar/guion` — el paso que cuesta plata.
 *
 * Es el único que registra en `ai_usage_log` (una fila = un guion) y por lo
 * tanto el único que mueve el tope. Orden deliberado:
 *
 *   1. `assertCanGenerate` ANTES de llamar a la API → pasarse no gasta tokens.
 *   2. `settleGeneration` DESPUÉS de que la IA respondió → un error de la API no
 *      le come el cupo al cliente. Ese paso descuenta del plan o de una recarga
 *      (Fase E) y deja la fila con `paid_with`.
 *
 * **No guarda el guion.** Guardar es un paso aparte (la server action
 * `guardarGuion`): el cliente puede generar, no convencerse y regenerar sin
 * llenarle el tablero a Paco de borradores. Cada intento sí cuenta contra el
 * tope, porque cada intento cuesta.
 *
 * ⚠️ Latencia: es la misma llamada que `/api/ai/script` hace hoy en producción
 * (mismo modelo, mismos `maxTokens`), así que vive con el mismo margen contra el
 * límite de Netlify. Si algún día aparece un 504, la salida es mover ESTA ruta a
 * background function, no sacarle el reintento a `lib/ai/json.ts`.
 *
 * Autenticada por sesión ⇒ **no** va en `PUBLIC_PATHS`.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  assertCanGenerate,
  generateScript,
  getGenerationState,
  PortalGenerationError,
  requireGenerationAccess,
  settleGeneration,
} from "@/lib/portal/generate";
import { errorResponse, readBase, type BaseBody } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = BaseBody & {
  structure_name?: string;
  structure?: { hook: string; arc: string; close: string };
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { clientId, brief, type } = readBase(body);
    const { user, client, ctx } = await requireGenerationAccess(clientId);

    // En modo simple la estructura la elige la IA: si llega una desde el
    // browser, se ignora. Así el modo que configuró Paco es el que manda.
    const completo = client.aiGenerationMode === "completo";
    const structureName = completo ? body.structure_name?.trim() : undefined;
    const structure = completo ? body.structure : undefined;

    if (completo && !structureName) {
      throw new PortalGenerationError("Elige una estructura antes de generar el guion.");
    }

    const state = await assertCanGenerate(clientId, ctx.ownerId, client.aiGenerationLimit);

    const generated = await generateScript(ctx, {
      brief,
      type,
      bigIdea: completo ? body.big_idea : undefined,
      structureName,
      structure,
    });

    // Descuenta (del plan o de una recarga) y deja la fila del medidor. Nunca
    // lanza: el cliente ya recibió su guion, y tumbarle la pantalla por el
    // contador sería el peor intercambio posible.
    await settleGeneration({
      state,
      ownerId: ctx.ownerId,
      clientId,
      userId: user.id,
      endpoint: "portal:guion",
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
    });

    // `freshBalance`: se acaba de descontar un crédito en este mismo request y
    // la lectura cacheada devolvería el saldo anterior.
    const usage = await getGenerationState(clientId, ctx.ownerId, client.aiGenerationLimit, {
      freshBalance: true,
    });

    return NextResponse.json({
      content: generated.content,
      structure_name: generated.structureName,
      // `brain_version_id` NO se devuelve: lo resuelve de nuevo la action al
      // guardar. Un dato que el browser no necesita es un dato que el browser
      // puede cambiar.
      usage: {
        used: usage.used,
        limit: usage.limit,
        remaining: usage.remaining,
        creditBalance: usage.creditBalance,
        nextSource: usage.nextSource,
      },
    });
  } catch (e) {
    return errorResponse("portal/generar/guion", e);
  }
}
