"use server";

/**
 * Portadas y Copy Expert desde el portal (Fase D, etapa 8).
 *
 * Las dos gastan crédito del add-on de IA: mismo cupo que generar un guion o
 * adaptar un post de competencia. El orden es el de siempre —
 * `assertCanGenerate` ANTES de llamar a la API (pasarse no gasta tokens) y
 * `logAiGeneration` DESPUÉS de que respondió (un error de la API no come cupo).
 *
 * `requireGenerationAccess` exige, además de la sesión y el acceso a la marca,
 * que `generar_ia` esté prendido. La sección `guiones` se revalida aparte: el
 * cliente entra a estas herramientas desde la pantalla del guion.
 *
 * ⚠️ NO reexportar tipos desde este archivo (regla de `CLAUDE.md`). Viven en
 * `lib/portal/scriptTools.ts`.
 */

import { revalidatePath } from "next/cache";
import { requirePortalClient, requirePortalSession } from "@/lib/portal/access";
import { createServiceClient } from "@/lib/supabase/service";
import { logAiGeneration } from "@/lib/portal/usage";
import {
  assertCanGenerate,
  generationErrorInfo,
  requireGenerationAccess,
  rethrowIfNextControlFlow,
} from "@/lib/portal/generate";
import {
  generateCopy,
  generateCovers,
  loadClientScript,
  saveCopy,
  saveCovers,
  type PortalCoverIdea,
  type PortalScriptCopy,
} from "@/lib/portal/scriptTools";

export type CoversResult =
  | { ok: true; covers: PortalCoverIdea[] }
  | { ok: false; error: string };

export type CopyResult = { ok: true; copy: PortalScriptCopy } | { ok: false; error: string };

/** Sesión + acceso a la marca + `guiones` + `generar_ia` + cupo disponible. */
async function gate(clientId: string) {
  const { user } = await requirePortalSession();
  await requirePortalClient(user.id, clientId, "guiones");
  const access = await requireGenerationAccess(clientId);
  await assertCanGenerate(clientId, access.ctx.ownerId, access.client.aiGenerationLimit);
  return access;
}

export async function generarPortadas(
  clientId: string,
  scriptId: string,
): Promise<CoversResult> {
  try {
    const { user, ctx } = await gate(clientId);

    const script = await loadClientScript(clientId, scriptId);
    const covers = await generateCovers(script);

    await logAiGeneration(createServiceClient(), {
      ownerId: ctx.ownerId,
      clientId,
      userId: user.id,
      endpoint: "portal:cover",
    }).catch((e) => {
      console.error("[portal/guiones] no se pudo registrar el consumo de portadas:", e);
    });

    // Se guardan solas, como en el estudio: generarlas cuesta crédito y
    // perderlas por cerrar la pestaña sería cobrarle dos veces lo mismo.
    await saveCovers(scriptId, ctx.ownerId, covers).catch((e) => {
      console.error("[portal/guiones] no se pudieron guardar las portadas:", e);
    });

    revalidatePath(`/portal/${clientId}/guiones/${scriptId}`);
    return { ok: true, covers };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return { ok: false, error: generationErrorInfo(e).message };
  }
}

export async function generarCopy(
  clientId: string,
  scriptId: string,
  platform: string,
): Promise<CopyResult> {
  try {
    const { user, ctx } = await gate(clientId);

    const script = await loadClientScript(clientId, scriptId);
    const copy = await generateCopy(script, platform);

    await logAiGeneration(createServiceClient(), {
      ownerId: ctx.ownerId,
      clientId,
      userId: user.id,
      endpoint: "portal:copy",
    }).catch((e) => {
      console.error("[portal/guiones] no se pudo registrar el consumo de copy:", e);
    });

    await saveCopy(scriptId, ctx.ownerId, copy).catch((e) => {
      console.error("[portal/guiones] no se pudo guardar el copy:", e);
    });

    revalidatePath(`/portal/${clientId}/guiones/${scriptId}`);
    return { ok: true, copy };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return { ok: false, error: generationErrorInfo(e).message };
  }
}
