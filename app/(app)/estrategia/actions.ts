"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MODEL_FAST } from "@/lib/ai/anthropic";
import { runStrategyIdeas, type WeekIdea } from "@/lib/strategy/runIdeas";
import { AiJsonError, generateJsonPlain } from "@/lib/ai/json";
import { buildClientContext } from "@/lib/ai/clientContext";
import { buildProductContext } from "@/lib/ai/productContext";
import { PRODUCT_COLUMNS, type Product } from "@/lib/products/fields";
import {
  IDEA_COLUMNS,
  ideaInsertRow,
  IDEA_SOURCES,
  STRATEGY_COLUMNS,
  FORMAT_STYLES,
  PURPOSES,
  buildStrategyContext,
  formatStyleLabel,
  isIdeaSource,
  isPurpose,
  toAwarenessLevel,
  normalizeStrategyRow,
  sanitizeStrategy,
  type ContentIdea,
  type AccountPhase,
  type IdeaSource,
  type Pillar,
  type Strategy,
  type StrategyFieldKey,
} from "@/lib/strategy/pillars";
import { strategyFromTest } from "@/lib/strategy/runTest";
import {
  MIN_RESEARCH_POSTS,
  computeResearch,
  normalizeNiche,
  normalizeTopic,
  researchOptions,
  researchToPrompt,
  type ResearchOption,
  type ResearchPost,
} from "@/lib/competencia/research";
import { missingTestAnswers, sanitizeTestAnswers, type TestAnswers } from "@/lib/strategy/test";
import {
  STRATEGY_DRAFT_SYSTEM,
  buildStrategyDraftPrompt,
  normalizeStrategyDraft,
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
  account_phase: AccountPhase | null;
  pillars: Pillar[];
  /** Solo si el formulario salió de "Hacer el test" (0019). */
  test_answers?: TestAnswers | null;
}): Promise<SaveResult> {
  try {
    const { supabase, user } = await getAuthUser();
    await loadBrand(supabase, user.id, input.client_id);
    const clean = sanitizeStrategy({ ...input.fields, account_phase: input.account_phase, pillars: input.pillars });
    const updated_at = new Date().toISOString();
    const test = input.test_answers
      ? { test_answers: sanitizeTestAnswers(input.test_answers), test_completed_at: updated_at, test_completed_by: user.id }
      : {};
    const { error } = await supabase.from("content_strategies").upsert(
      { client_id: input.client_id, owner_id: user.id, ...clean, ...test, updated_at },
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

export type TestDraftResult =
  | { ok: true; fields: Partial<Record<StrategyFieldKey, string>>; pillars: Pillar[]; account_phase: AccountPhase }
  | { ok: false; error: string };

/**
 * "Hacer el test" (0019) desde el estudio: mismo cuestionario y mismo prompt
 * que el portal, pero propone y NO guarda — el resultado reemplaza el
 * formulario y se guarda con "Guardar estrategia", como "Proponer con IA".
 */
export async function draftStrategyFromTest(clientId: string, rawAnswers: TestAnswers): Promise<TestDraftResult> {
  try {
    const answers = sanitizeTestAnswers(rawAnswers);
    if (missingTestAnswers(answers).length > 0) return { ok: false, error: "Faltan respuestas obligatorias." };
    const { supabase, user } = await getAuthUser();
    const [brand, { data: products }] = await Promise.all([
      loadBrand(supabase, user.id, clientId),
      supabase.from("client_products").select(PRODUCT_COLUMNS).eq("owner_id", user.id).eq("client_id", clientId),
    ]);
    const res = await strategyFromTest({
      answers,
      brandContext: buildClientContext(brand),
      productsContext: ((products ?? []) as unknown as Product[]).map((p) => buildProductContext(p)).join("\n\n"),
    });
    return { ok: true, ...res };
  } catch (e) {
    if (e instanceof AiJsonError) return { ok: false, error: "La IA no devolvió una estrategia válida. Intenta de nuevo." };
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo armar la estrategia." };
  }
}

// ─── Generador de ideas ──────────────────────────────────────────────────────

export type GenerateIdeasInput = {
  client_id: string;
  source: IdeaSource;
  source_text?: string | null;
  pillar_key?: string | null;
  level?: string | null;
  purpose?: string | null;
  format?: "reel" | "carousel" | null;
  format_style?: string | null;
  /** "Mi semana": cuántas piezas (3, 4 o 5). Genera una por casilla. */
  week_posts?: number | null;
  value_pillar?: string | null;
  hook_type?: string | null;
  script_structure?: string | null;
  /** Fuente "investigacion" (0020): nicho obligatorio, tema opcional. */
  research_niche?: string | null;
  research_topic?: string | null;
};

export type GenerateIdeasResult = { ok: true; ideas: WeekIdea[] } | { ok: false; error: string };

/**
 * Los posts clasificados de TODAS tus marcas con el nicho de su cuenta (0020).
 * Se cruzan por `client_id` + `username` porque `competitor_posts` no tiene FK
 * a `competitors`. Investigación por nicho = tus datos de todas las marcas.
 */
async function loadResearchPosts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
): Promise<ResearchPost[]> {
  const [{ data: accounts }, { data: posts }] = await Promise.all([
    supabase.from("competitors").select("client_id, username, niche").eq("owner_id", ownerId).not("niche", "is", null),
    supabase
      .from("competitor_posts")
      .select("client_id, username, shortcode, permalink, topic, hook_type, script_structure, value_pillar, video_views, likes, comments, transcription")
      .eq("owner_id", ownerId)
      .eq("is_disliked", false)
      .not("classified_at", "is", null)
      .limit(5000),
  ]);
  const nicheOf = new Map((accounts ?? []).map((a) => [`${a.client_id}|${a.username}`, normalizeNiche(a.niche)]));
  return (posts ?? []).map((p) => ({
    key: (p.shortcode as string | null) || (p.permalink as string | null) || `${p.client_id}|${p.username}|${p.transcription?.slice(0, 40)}`,
    username: p.username as string,
    niche: nicheOf.get(`${p.client_id}|${p.username}`) ?? null,
    topic: normalizeTopic(p.topic),
    hook_type: p.hook_type as string | null,
    script_structure: p.script_structure as string | null,
    value_pillar: p.value_pillar as string | null,
    video_views: p.video_views as number | null,
    likes: p.likes as number | null,
    comments: p.comments as number | null,
    transcription: p.transcription as string | null,
  }));
}

/** Nichos y temas disponibles para la fuente "Post de investigación". */
export async function getResearchOptions(): Promise<ResearchOption[]> {
  const { supabase, user } = await getAuthUser();
  return researchOptions(await loadResearchPosts(supabase, user.id));
}

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
      if (input.source === "investigacion") {
        if (!input.research_niche) return { ok: false, error: "Elige el nicho de la investigación." };
        const stats = computeResearch(await loadResearchPosts(supabase, user.id), {
          niche: input.research_niche,
          topic: input.research_topic,
        });
        if (!stats || stats.posts < MIN_RESEARCH_POSTS) {
          return {
            ok: false,
            error: `Solo hay ${stats?.posts ?? 0} reels clasificados ${input.research_topic ? "de ese tema " : ""}en ese nicho. Con menos de ${MIN_RESEARCH_POSTS} la afirmación no se sostiene: clasifica más en Competencia${input.research_topic ? " o quita el tema" : ""}.`,
          };
        }
        material = researchToPrompt(stats);
      }
    }

    const { data: prev } = await supabase
      .from("content_ideas")
      .select("hook")
      .eq("owner_id", user.id)
      .eq("client_id", input.client_id)
      .order("created_at", { ascending: false })
      .limit(25);

    const pillar = strategy.pillars.find((p) => p.key === input.pillar_key) ?? null;
    const ideas = await runStrategyIdeas({
      brandContext: buildClientContext(brand),
      strategy,
      source: input.source,
      material,
      filters: {
        pillar,
        level: input.level ? toAwarenessLevel(input.level) : null,
        purpose: isPurpose(input.purpose) ? input.purpose : null,
        format: input.format ?? null,
        // Las fuentes de autoridad (0020) llevan su formato sí o sí: probado,
        // sin forzarlo 2 de 5 ideas "contracorriente" salían como demo o caso.
        format_style:
          input.source === "contracorriente" || input.source === "investigacion"
            ? input.source
            : FORMAT_STYLES.some((f) => f.id === input.format_style)
              ? input.format_style!
              : null,
        value_pillar: input.value_pillar || null,
        hook_type: input.hook_type || null,
        script_structure: input.script_structure || null,
      },
      previousHooks: (prev ?? []).map((r) => r.hook as string),
      weekPosts: input.week_posts,
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
    const row = ideaInsertRow(idea, strategy.pillars);
    if (!row) return { ok: false, error: "La idea está vacía." };

    const { data, error } = await supabase
      .from("content_ideas")
      .insert({ owner_id: user.id, client_id: clientId, ...row })
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

// ─── Agendar la semana ───────────────────────────────────────────────────────

/** El brief que lleva cada entrada del calendario: idea + gancho de 3 capas. */
function calendarBrief(idea: WeekIdea, pillar: Pillar | undefined): string {
  const purpose = PURPOSES.find((p) => p.id === idea.purpose);
  const lines: (string | null)[] = [
    `Gancho — dice: "${idea.hook}"`,
    idea.hook_text ? `Gancho — texto en pantalla: "${idea.hook_text}"` : null,
    idea.hook_visual ? `Gancho — primer segundo: ${idea.hook_visual}` : null,
    "",
    idea.brief,
    "",
    [
      pillar && `Pilar: ${pillar.name}`,
      `Nivel de consciencia: ${idea.stage}`,
      purpose && `Propósito: ${purpose.label}`,
      idea.format_style && `Formato: ${formatStyleLabel(idea.format_style)}`,
    ]
      .filter(Boolean)
      .join(" · "),
  ];
  return lines.filter((l) => l !== null).join("\n");
}

export type ScheduleWeekResult = { ok: true; created: number } | { ok: false; error: string };

/**
 * "Agendar semana": cada idea entra a `content_calendar` en estado `idea` el
 * día que le toca a partir de `start_date` (el lunes). `status` no tiene CHECK
 * en esa tabla; `format` usa el vocabulario del calendario (`reel`/`carrusel`).
 */
export async function scheduleWeek(input: {
  client_id: string;
  start_date: string;
  ideas: WeekIdea[];
}): Promise<ScheduleWeekResult> {
  try {
    const { supabase, user } = await getAuthUser();
    // loadBrand valida que la marca sea del que llama (la FK aceptaría cualquiera).
    const [, strategy] = await Promise.all([
      loadBrand(supabase, user.id, input.client_id),
      loadStrategyRow(supabase, user.id, input.client_id),
    ]);
    const start = new Date(`${input.start_date}T12:00:00Z`);
    if (Number.isNaN(start.getTime())) return { ok: false, error: "Fecha de inicio inválida." };

    const rows = input.ideas
      .filter((i) => i.hook && i.brief)
      .map((idea, idx) => {
        const date = new Date(start);
        date.setUTCDate(start.getUTCDate() + (idea.day ?? idx));
        const day = date.getUTCDate();
        const pillar = strategy.pillars.find((p) => p.key === idea.pillar_key);
        const purpose = PURPOSES.find((p) => p.id === idea.purpose);
        return {
          owner_id: user.id,
          client_id: input.client_id,
          title: (idea.hook_text || idea.hook).slice(0, 200),
          format: idea.format === "carousel" ? "carrusel" : "reel",
          platforms: ["instagram"],
          status: "idea",
          pillar: pillar?.name ?? null,
          month: date.getUTCMonth() + 1,
          year: date.getUTCFullYear(),
          week_number: Math.min(4, Math.ceil(day / 7)),
          position: idx,
          publish_date: date.toISOString().slice(0, 10),
          brief: calendarBrief(idea, pillar),
          cta_type: purpose?.cta ?? null,
        };
      });
    if (rows.length === 0) return { ok: false, error: "No hay ideas para agendar." };

    const { error } = await supabase.from("content_calendar").insert(rows);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/calendario");
    return { ok: true, created: rows.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo agendar la semana." };
  }
}
