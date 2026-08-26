"use server";

/**
 * Lo que el cliente puede DISPARAR desde `/portal/[clientId]/competencia`:
 * transcribir un post, adaptarlo a su marca y marcarlo con la estrella. Las dos
 * primeras cuestan crédito; la estrella es gratis, como comentar o aprobar.
 *
 * ⚠️ NO reexportar tipos (regla de `CLAUDE.md`): en un módulo `"use server"`
 * un `export type` sobrevive al bundle como referencia que en runtime no
 * existe. Los tipos compartidos viven en `lib/portal/generate.ts` y
 * `lib/competencia/transcribe.ts`.
 *
 * **Transcribir** mide contra `clients.transcription_limit`
 * (`lib/competencia/transcriptionUsage.ts`). **Adaptar** mide contra el MISMO
 * cupo que generar guiones (`ai_generation_limit`) — reusa
 * `requireGenerationAccess`, así que además exige que el add-on `generar_ia`
 * esté prendido, no solo `competencia`. El botón se esconde en la UI cuando
 * no aplica, pero la action revalida las dos cosas igual: un endpoint público
 * no se defiende dibujando o no un botón.
 */

import { revalidatePath } from "next/cache";
import { requirePortalClient, requirePortalSession } from "@/lib/portal/access";
import { createServiceClient } from "@/lib/supabase/service";
import {
  transcribeCompetitorPost,
  transcribeErrorInfo,
  TranscribeCompetitorError,
} from "@/lib/competencia/transcribe";
import { getTranscriptionUsageState, logTranscription } from "@/lib/competencia/transcriptionUsage";
import { getBillingState } from "@/lib/billing/access";
import { effectiveLimit, PLAN_TRANSCRIPTIONS } from "@/lib/billing/plan";
import {
  adaptCompetitorPost,
  assertCanGenerate,
  settleGeneration,
  generationErrorInfo,
  PortalGenerationError,
  requireGenerationAccess,
  rethrowIfNextControlFlow,
  type AdaptSourcePost,
  type ScriptType,
} from "@/lib/portal/generate";

export type TranscribeResult = { ok: true; transcription: string } | { ok: false; error: string };

