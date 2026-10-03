/**
 * Ganchos de 3 capas en el portal: los del guion del cliente y el revisor
 * suelto de `/generar`.
 *
 * `script_hooks` quedó **owner-only** en `0006` (no tiene `client_id` ni
 * policies de miembro), así que todo va con service role. La pertenencia se
 * prueba a mano por el guion: mismo `client_id`, `is_latest`, sin
 * `trashed_at` y en un estado que el portal muestra (no `idea` ni `baul`).
 * Toda consulta a `script_hooks` filtra además por ese `script_id`.
 *
 * - Leer: gratis, cualquier rol con la sección `guiones`.
 * - "3 ganchos nuevos" (`portal:layered-hooks`) y "Revisar"
 *   (`portal:hook-review`): 1 generación cada uno, `requireGenerationAccess`.
 * - Guardar uno: gratis, `collaborator` o dueño. Nunca se borra ni se pisa un
 *   gancho desde el portal (no hay columna de autor: podría ser de Paco). La
 *   versión mejorada de una revisión se guarda como gancho NUEVO.
 *
 * Prompts compartidos con el estudio: `lib/hooks/run.ts`.
 *
 * SERVER-ONLY.
 */

import { createServiceClient } from "../supabase/service";
import { getPortalClient, requirePortalSession } from "./access";
import { hasFeature } from "./features";
import { billingMessage, getBillingState } from "../billing/access";
import {
  PortalGenerationError,
  assertCanGenerate,
  requireGenerationAccess,
  settleGeneration,
} from "./generate";
import { normalizeChecks, type HookCheck } from "../hooks/criteria";
import type { HookReview, LayeredHook } from "../hooks/prompts";
import { runHookReview, runLayeredHooks, scriptToText } from "../hooks/run";

/** Estados que el portal esconde (mismo criterio que la lista de guiones). */
const HIDDEN_STATUSES = ["idea", "baul"];

export type PortalHook = {
  id: string;
  hook_text: string;
  text_overlay: string | null;
  visual: string | null;
  hook_type: string | null;
  checks: HookCheck[] | null;
  why: string | null;
};

const HOOK_COLUMNS = "id, hook_text, text_overlay, visual, hook_type, checks, why";

type HookScript = { id: string; type: "reel" | "carousel"; brief: string; text: string };

/** El guion, solo si el cliente puede verlo. Lanza 404 si no. */
async function loadVisibleScript(clientId: string, scriptId: string): Promise<HookScript> {
  const { data, error } = await createServiceClient()
    .from("scripts")
    .select("id, type, brief, content, status, is_latest, trashed_at")
    // ⚠️ Service role: estos filtros son lo único que acota a la marca.
    .eq("id", scriptId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new PortalGenerationError(error.message, 500);
  if (!data || !data.is_latest || data.trashed_at || HIDDEN_STATUSES.includes(data.status as string)) {
    throw new PortalGenerationError("Ese guion no existe o no es de esta marca.", 404);
  }
  const type = data.type === "carousel" ? "carousel" : "reel";
  return { id: data.id as string, type, brief: (data.brief as string | null) ?? "", text: scriptToText(type, data.content) };
}

function normalizeHook(row: Record<string, unknown>): PortalHook {
  const r = row as unknown as PortalHook;
  return { ...r, checks: Array.isArray(r.checks) ? normalizeChecks(r.checks) : null };
}

/** Para la página: ya pasó `requirePortalClient(..., "guiones")`. Nunca lanza. */
export async function listPortalScriptHooks(clientId: string, scriptId: string): Promise<PortalHook[]> {
  try {
    await loadVisibleScript(clientId, scriptId);
    const { data, error } = await createServiceClient()
      .from("script_hooks")
      .select(HOOK_COLUMNS)
      .eq("script_id", scriptId)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => normalizeHook(r as Record<string, unknown>));
  } catch (e) {
    console.error("[portal/scriptHooks] no se pudieron leer los ganchos:", e);
    return [];
  }
}

/** Candado de las acciones de IA sobre un guion: los de `requireGenerationAccess` + sección `guiones`. */
async function gateScriptAi(clientId: string) {
  const access = await requireGenerationAccess(clientId);
  if (!hasFeature(access.client.features, "guiones")) {
    throw new PortalGenerationError("Esta sección no está habilitada para tu marca.", 403);
  }
  const state = await assertCanGenerate(clientId, access.ctx.ownerId, access.client.aiGenerationLimit);
  return { ...access, state };
}

