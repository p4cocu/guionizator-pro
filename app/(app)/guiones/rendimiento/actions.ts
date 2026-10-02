"use server";

/**
 * Rendimiento de lo publicado y "✦ Multiplicar" (migración `0022`, punto 6).
 *
 * Todo con la sesión del dueño: `scripts` e `instagram_accounts` ya tienen
 * policy de owner, y el portal no ve nada de esto. El token de Instagram se
 * lee acá y nunca sale al browser.
 *
 * Las métricas se traen bajo demanda (botón), no hay cron: con 2 cuentas
 * conectadas no vale la pena, y la mudanza a Vercel va a rehacer los crons.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getMedia,
  getMediaById,
  getMediaInsights,
  metricsForType,
  InstagramApiError,
  type IgInsights,
  type IgMedia,
} from "@/lib/instagram/client";
import {
  BASELINE_SAMPLE,
  buildBaseline,
  evaluatePerformance,
  sanitizeIgMetrics,
  toIgMetrics,
  type IgMetrics,
} from "@/lib/multiply/metrics";
import { buildMultiplyPrompt, sanitizeMultiply, type MultiplyResult } from "@/lib/multiply/prompt";
import { buildClientContext } from "@/lib/ai/clientContext";
import { MODEL_FAST } from "@/lib/ai/anthropic";
import { AiJsonError, generateJsonPlain } from "@/lib/ai/json";
import { scriptToClipboard } from "@/lib/portal/scriptExport";
import { buildStrategyContext, normalizeStrategyRow, STRATEGY_COLUMNS } from "@/lib/strategy/pillars";
import { maskInventedNumbers } from "@/lib/strategy/prompts";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

function igError(e: unknown, fallback: string): string {
  return e instanceof InstagramApiError ? `Instagram: ${e.message}` : e instanceof Error ? e.message : fallback;
}

async function loadAccount(supabase: Supabase, ownerId: string, clientId: string) {
  const { data } = await supabase
    .from("instagram_accounts")
    .select("id, username, access_token")
    .eq("owner_id", ownerId)
    .eq("client_id", clientId)
    .maybeSingle();
  return data as { id: string; username: string | null; access_token: string } | null;
}

async function loadScript(supabase: Supabase, ownerId: string, scriptId: string) {
  const { data } = await supabase
    .from("scripts")
    .select("id, client_id, type, title, content, ig_media_id, ig_posted_at, ig_metrics, product_id")
    .eq("id", scriptId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  return data as {
    id: string;
    client_id: string;
    type: string;
    title: string | null;
    content: Record<string, unknown> | null;
    ig_media_id: string | null;
    ig_posted_at: string | null;
    ig_metrics: unknown;
    product_id: string | null;
  } | null;
}

async function safeInsights(m: IgMedia, token: string): Promise<IgInsights> {
  try {
    return await getMediaInsights(m.id, token, metricsForType(m.media_type));
  } catch {
    return {};
  }
}

// ─── Posts de la cuenta (selector de vínculo) ────────────────────────────────

export type IgPostOption = {
  id: string;
  permalink: string | null;
  caption: string;
  media_type: string;
  timestamp: string;
  thumbnail: string | null;
  /** Otro guion que ya está vinculado a este post. */
  linked_script_id: string | null;
};

export type IgPostsResult =
  | { ok: true; username: string | null; posts: IgPostOption[] }
  | { ok: false; noAccount?: boolean; error: string };

export async function listIgPostsForScript(scriptId: string): Promise<IgPostsResult> {
  try {
    const { supabase, user } = await getAuthUser();
    const script = await loadScript(supabase, user.id, scriptId);
    if (!script) return { ok: false, error: "Guion no encontrado." };
    const account = await loadAccount(supabase, user.id, script.client_id);
    if (!account) {
      return { ok: false, noAccount: true, error: "Esta marca no tiene Instagram conectado (se conecta en su perfil, en Clientes)." };
    }

    const media = await getMedia(account.access_token, BASELINE_SAMPLE);
    const { data: linked } = await supabase
      .from("scripts")
      .select("id, ig_media_id")
      .eq("owner_id", user.id)
      .eq("client_id", script.client_id)
      .eq("is_latest", true)
      .in("ig_media_id", media.map((m) => m.id));
    const byMedia = new Map((linked ?? []).map((r) => [r.ig_media_id as string, r.id as string]));

    return {
      ok: true,
      username: account.username,
      posts: media.map((m) => ({
        id: m.id,
        permalink: m.permalink ?? null,
        caption: (m.caption ?? "").slice(0, 140),
        media_type: m.media_type,
        timestamp: m.timestamp,
        thumbnail: m.thumbnail_url ?? (m.media_type === "VIDEO" ? null : m.media_url ?? null),
        linked_script_id: byMedia.get(m.id) ?? null,
      })),
    };
  } catch (e) {
    return { ok: false, error: igError(e, "No se pudieron traer los posts.") };
  }
}