export async function transcribePortalPost(
  clientId: string,
  postId: string,
): Promise<TranscribeResult> {
  try {
    const { user } = await requirePortalSession();
    const client = await requirePortalClient(user.id, clientId, "competencia");
    const admin = createServiceClient();

    const { data: clientRow, error: clientErr } = await admin
      .from("clients")
      .select("owner_id")
      .eq("id", clientId)
      .maybeSingle();
    if (clientErr) throw new TranscribeCompetitorError(clientErr.message, 500);
    if (!clientRow) throw new TranscribeCompetitorError("Esa marca no existe.", 404);
    const ownerId = clientRow.owner_id as string;

    // Desde Fase E el tope se mide contra el CICLO DE FACTURACIÓN de la marca,
    // no contra el mes calendario, y sale del plan salvo que haya override.
    // Una marca exenta no tiene tope.
    const billing = await getBillingState(clientId);
    const usageState = await getTranscriptionUsageState(
      admin,
      clientId,
      ownerId,
      effectiveLimit(client.transcriptionLimit, billing.reason === "exempt", PLAN_TRANSCRIPTIONS),
      { cycleStart: billing.cycleStart, cycleEnd: billing.cycleEnd },
    );
    if (usageState.blocked) {
      throw new TranscribeCompetitorError(
        `Llegaste al tope de ${usageState.limit} transcripciones de este ciclo. Se reinicia cuando arranca el próximo.`,
        429,
      );
    }

    // Confirma que el post es de esta marca antes de gastar crédito en él.
    const { data: post } = await admin
      .from("competitor_posts")
      .select("id")
      .eq("id", postId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (!post) throw new TranscribeCompetitorError("Ese post no existe o no es de esta marca.", 404);

    const { transcription } = await transcribeCompetitorPost(postId, ownerId);

    await logTranscription(admin, { ownerId, clientId, userId: user.id, postId }).catch((e) => {
      console.error("[portal/competencia] no se pudo registrar el consumo de transcripción:", e);
    });

    revalidatePath(`/portal/${clientId}/competencia`);
    return { ok: true, transcription };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    const { message } = transcribeErrorInfo(e);
    return { ok: false, error: message };
  }
}

export type AdaptResult =
  | { ok: true; content: Record<string, unknown>; structureName: string; brief: string }
  | { ok: false; error: string };

/**
 * Genera la adaptación (cuesta 1 crédito) pero NO la guarda — el cliente la
 * ve, y si le gusta la guarda con `guardarGuion` de `../generar/actions`
 * (mismo botón "Guardar guion" que ya usa el flujo de generación libre).
 */
export async function adaptPortalPost(
  clientId: string,
  postId: string,
  type: ScriptType,
): Promise<AdaptResult> {
  try {
    const { user, client, ctx } = await requireGenerationAccess(clientId);
    const state = await assertCanGenerate(clientId, ctx.ownerId, client.aiGenerationLimit);

    const admin = createServiceClient();
    const { data: post } = await admin
      .from("competitor_posts")
      .select("id, username, caption, type, likes, comments, video_views, transcription")
      .eq("id", postId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (!post) throw new PortalGenerationError("Ese post no existe o no es de esta marca.", 404);

    const sourcePost = post as AdaptSourcePost;
    const generated = await adaptCompetitorPost(ctx, sourcePost, type);

    await settleGeneration({
      state,
      ownerId: ctx.ownerId,
      clientId,
      userId: user.id,
      endpoint: "portal:adapt-competitor",
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
    });

    return {
      ok: true,
      content: generated.content,
      structureName: generated.structureName,
      brief: `Adaptación del post de @${sourcePost.username ?? "competencia"}`,
    };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    const { message } = generationErrorInfo(e);
    return { ok: false, error: message };
  }
}

export type FavoriteResult = { ok: true; value: boolean } | { ok: false; error: string };

/**
 * Estrella del post (etapa 9). Escribe en `competitor_posts.is_favorite`, **la
 * misma columna que usa Paco desde `/competencia`** — decisión tomada a
 * propósito para no partir la curaduría en dos: lo marcado es lo marcado,
 * venga de quien venga. Consecuencias asumidas:
 *
 *  - El badge dejó de significar "lo elegimos nosotros" y el copy del portal se
 *    reescribió para no mentir.
 *  - En `/competencia` no se distingue quién marcó qué (no hay columna de
 *    autor).
 *  - La limpieza a 40 días (`cleanup-competencia-scheduled` y `runScrapeJob`)
 *    ya excluye `is_favorite`, así que lo que marque el cliente se conserva
 *    solo. Eso es lo que se quiere; también significa que un cliente que marque
 *    todo llena la tabla del dueño.
 *
 * ⚠️ Va con **service role**: la policy `competitor_posts_member_select` de la
 * `0006` le dio al miembro solo `select`, y no se le va a dar `update` — con su
 * JWT podría llamar a PostgREST directo y tocar cualquier columna de la fila
 * (`is_disliked`, la transcripción, la clasificación). Mismo patrón que
 * `lib/portal/trash.ts`. Por eso el `client_id` se filtra a mano.
 *
 * Solo `collaborator` (y el dueño en modo preview): un `viewer` no modifica
 * nada, igual que no aprueba guiones.
 */
export async function toggleClientFavorite(
  clientId: string,
  postId: string,
  value: boolean,
): Promise<FavoriteResult> {
  try {
    const { user } = await requirePortalSession();
    const client = await requirePortalClient(user.id, clientId, "competencia");

    if (client.role === "viewer") {
      return {
        ok: false,
        error:
          "Tu acceso es de solo lectura. Pídele a quien maneja tu contenido que te dé permiso de colaborador.",
      };
    }

    const admin = createServiceClient();
    const { data, error } = await admin
      .from("competitor_posts")
      .update({ is_favorite: value })
      .eq("id", postId)
      .eq("client_id", clientId)
      .select("id");

    if (error) return { ok: false, error: error.message };
    if (!data?.length) {
      return { ok: false, error: "Esa publicación no existe o no es de tu marca." };
    }

    revalidatePath(`/portal/${clientId}/competencia`);
    return { ok: true, value };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar la estrella.",
    };
  }
}