export async function generatePortalHooks(input: { clientId: string; scriptId: string }): Promise<LayeredHook[]> {
  const { user, ctx, state } = await gateScriptAi(input.clientId);
  const script = await loadVisibleScript(input.clientId, input.scriptId);
  if (!script.text.trim()) throw new PortalGenerationError("El guion está vacío.", 400);

  // Sin `notas`: `loadGenerationContext` no las selecciona.
  const hooks = await runLayeredHooks({
    brandContext: ctx.clientContext,
    type: script.type,
    brief: script.brief,
    scriptText: script.text,
  });
  if (hooks.length === 0) throw new PortalGenerationError("La IA no devolvió ganchos. Intenta de nuevo.", 502);

  await settleGeneration({ state, ownerId: ctx.ownerId, clientId: input.clientId, userId: user.id, endpoint: "portal:layered-hooks" });
  return hooks;
}

/**
 * "Revisar": con `scriptId` califica contra el guion (y si trae `hookId`,
 * guarda el checklist en ese gancho); sin `scriptId` es el revisor suelto de
 * `/generar`, que no guarda nada.
 */
export async function reviewPortalHook(input: {
  clientId: string;
  scriptId?: string | null;
  hookId?: string | null;
  verbal: string;
  textOverlay: string | null;
  visual: string | null;
  context?: string | null;
}): Promise<HookReview> {
  const verbal = input.verbal.trim().slice(0, 500);
  const textOverlay = input.textOverlay?.trim().slice(0, 300) || null;
  if (!verbal && !textOverlay) throw new PortalGenerationError("Escribe al menos la frase o el texto en pantalla.", 400);

  const { user, ctx, state } = input.scriptId
    ? await gateScriptAi(input.clientId)
    : await (async () => {
        const access = await requireGenerationAccess(input.clientId);
        const st = await assertCanGenerate(input.clientId, access.ctx.ownerId, access.client.aiGenerationLimit);
        return { ...access, state: st };
      })();

  let context = input.context?.trim().slice(0, 2000) || null;
  if (input.scriptId) {
    const script = await loadVisibleScript(input.clientId, input.scriptId);
    context = `${script.brief}\n\n${script.text}`;
  }

  const review = await runHookReview({
    brandContext: ctx.clientContext,
    verbal,
    textOverlay,
    visual: input.visual?.trim().slice(0, 500) || null,
    context,
  });
  if (!review) throw new PortalGenerationError("La IA no devolvió una revisión válida. Intenta de nuevo.", 502);

  await settleGeneration({ state, ownerId: ctx.ownerId, clientId: input.clientId, userId: user.id, endpoint: "portal:hook-review" });

  if (input.scriptId && input.hookId) {
    await createServiceClient()
      .from("script_hooks")
      .update({ checks: review.checks })
      .eq("id", input.hookId)
      .eq("script_id", input.scriptId)
      .then(({ error }) => {
        if (error) console.error("[portal/scriptHooks] no se pudo guardar el checklist:", error.message);
      });
  }
  return review;
}

/** "Guardar": gratis. `collaborator` o dueño, sección `guiones`, marca pagada. */
export async function savePortalHook(input: {
  clientId: string;
  scriptId: string;
  hook: {
    hook_text: string;
    text_overlay?: string | null;
    visual?: string | null;
    hook_type?: string | null;
    checks?: HookCheck[] | null;
    why?: string | null;
  };
}): Promise<PortalHook> {
  const { user } = await requirePortalSession();
  const client = await getPortalClient(user.id, input.clientId);
  if (!client) throw new PortalGenerationError("Esa marca no existe.", 404);
  if (!hasFeature(client.features, "guiones")) throw new PortalGenerationError("Esta sección no está habilitada para tu marca.", 403);
  if (client.role === "viewer") throw new PortalGenerationError("Tu acceso es de solo lectura.", 403);
  if (client.role !== "owner") {
    const billing = await getBillingState(input.clientId);
    if (!billing.ok) throw new PortalGenerationError(billingMessage(billing), 402);
  }

  await loadVisibleScript(input.clientId, input.scriptId);
  const text = input.hook.hook_text?.trim().slice(0, 500);
  if (!text) throw new PortalGenerationError("El gancho está vacío.", 400);

  const admin = createServiceClient();
  const { data: brand } = await admin.from("clients").select("owner_id").eq("id", input.clientId).maybeSingle();
  if (!brand) throw new PortalGenerationError("Esa marca no existe.", 404);

  const { data: last } = await admin
    .from("script_hooks")
    .select("position")
    .eq("script_id", input.scriptId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await admin
    .from("script_hooks")
    .insert({
      // El dueño de la marca: si no, el gancho desaparece del panel de Paco.
      owner_id: brand.owner_id as string,
      script_id: input.scriptId,
      hook_text: text,
      position: ((last?.position as number | undefined) ?? -1) + 1,
      text_overlay: input.hook.text_overlay?.trim().slice(0, 300) || null,
      visual: input.hook.visual?.trim().slice(0, 500) || null,
      hook_type: input.hook.hook_type?.slice(0, 40) || null,
      checks: input.hook.checks ? normalizeChecks(input.hook.checks) : null,
      why: input.hook.why?.trim().slice(0, 500) || null,
    })
    .select(HOOK_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return normalizeHook(data as Record<string, unknown>);
}
