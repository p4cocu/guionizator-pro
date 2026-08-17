/**
 * `POST /api/portal/generar/guion` — el paso que cuesta plata.
 *
 * Es el único que registra en `ai_usage_log` (una fila = un guion) y por lo
 * tanto el único que mueve el tope. Orden deliberado:
 *
 *   1. `assertCanGenerate` ANTES de llamar a la API → pasarse no gasta tokens.
 *   2. `logAiGeneration` DESPUÉS de que la IA respondió → un error de la API no
 *      le come el cupo al cliente.
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
import { createServiceClient } from "@/lib/supabase/service";
import {
  assertCanGenerate,
  generateScript,
  getGenerationState,
  PortalGenerationError,
  requireGenerationAccess,
} from "@/lib/portal/generate";
import { logAiGeneration } from "@/lib/portal/usage";
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

    await assertCanGenerate(clientId, ctx.ownerId, client.aiGenerationLimit);

    const generated = await generateScript(ctx, {
      brief,
      type,
      bigIdea: completo ? body.big_idea : undefined,
      structureName,
      structure,
    });

    const admin = createServiceClient();

    // Si el log falla, el cliente ya recibió su guion: se avisa por consola y se
    // sigue. Perder una fila del medidor es mejor que devolverle un error por un
    // guion que sí se generó (y que ya se pagó).
    await logAiGeneration(admin, {
      ownerId: ctx.ownerId,
      clientId,
      userId: user.id,
      endpoint: "portal:guion",
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
    }).catch((e) => {
      console.error("[portal/generar/guion] no se pudo registrar el consumo:", e);
    });

    const usage = await getGenerationState(clientId, ctx.ownerId, client.aiGenerationLimit);

    return NextResponse.json({
      content: generated.content,
      structure_name: generated.structureName,
      // `brain_version_id` NO se devuelve: lo resuelve de nuevo la action al
      // guardar. Un dato que el browser no necesita es un dato que el browser
      // puede cambiar.
      usage: { used: usage.used, limit: usage.limit, remaining: usage.remaining },
    });
  } catch (e) {
    return errorResponse("portal/generar/guion", e);
  }
}
