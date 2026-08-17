/**
 * `POST /api/portal/generar/estructuras` — paso 2 del modo **completo**.
 *
 * Devuelve 3 estructuras para que el cliente elija una. Igual que la Big Idea:
 * no cuenta contra el tope, pero lo respeta.
 *
 * Autenticada por sesión ⇒ **no** va en `PUBLIC_PATHS`.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  assertCanGenerate,
  generateStructures,
  PortalGenerationError,
  requireGenerationAccess,
} from "@/lib/portal/generate";
import { errorResponse, readBase, type BaseBody } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BaseBody;
    const { clientId, brief, type } = readBase(body);
    const { client, ctx } = await requireGenerationAccess(clientId);

    if (client.aiGenerationMode !== "completo") {
      throw new PortalGenerationError("Esta marca genera en modo simple.", 400);
    }

    await assertCanGenerate(clientId, ctx.ownerId, client.aiGenerationLimit);

    const data = await generateStructures(ctx, {
      brief,
      type,
      bigIdea: body.big_idea,
    });

    return NextResponse.json(data);
  } catch (e) {
    return errorResponse("portal/generar/estructuras", e);
  }
}