// ─── Métricas ────────────────────────────────────────────────────────────────

/**
 * Trae los últimos posts de la cuenta de la marca, arma la mediana y guarda
 * las métricas de cada guion vinculado. Un guion vinculado a un post más viejo
 * que la muestra se pide aparte (la mediana sigue siendo la de los recientes).
 */
async function refreshForClient(supabase: Supabase, ownerId: string, clientId: string): Promise<number> {
  const account = await loadAccount(supabase, ownerId, clientId);
  if (!account) return 0;

  const { data: linked } = await supabase
    .from("scripts")
    .select("id, ig_media_id")
    .eq("owner_id", ownerId)
    .eq("client_id", clientId)
    .not("ig_media_id", "is", null);
  if (!linked?.length) return 0;

  const media = await getMedia(account.access_token, BASELINE_SAMPLE);
  const withInsights = await Promise.all(
    media.map(async (m) => ({ media: m, insights: await safeInsights(m, account.access_token) })),
  );
  const baseline = buildBaseline(
    withInsights.map((p) => ({ media_type: p.media.media_type, timestamp: p.media.timestamp, insights: p.insights })),
  );
  const byId = new Map(withInsights.map((p) => [p.media.id, p]));

  const now = new Date().toISOString();
  let updated = 0;
  for (const row of linked) {
    const mediaId = row.ig_media_id as string;
    let entry = byId.get(mediaId);
    if (!entry) {
      try {
        const m = await getMediaById(mediaId, account.access_token);
        entry = { media: m, insights: await safeInsights(m, account.access_token) };
      } catch {
        continue; // Post borrado o de otra cuenta: se deja la última medición.
      }
    }
    const { error } = await supabase
      .from("scripts")
      .update({
        ig_metrics: toIgMetrics(entry.insights, entry.media.media_type, baseline),
        ig_metrics_at: now,
        ig_posted_at: entry.media.timestamp,
        ig_permalink: entry.media.permalink ?? null,
      })
      .eq("id", row.id)
      .eq("owner_id", ownerId);
    if (!error) updated++;
  }
  return updated;
}

export type RefreshResult = { ok: true; updated: number; errors: string[] } | { ok: false; error: string };

/** Sin `clientId`: todas las marcas del dueño que tengan guiones vinculados. */
export async function refreshIgMetrics(clientId?: string): Promise<RefreshResult> {
  try {
    const { supabase, user } = await getAuthUser();
    let clientIds: string[];
    if (clientId) {
      clientIds = [clientId];
    } else {
      const { data } = await supabase
        .from("scripts")
        .select("client_id")
        .eq("owner_id", user.id)
        .not("ig_media_id", "is", null);
      clientIds = [...new Set((data ?? []).map((r) => r.client_id as string))];
    }

    let updated = 0;
    const errors: string[] = [];
    await Promise.all(
      clientIds.map(async (id) => {
        try {
          updated += await refreshForClient(supabase, user.id, id);
        } catch (e) {
          errors.push(igError(e, "No se pudieron traer las métricas."));
        }
      }),
    );
    revalidatePath("/guiones/hechos");
    return { ok: true, updated, errors };
  } catch (e) {
    return { ok: false, error: igError(e, "No se pudieron traer las métricas.") };
  }
}

// ─── Vincular ────────────────────────────────────────────────────────────────

export type LinkResult =
  | {
      ok: true;
      ig_media_id: string | null;
      ig_permalink: string | null;
      ig_posted_at: string | null;
      ig_metrics: IgMetrics | null;
      ig_metrics_at: string | null;
    }
  | { ok: false; error: string };

