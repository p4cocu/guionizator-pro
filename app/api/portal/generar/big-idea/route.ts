/**
 * `POST /api/portal/generar/big-idea` — paso 1 del modo **completo**.
 *
 * No cuenta contra el tope (ver `lib/portal/usage.ts`: la unidad es el guion
 * terminado), pero sí lo respeta: si el cliente ya se pasó, ni siquiera empieza
 * el flujo.
 *
 * Autenticada por sesión ⇒ **no** va en `PUBLIC_PATHS`.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  assertCanGenerate,
  generateBigIdea,
  PortalGenerationError,
  requireGenerationAccess,
} from "@/lib/portal/generate";
import { errorResponse, readBase, type BaseBody } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { clientId, brief, type } = readBase((await req.json()) as BaseBody);
    const { client, ctx } = await requireGenerationAccess(clientId);

    if (client.aiGenerationMode !== "completo") {
      throw new PortalGenerationError("Esta marca genera en modo simple.", 400);
    }

    await assertCanGenerate(clientId, ctx.ownerId, client.aiGenerationLimit);

    const bigIdea = await generateBigIdea(ctx, { brief, type });
    return NextResponse.json({ big_idea: bigIdea });
  } catch (e) {
    return errorResponse("portal/generar/big-idea", e);
  }
}
