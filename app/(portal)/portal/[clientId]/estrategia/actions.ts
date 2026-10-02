"use server";

/**
 * Test de estrategia desde el portal (migración `0019`).
 *
 * ⚠️ En un módulo `"use server"` solo se exportan funciones async (regla de
 * CLAUDE.md): nada de `export type` ni `export const` acá.
 *
 * El candado y la escritura viven en `lib/portal/strategy.ts`: `collaborator`
 * o dueño, sección prendida, marca pagada, y el upsert con service role
 * filtrando `client_id` a mano. Gratis: no toca el cupo de IA.
 */

import { revalidatePath } from "next/cache";
import { rethrowIfNextControlFlow } from "@/lib/portal/generate";
import { AiJsonError } from "@/lib/ai/json";
import {
  PortalStrategyError,
  requireStrategyEditor,
  runPortalStrategyTest,
  type PortalStrategy,
} from "@/lib/portal/strategy";
import { missingTestAnswers, sanitizeTestAnswers } from "@/lib/strategy/test";

export async function enviarTestEstrategia(input: {
  clientId: string;
  answers: Record<string, string>;
}): Promise<{ ok: true; strategy: PortalStrategy } | { ok: false; error: string }> {
  try {
    const answers = sanitizeTestAnswers(input.answers);
    if (missingTestAnswers(answers).length > 0) {
      return { ok: false, error: "Faltan respuestas obligatorias." };
    }
    const { userId } = await requireStrategyEditor(input.clientId);
    const strategy = await runPortalStrategyTest({ clientId: input.clientId, userId, answers });
    revalidatePath(`/portal/${input.clientId}/estrategia`);
    // Paco la ve en el estudio.
    revalidatePath("/estrategia");
    return { ok: true, strategy };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    if (e instanceof PortalStrategyError) return { ok: false, error: e.message };
    if (e instanceof AiJsonError) return { ok: false, error: "No pudimos armar tu estrategia esta vez. Intenta de nuevo." };
    console.error("[portal/estrategia/test]", e);
    return { ok: false, error: "No pudimos armar tu estrategia. Intenta de nuevo." };
  }
}
