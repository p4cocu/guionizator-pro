"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MODEL_FAST } from "@/lib/ai/anthropic";
import { AiJsonError, generateJsonPlain } from "@/lib/ai/json";
import { buildClientContext } from "@/lib/ai/clientContext";
import { buildProductContext } from "@/lib/ai/productContext";
import { PRODUCT_COLUMNS, type Product } from "@/lib/products/fields";
import {
  IDEA_COLUMNS,
  IDEA_SOURCES,
  STRATEGY_COLUMNS,
  buildStrategyContext,
  isFunnelStage,
  isIdeaSource,
  normalizeStrategyRow,
  sanitizePillars,
  sanitizeStrategy,
  type ContentIdea,
  type IdeaSource,
  type Pillar,
  type Strategy,
  type StrategyFieldKey,
} from "@/lib/strategy/pillars";
import {
  STRATEGY_DRAFT_SYSTEM,
  STRATEGY_IDEAS_SYSTEM,
  buildStrategyDraftPrompt,
  buildStrategyIdeasPrompt,
  normalizeStrategyDraft,
  normalizeStrategyIdeas,
} from "@/lib/strategy/prompts";

/**
 * `/estrategia` (migración `0017`). Todo owner-only con el cliente de sesión:
 * las dos tablas tienen RLS `owner_id = auth.uid()` y además se filtra a mano.
 *
 * Las dos llamadas a la IA van con `MODEL_FAST`: corren síncronas dentro de la
 * Netlify Function (~26-30s) mientras el usuario espera.
 */

const CLIENT_PROFILE_COLUMNS =
  "id, nombre, marca, que_vende, cliente_ideal, nicho, dolor, deseo, tono, notas";

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

async function loadBrand(supabase: Awaited<ReturnType<typeof createClient>>, ownerId: string, clientId: string) {
  const { data } = await supabase
    .from("clients")
    .select(CLIENT_PROFILE_COLUMNS)
    .eq("id", clientId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!data) throw new Error("Esa marca no existe o no es tuya.");
  return data as Record<string, string | null>;
}

