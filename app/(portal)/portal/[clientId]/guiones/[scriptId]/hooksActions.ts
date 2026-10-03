"use server";

/**
 * Ganchos de 3 capas en el guion del cliente. El candado, la pertenencia y el
 * cobro viven en `lib/portal/scriptHooks.ts`: "3 ganchos nuevos" y "Revisar"
 * cuestan 1 generación cada uno; guardar es gratis.
 *
 * ⚠️ En un módulo `"use server"` solo se exportan funciones async.
 */

import { revalidatePath } from "next/cache";
import { generationErrorInfo, rethrowIfNextControlFlow } from "@/lib/portal/generate";
import {
  generatePortalHooks,
  reviewPortalHook,
  savePortalHook,
  type PortalHook,
} from "@/lib/portal/scriptHooks";
import type { HookReview, LayeredHook } from "@/lib/hooks/prompts";
import type { HookCheck } from "@/lib/hooks/criteria";

export async function pedirGanchos(
  clientId: string,
  scriptId: string,
): Promise<{ ok: true; hooks: LayeredHook[] } | { ok: false; error: string }> {
  try {
    return { ok: true, hooks: await generatePortalHooks({ clientId, scriptId }) };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return { ok: false, error: generationErrorInfo(e).message };
  }
}

export async function revisarGancho(
  clientId: string,
  scriptId: string,
  hook: { id: string; hook_text: string; text_overlay: string | null; visual: string | null },
): Promise<{ ok: true; review: HookReview } | { ok: false; error: string }> {
  try {
    const review = await reviewPortalHook({
      clientId,
      scriptId,
      hookId: hook.id,
      verbal: hook.hook_text,
      textOverlay: hook.text_overlay,
      visual: hook.visual,
    });
    return { ok: true, review };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return { ok: false, error: generationErrorInfo(e).message };
  }
}

export async function guardarGancho(
  clientId: string,
  scriptId: string,
  hook: {
    hook_text: string;
    text_overlay?: string | null;
    visual?: string | null;
    hook_type?: string | null;
    checks?: HookCheck[] | null;
    why?: string | null;
  },
): Promise<{ ok: true; hook: PortalHook } | { ok: false; error: string }> {
  try {
    const saved = await savePortalHook({ clientId, scriptId, hook });
    revalidatePath(`/portal/${clientId}/guiones/${scriptId}`);
    // Paco lo ve en el panel "Ganchos" del estudio.
    revalidatePath(`/guiones/${scriptId}`);
    return { ok: true, hook: saved };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return { ok: false, error: generationErrorInfo(e).message };
  }
}