/** `mediaId = null` desvincula. Vincular trae las métricas en el mismo paso. */
export async function linkIgPost(scriptId: string, mediaId: string | null): Promise<LinkResult> {
  try {
    const { supabase, user } = await getAuthUser();
    const script = await loadScript(supabase, user.id, scriptId);
    if (!script) return { ok: false, error: "Guion no encontrado." };

    if (!mediaId) {
      const { error } = await supabase
        .from("scripts")
        .update({ ig_media_id: null, ig_permalink: null, ig_posted_at: null, ig_metrics: null, ig_metrics_at: null })
        .eq("id", scriptId)
        .eq("owner_id", user.id);
      if (error) return { ok: false, error: error.message };
      revalidatePath(`/guiones/${scriptId}`);
      revalidatePath("/guiones/hechos");
      return { ok: true, ig_media_id: null, ig_permalink: null, ig_posted_at: null, ig_metrics: null, ig_metrics_at: null };
    }

    const account = await loadAccount(supabase, user.id, script.client_id);
    if (!account) return { ok: false, error: "Esta marca no tiene Instagram conectado." };
    // Con el token de la cuenta: si el post no es suyo, Instagram da error.
    const media = await getMediaById(mediaId, account.access_token);

    const { error } = await supabase
      .from("scripts")
      .update({ ig_media_id: media.id, ig_permalink: media.permalink ?? null, ig_posted_at: media.timestamp })
      .eq("id", scriptId)
      .eq("owner_id", user.id);
    if (error) return { ok: false, error: error.message };

    await refreshForClient(supabase, user.id, script.client_id);
    const { data: fresh } = await supabase
      .from("scripts")
      .select("ig_media_id, ig_permalink, ig_posted_at, ig_metrics, ig_metrics_at")
      .eq("id", scriptId)
      .eq("owner_id", user.id)
      .single();

    revalidatePath(`/guiones/${scriptId}`);
    revalidatePath("/guiones/hechos");
    return {
      ok: true,
      ig_media_id: (fresh?.ig_media_id as string | null) ?? media.id,
      ig_permalink: (fresh?.ig_permalink as string | null) ?? media.permalink ?? null,
      ig_posted_at: (fresh?.ig_posted_at as string | null) ?? media.timestamp,
      ig_metrics: sanitizeIgMetrics(fresh?.ig_metrics),
      ig_metrics_at: (fresh?.ig_metrics_at as string | null) ?? null,
    };
  } catch (e) {
    return { ok: false, error: igError(e, "No se pudo vincular el post.") };
  }
}

// ─── Multiplicar ─────────────────────────────────────────────────────────────

export type MultiplyActionResult =
  | (MultiplyResult & { ok: true; performance: string })
  | { ok: false; error: string };

const CLIENT_PROFILE_COLUMNS = "id, nombre, marca, que_vende, cliente_ideal, nicho, dolor, deseo, tono, notas";

/**
 * Esqueleto + 3 variaciones de una pieza que funcionó. Propone y no guarda:
 * "Desarrollar" lleva cada variación a /guiones/nuevo.
 */
export async function multiplyScript(scriptId: string): Promise<MultiplyActionResult> {
  try {
    const { supabase, user } = await getAuthUser();
    const script = await loadScript(supabase, user.id, scriptId);
    if (!script) return { ok: false, error: "Guion no encontrado." };

    const perf = evaluatePerformance(sanitizeIgMetrics(script.ig_metrics), script.ig_posted_at);
    if (!perf.worked || !perf.best) {
      return { ok: false, error: "Solo se multiplica lo que funcionó: actualiza las métricas primero." };
    }
    const performance = perf.ratios.map((r) => `${r.x}× ${r.label}`).join(" y ");

    const scriptText = scriptToClipboard(script.content, script.type).trim();
    if (!scriptText) return { ok: false, error: "El guion no tiene texto para analizar." };
    if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Falta ANTHROPIC_API_KEY." };

    const [{ data: brand }, { data: strategyRow }] = await Promise.all([
      supabase.from("clients").select(CLIENT_PROFILE_COLUMNS).eq("id", script.client_id).eq("owner_id", user.id).maybeSingle(),
      supabase.from("content_strategies").select(STRATEGY_COLUMNS).eq("client_id", script.client_id).eq("owner_id", user.id).maybeSingle(),
    ]);
    if (!brand) return { ok: false, error: "Marca no encontrada." };
    const strategy = normalizeStrategyRow(strategyRow as Record<string, unknown> | null, script.client_id);
    const brandContext = buildClientContext(brand as Record<string, string | null>);
    const strategyContext = strategy.pillars.length ? buildStrategyContext(strategy) : "";

    let raw: Record<string, unknown>;
    try {
      raw = await generateJsonPlain({
        label: "multiply-script",
        model: MODEL_FAST,
        maxTokens: 1800,
        userMessage: buildMultiplyPrompt({
          brandContext,
          strategyContext,
          scriptTitle: script.title ?? "",
          scriptType: script.type,
          scriptText,
          performance,
        }),
      });
    } catch (e) {
      if (e instanceof AiJsonError) return { ok: false, error: "La IA no devolvió un formato válido. Intenta de nuevo." };
      throw e;
    }

    const result = sanitizeMultiply(raw, script.type === "carousel" ? "carousel" : "reel");
    if (!result) return { ok: false, error: "La IA no propuso variaciones. Intenta de nuevo." };

    // Red de seguridad: cifras que no estaban en lo que recibió el modelo → [N].
    const known = [brandContext, strategyContext, scriptText].join("\n");
    const variations = result.variations.map((v) =>
      maskInventedNumbers(v, known, ["title", "angle", "hook", "hook_text", "hook_visual", "what_changes"]),
    );
    return { ok: true, performance, skeleton: result.skeleton, variations };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo multiplicar." };
  }
}