async function loadStrategyRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  clientId: string,
): Promise<Strategy> {
  const { data, error } = await supabase
    .from("content_strategies")
    .select(STRATEGY_COLUMNS)
    .eq("client_id", clientId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeStrategyRow(data as Record<string, unknown> | null, clientId);
}

// ─── Estrategia ──────────────────────────────────────────────────────────────

export type SaveResult = { ok: true; updated_at: string } | { ok: false; error: string };

export async function saveStrategy(input: {
  client_id: string;
  fields: Partial<Record<StrategyFieldKey, string | null>>;
  pillars: Pillar[];
}): Promise<SaveResult> {
  try {
    const { supabase, user } = await getAuthUser();
    await loadBrand(supabase, user.id, input.client_id);
    const clean = sanitizeStrategy({ ...input.fields, pillars: input.pillars });
    const updated_at = new Date().toISOString();
    const { error } = await supabase.from("content_strategies").upsert(
      { client_id: input.client_id, owner_id: user.id, ...clean, updated_at },
      { onConflict: "client_id" },
    );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/estrategia");
    return { ok: true, updated_at };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
}

export type DraftResult =
  | { ok: true; fields: Partial<Record<StrategyFieldKey, string>>; pillars: Pillar[] }
  | { ok: false; error: string };

/** "✦ Proponer con IA": propone, NO guarda. */
export async function draftStrategy(clientId: string): Promise<DraftResult> {
  try {
    const { supabase, user } = await getAuthUser();
    const [brand, { data: products }, current] = await Promise.all([
      loadBrand(supabase, user.id, clientId),
      supabase
        .from("client_products")
        .select(PRODUCT_COLUMNS)
        .eq("owner_id", user.id)
        .eq("client_id", clientId),
      loadStrategyRow(supabase, user.id, clientId).catch(() => null),
    ]);

    const productsContext = ((products ?? []) as unknown as Product[])
      .map((p) => buildProductContext(p))
      .join("\n\n");
    const hasCurrent =
      current && (current.pillars.length > 0 || current.avatar || current.dolores);

    const raw = await generateJsonPlain({
      label: "strategy-draft",
      model: MODEL_FAST,
      maxTokens: 3500,
      system: STRATEGY_DRAFT_SYSTEM,
      userMessage: buildStrategyDraftPrompt({
        brandContext: buildClientContext(brand),
        productsContext,
        currentContext: hasCurrent ? buildStrategyContext(current) : null,
      }),
    });
    const draft = normalizeStrategyDraft(raw);
    if (draft.pillars.length === 0) return { ok: false, error: "La IA no devolvió pilares. Intenta de nuevo." };
    return { ok: true, ...draft };
  } catch (e) {
    if (e instanceof AiJsonError) return { ok: false, error: "La IA no devolvió una propuesta válida. Intenta de nuevo." };
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo generar la propuesta." };
  }
}

// ─── Generador de ideas ──────────────────────────────────────────────────────

export type GenerateIdeasInput = {
  client_id: string;
  source: IdeaSource;
  source_text?: string | null;
  pillar_key?: string | null;
  stage?: string | null;
  format?: "reel" | "carousel" | null;
  value_pillar?: string | null;
  hook_type?: string | null;
  script_structure?: string | null;
};

export type GenerateIdeasResult = { ok: true; ideas: ContentIdea[] } | { ok: false; error: string };

/** Material de las fuentes que viven en la base (tendencias, competencia). */
async function loadSourceMaterial(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  clientId: string,
  brand: Record<string, string | null>,
  source: IdeaSource,
): Promise<string | null> {
  if (source === "tendencias") {
    const { data } = await supabase
      .from("tendencias")
      .select("title, source, summary, angle_paco, angle_fluia, urgency")
      .eq("owner_id", ownerId)
      .eq("status", "pendiente")
      .order("created_at", { ascending: false })
      .limit(12);
    if (!data?.length) return null;
    // Las tendencias traen un ángulo por marca de Paco; se pasa el que toca.
    const isFluia = /fluia/i.test(`${brand.nombre} ${brand.marca}`);
    return data
      .map(
        (t) =>
          `- **${t.title}**${t.source ? ` (${t.source})` : ""}${t.urgency === "urgente" ? " [urgente]" : ""}: ${t.summary ?? ""}` +
          ((isFluia ? t.angle_fluia : t.angle_paco) ? `\n  Ángulo sugerido: ${isFluia ? t.angle_fluia : t.angle_paco}` : ""),
      )
      .join("\n");
  }

  if (source === "competencia") {
    const { data } = await supabase
      .from("competitor_posts")
      .select("username, hook_type, script_structure, value_pillar, classification_notes, transcription, video_views, likes, is_favorite")
      .eq("owner_id", ownerId)
      .eq("client_id", clientId)
      .eq("is_disliked", false)
      .not("classified_at", "is", null)
      .order("is_favorite", { ascending: false })
      .order("video_views", { ascending: false, nullsFirst: false })
      .limit(10);
    if (!data?.length) return null;
    return data
      .map(
        (p) =>
          `- @${p.username} · ${p.video_views ?? 0} vistas · gancho=${p.hook_type} · estructura=${p.script_structure} · valor=${p.value_pillar}` +
          (p.classification_notes ? `\n  Por qué: ${p.classification_notes}` : "") +
          (p.transcription ? `\n  Arranque: "${String(p.transcription).slice(0, 220)}…"` : ""),
      )
      .join("\n");
  }
  return null;
}

export async function generateIdeas(input: GenerateIdeasInput): Promise<GenerateIdeasResult> {
  try {
    if (!isIdeaSource(input.source)) return { ok: false, error: "Fuente desconocida." };
    const { supabase, user } = await getAuthUser();
    const [brand, strategy] = await Promise.all([
      loadBrand(supabase, user.id, input.client_id),
      loadStrategyRow(supabase, user.id, input.client_id),
    ]);
    if (strategy.pillars.length === 0) {
      return { ok: false, error: "Primero define y guarda los pilares de esta marca." };
    }

    const src = IDEA_SOURCES.find((s) => s.id === input.source)!;
    let material: string | null;
    if (src.needsText) {
      material = input.source_text?.trim() || null;
      if (!material) return { ok: false, error: "Escribe o pega el material de esta fuente." };
    } else {
      material = await loadSourceMaterial(supabase, user.id, input.client_id, brand, input.source);
      if (input.source === "tendencias" && !material)
        return { ok: false, error: "No hay tendencias pendientes. Agrega algunas en /tendencias." };
      if (input.source === "competencia" && !material)
        return { ok: false, error: "Esta marca no tiene posts de competencia clasificados todavía." };
    }

    const { data: prev } = await supabase
      .from("content_ideas")
      .select("hook")
      .eq("owner_id", user.id)
      .eq("client_id", input.client_id)
      .order("created_at", { ascending: false })
      .limit(25);

    const pillar = strategy.pillars.find((p) => p.key === input.pillar_key) ?? null;
    const raw = await generateJsonPlain({
      label: "strategy-ideas",
      model: MODEL_FAST,
      maxTokens: 3000,
      system: STRATEGY_IDEAS_SYSTEM,
      userMessage: buildStrategyIdeasPrompt({
        brandContext: buildClientContext(brand),
        strategyContext: buildStrategyContext(strategy),
        source: input.source,
        sourceMaterial: material,
        filters: {
          pillar,
          stage: isFunnelStage(input.stage) ? input.stage : null,
          format: input.format ?? null,
          value_pillar: input.value_pillar || null,
          hook_type: input.hook_type || null,
          script_structure: input.script_structure || null,
        },
        previousHooks: (prev ?? []).map((r) => r.hook as string),
      }),
    });
    const ideas = normalizeStrategyIdeas(raw, {
      pillarKeys: strategy.pillars.map((p) => p.key),
      source: input.source,
    });
    if (ideas.length === 0) return { ok: false, error: "La IA no devolvió ideas. Intenta de nuevo." };
    return { ok: true, ideas };
  } catch (e) {
    if (e instanceof AiJsonError) return { ok: false, error: "La IA no devolvió ideas válidas. Intenta de nuevo." };
    return { ok: false, error: e instanceof Error ? e.message : "No se pudieron generar ideas." };
  }
}

// ─── Banco de ideas ──────────────────────────────────────────────────────────

export type SaveIdeaResult = { ok: true; idea: ContentIdea } | { ok: false; error: string };

export async function saveIdea(clientId: string, idea: ContentIdea): Promise<SaveIdeaResult> {
  try {
    const { supabase, user } = await getAuthUser();
    const strategy = await loadStrategyRow(supabase, user.id, clientId);
    const pillarKeys = new Set(sanitizePillars(strategy.pillars).map((p) => p.key));
    const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const hook = s(idea.hook, 300);
    const brief = s(idea.brief, 1500);
    if (!hook || !brief) return { ok: false, error: "La idea está vacía." };

    const { data, error } = await supabase
      .from("content_ideas")
      .insert({
        owner_id: user.id,
        client_id: clientId,
        pillar_key: idea.pillar_key && pillarKeys.has(idea.pillar_key) ? idea.pillar_key : null,
        source: isIdeaSource(idea.source) ? idea.source : null,
        stage: isFunnelStage(idea.stage) ? idea.stage : "atraer",
        format: idea.format === "carousel" ? "carousel" : "reel",
        value_pillar: s(idea.value_pillar, 40) || null,
        hook_type: s(idea.hook_type, 40) || null,
        script_structure: s(idea.script_structure, 40) || null,
        hook,
        angle: s(idea.angle, 200) || null,
        brief,
        why: s(idea.why, 300) || null,
      })
      .select(IDEA_COLUMNS)
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, idea: data as unknown as ContentIdea };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar la idea." };
  }
}

export async function deleteIdea(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user } = await getAuthUser();
    const { error } = await supabase.from("content_ideas").delete().eq("id", id).eq("owner_id", user.id);
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo borrar." };
  }
}

/** Se marca al tocar "Hacer guion": la idea pasa a "usadas" en el banco. */
export async function setIdeaUsed(id: string, used: boolean): Promise<{ ok: boolean; used_at?: string | null; error?: string }> {
  try {
    const { supabase, user } = await getAuthUser();
    const used_at = used ? new Date().toISOString() : null;
    const { error } = await supabase
      .from("content_ideas")
      .update({ used_at })
      .eq("id", id)
      .eq("owner_id", user.id);
    return error ? { ok: false, error: error.message } : { ok: true, used_at };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo actualizar." };
  }
}
