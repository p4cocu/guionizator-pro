/**
 * "Ideas para tu semana" del portal (`/portal/[id]/estrategia`).
 *
 * Generar cuesta cupo de IA (`portal:week-ideas`): 3 piezas = 1 generación,
 * 5 o 7 = 2 (`weekIdeasCost`). Pasa por los cuatro candados de
 * `requireGenerationAccess` (sesión + marca, `generar_ia`, cobro, rol
 * `collaborator`) y además exige la sección `estrategia` prendida.
 *
 * Solo la fuente `matriz` (pilares × cliente ideal): competencia, tendencias e
 * investigación son datos del estudio.
 *
 * Guardar NO cuesta: el cliente guarda **solo las que le gustan** (decisión de
 * Paco, 2026-10-02) en el banco de Paco (`content_ideas`, owner-only), con
 * service role, `owner_id` del dueño de la marca y `generated_by` del miembro
 * (migración `0024`). Toda consulta filtra `client_id` a mano: el service role
 * saltea la RLS. El portal solo lista las que guardó alguien del portal
 * (`generated_by` no nulo), nunca el banco interno.
 *
 * No agenda en el calendario: cuándo se publica lo decide Paco, igual que
 * `/generar`.
 *
 * SERVER-ONLY.
 */

import { createServiceClient } from "../supabase/service";
import { hasFeature } from "./features";
import {
  PortalGenerationError,
  assertCanGenerate,
  getGenerationState,
  requireGenerationAccess,
  settleGenerations,
} from "./generate";
import { loadPortalStrategy, requireStrategyEditor } from "./strategy";
import { weekIdeasCost } from "../billing/plan";
import { EMPTY_IDEA_FILTERS, runStrategyIdeas, type WeekIdea } from "../strategy/runIdeas";
import { IDEA_COLUMNS, ideaInsertRow, type ContentIdea } from "../strategy/pillars";

/** Tamaños que ofrece el portal. El estudio además tiene 4. */
export const PORTAL_WEEK_SIZES = [3, 5, 7] as const;

export type PortalUsage = {
  used: number;
  limit: number | null;
  remaining: number | null;
  creditBalance: number;
  nextSource: "plan" | "credit";
};

const PORTAL_IDEA_LIMIT = 60;

/** Las ideas que guardó alguien del portal para esta marca. */
export async function listPortalIdeas(clientId: string): Promise<ContentIdea[]> {
  const { data, error } = await createServiceClient()
    .from("content_ideas")
    .select(IDEA_COLUMNS)
    // ⚠️ Service role: este filtro es lo único que acota a la marca.
    .eq("client_id", clientId)
    .not("generated_by", "is", null)
    .order("created_at", { ascending: false })
    .limit(PORTAL_IDEA_LIMIT);
  if (error) {
    console.error("[portal/weekIdeas] no se pudieron leer las ideas:", error.message);
    return [];
  }
  return (data ?? []) as unknown as ContentIdea[];
}

export async function generatePortalWeek(input: {
  clientId: string;
  posts: number;
}): Promise<{ ideas: WeekIdea[]; usage: PortalUsage; cost: number }> {
  if (!PORTAL_WEEK_SIZES.includes(input.posts as (typeof PORTAL_WEEK_SIZES)[number])) {
    throw new PortalGenerationError("Elige 3, 5 o 7 publicaciones.", 400);
  }
  const { user, client, ctx } = await requireGenerationAccess(input.clientId);
  if (!hasFeature(client.features, "estrategia")) {
    throw new PortalGenerationError("Esta sección no está habilitada para tu marca.", 403);
  }

  const strategy = await loadPortalStrategy(input.clientId);
  if (strategy.pillars.length === 0) {
    throw new PortalGenerationError("Primero haz el test de estrategia: las ideas salen de tus temas.", 400);
  }

  const cost = weekIdeasCost(input.posts);
  const state = await assertCanGenerate(input.clientId, ctx.ownerId, client.aiGenerationLimit, cost);

  // Para no repetir ganchos: los del banco entero de la marca (también los de
  // Paco). Solo viajan al prompt, nunca al browser.
  const { data: prev } = await createServiceClient()
    .from("content_ideas")
    .select("hook")
    .eq("client_id", input.clientId)
    .order("created_at", { ascending: false })
    .limit(25);

  const ideas = await runStrategyIdeas({
    // Sin `notas`: `loadGenerationContext` no las selecciona.
    brandContext: ctx.clientContext,
    strategy,
    source: "matriz",
    material: null,
    filters: EMPTY_IDEA_FILTERS,
    previousHooks: (prev ?? []).map((r) => r.hook as string),
    weekPosts: input.posts,
  });
  // Sin ideas no se cobra: el cliente no recibió nada.
  if (ideas.length === 0) throw new PortalGenerationError("La IA no devolvió ideas. Intenta de nuevo.", 502);

  await settleGenerations({
    state,
    units: cost,
    ownerId: ctx.ownerId,
    clientId: input.clientId,
    userId: user.id,
    endpoint: "portal:week-ideas",
  });

  const usage = await getGenerationState(input.clientId, ctx.ownerId, client.aiGenerationLimit, {
    freshBalance: true,
  });
  return {
    ideas,
    cost,
    usage: {
      used: usage.used,
      limit: usage.limit,
      remaining: usage.remaining,
      creditBalance: usage.creditBalance,
      nextSource: usage.nextSource,
    },
  };
}

async function ownerOf(clientId: string): Promise<string> {
  const { data, error } = await createServiceClient().from("clients").select("owner_id").eq("id", clientId).maybeSingle();
  if (error || !data) throw new PortalGenerationError("Esa marca no existe.", 404);
  return data.owner_id as string;
}

/** "Guardar": gratis. `collaborator` o dueño (mismo candado que el test). */
export async function savePortalIdea(input: { clientId: string; idea: Partial<ContentIdea> }): Promise<ContentIdea> {
  const { userId } = await requireStrategyEditor(input.clientId);
  const strategy = await loadPortalStrategy(input.clientId);
  const row = ideaInsertRow(input.idea, strategy.pillars);
  if (!row) throw new PortalGenerationError("La idea está vacía.", 400);

  const { data, error } = await createServiceClient()
    .from("content_ideas")
    .insert({
      // El dueño de la marca, no el miembro: si no, la fila desaparece del
      // banco de Paco (RLS `owner_id = auth.uid()`).
      owner_id: await ownerOf(input.clientId),
      client_id: input.clientId,
      generated_by: userId,
      ...row,
    })
    .select(IDEA_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as ContentIdea;
}

/**
 * "Quitar": solo las que guardó alguien del portal y solo de esta marca. Las
 * del banco interno de Paco no se ven ni se tocan desde acá.
 */
export async function deletePortalIdea(input: { clientId: string; ideaId: string }): Promise<void> {
  await requireStrategyEditor(input.clientId);
  const { error } = await createServiceClient()
    .from("content_ideas")
    .delete()
    .eq("id", input.ideaId)
    .eq("client_id", input.clientId)
    .not("generated_by", "is", null);
  if (error) throw new Error(error.message);
}
