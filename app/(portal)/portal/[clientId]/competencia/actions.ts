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
import { addPostComment, type PostComment } from "@/lib/competencia/postComments";
import { saveLinkForClient, deletePostForClient } from "@/lib/portal/competencia";
import { enrichSavedPost } from "@/lib/competencia/enrich";
import type { SavedLinkType } from "@/lib/competencia/savedLink";
import {
  adaptCompetitorPost,
  assertCanGenerate,
  settleGeneration,
  generationErrorInfo,
  PortalGenerationError,
  requireGenerationAccess,
  rethrowIfNextControlFlow,
  getClientOwnerId,
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
 *  - La limpieza (`lib/competencia/retention.ts`) excluye `is_favorite`, así que
 *    lo que el cliente marque sobre un post **scrapeado** se conserva solo. Eso
 *    es lo que se quiere; también significa que un cliente que marque todo llena
 *    la tabla del dueño. Lo que él **guarda como link** es otra cosa: eso es
 *    `is_manual` y vive 120 días.
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

// ─── Guardar links, notas y borrado ──────────────────────────────────────────

export type SaveLinkActionResult =
  | {
      ok: true;
      post: Record<string, unknown>;
      alreadyExisted: boolean;
      /**
       * La nota inicial, ya creada. **Tiene que volver acá**: la pantalla mete
       * el post nuevo en su estado local y `revalidatePath` no toca un `useState`
       * que se inicializó desde props, así que sin esto la nota quedaba guardada
       * en la base pero invisible hasta recargar la página. (Bug encontrado el
       * 2026-09-10 probando en producción.)
       */
      comment: PostComment | null;
    }
  | { ok: false; error: string };

/**
 * Guarda un link suelto en el tablero de la marca (2026-09-10). Es gratis: no
 * llama a ninguna IA, así que no toca cupo ni créditos — se cobra la
 * generación, no el archivar.
 *
 * Solo `collaborator` (y el dueño en modo preview), igual que la estrella: es
 * una escritura sobre el tablero compartido.
 *
 * La nota inicial es opcional y entra como el primer mensaje del hilo, no como
 * un campo aparte: así se lee igual que cualquier otra nota y Paco puede
 * responderla desde `/competencia`. Va con la **sesión del miembro** (la policy
 * `competitor_post_comments_member_insert` ya la cubre) mientras que el post va
 * con service role — a propósito: el autor de la nota tiene que ser la persona,
 * y el trigger `set_owner_from_client` necesita ver `auth.uid()`.
 *
 * Devuelve la nota junto con el post: la pantalla la necesita para pintarla sin
 * recargar (ver el comentario de `SaveLinkActionResult`).
 */
export async function savePortalLink(
  clientId: string,
  input: { url: string; account: string; type: SavedLinkType; note: string },
): Promise<SaveLinkActionResult> {
  try {
    const { supabase, user } = await requirePortalSession();
    const client = await requirePortalClient(user.id, clientId, "competencia");

    if (client.role === "viewer") {
      return {
        ok: false,
        error:
          "Tu acceso es de solo lectura. Pídele a quien maneja tu contenido que te dé permiso de colaborador.",
      };
    }

    const admin = createServiceClient();
    const ownerId = await getClientOwnerId(clientId);

    const { post, alreadyExisted } = await saveLinkForClient(admin, {
      clientId,
      ownerId,
      url: input.url,
      account: input.account,
      type: input.type,
    });

    // Si la nota falla, el link igual quedó guardado: perder la nota es
    // molesto, perder el link (y hacérselo pegar de nuevo) es peor.
    let comment: PostComment | null = null;
    if (input.note.trim()) {
      comment = await addPostComment(supabase, {
        postId: post.id as string,
        clientId,
        authorId: user.id,
        body: input.note,
        isOwner: user.id === ownerId,
      }).catch((e) => {
        console.error("[portal/competencia] no se pudo guardar la nota inicial:", e);
        return null;
      });
    }

    revalidatePath(`/portal/${clientId}/competencia`);
    return { ok: true, post, alreadyExisted, comment };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar el link.",
    };
  }
}

export type CommentActionResult = { ok: true; comment: PostComment } | { ok: false; error: string };

/**
 * Deja una nota en un post. **Cualquier miembro puede**, incluido el `viewer`:
 * es la misma regla que los comentarios de un guion (`script_comments`), donde
 * comentar es participar de la conversación y no modificar el trabajo.
 *
 * Va con la sesión del miembro, no con service role: la policy de insert exige
 * `author_id = auth.uid()`, que es justamente lo que impide firmar como otro.
 */
export async function addPortalPostComment(
  clientId: string,
  postId: string,
  body: string,
): Promise<CommentActionResult> {
  try {
    const { supabase, user } = await requirePortalSession();
    await requirePortalClient(user.id, clientId, "competencia");

    // El `client_id` lo manda el browser: sin este chequeo, un miembro podría
    // colgar notas de un post de otra marca usando el id de la suya (la policy
    // solo mira `client_id`, no la pertenencia del post).
    const { data: post } = await supabase
      .from("competitor_posts")
      .select("id")
      .eq("id", postId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (!post) return { ok: false, error: "Esa publicación no existe o no es de tu marca." };

    const ownerId = await getClientOwnerId(clientId);
    const comment = await addPostComment(supabase, {
      postId,
      clientId,
      authorId: user.id,
      body,
      isOwner: user.id === ownerId,
    });

    revalidatePath(`/portal/${clientId}/competencia`);
    return { ok: true, comment };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar la nota.",
    };
  }
}

export type DeletePostResult = { ok: true } | { ok: false; error: string };

/**
 * Borra un post del tablero. **Es definitivo y vale para los dos lados**: la
 * fila desaparece también de `/competencia`, con sus notas, su transcripción y
 * su clasificación. No hay papelera (decisión de Paco, 2026-09-10: que la tabla
 * no crezca sin techo).
 *
 * Solo `collaborator`: borrar es la acción más destructiva del portal y un
 * `viewer` no toca nada. La confirmación de la UI es lo único que separa un
 * clic accidental de una pérdida de datos, así que el botón pregunta antes.
 */
export async function deletePortalPost(
  clientId: string,
  postId: string,
): Promise<DeletePostResult> {
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
    const deleted = await deletePostForClient(admin, clientId, postId);
    if (!deleted) return { ok: false, error: "Esa publicación no existe o no es de tu marca." };

    revalidatePath(`/portal/${clientId}/competencia`);
    return { ok: true };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo borrar la publicación.",
    };
  }
}

export type EnrichActionResult =
  | { ok: true; fields: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Completa las métricas de un link recién guardado (likes, comentarios, vistas,
 * el @cuenta real, el texto y la fecha de publicación).
 *
 * La llama la pantalla **después** de que el guardado respondió, no el guardado
 * mismo: la tarjeta aparece al instante y los números entran unos segundos
 * después. Una corrida de Apify tarda entre 5 y 20 segundos y meterla en el
 * camino del guardado dejaría al cliente mirando un botón girando — y perdería
 * el link si Apify falla.
 *
 * Cuesta **una corrida de Apify cargada al token de esa marca**, la misma
 * cadena de siempre (token del cliente → global, que es exclusivo del super
 * admin). No cuesta cupo de IA ni créditos: no interviene ningún modelo.
 *
 * Fallar acá es un caso normal, no un error: la marca puede no tener token, el
 * post puede ser privado o Apify puede tardar de más. El post ya está guardado
 * y sigue sirviendo con las métricas en cero, así que el mensaje vuelve para el
 * log y la pantalla no lo muestra como falla.
 */
export async function enrichPortalPost(
  clientId: string,
  postId: string,
): Promise<EnrichActionResult> {
  try {
    const { user } = await requirePortalSession();
    const client = await requirePortalClient(user.id, clientId, "competencia");

    if (client.role === "viewer") {
      return { ok: false, error: "Tu acceso es de solo lectura." };
    }

    const admin = createServiceClient();
    const ownerId = await getClientOwnerId(clientId);
    const res = await enrichSavedPost(admin, { postId, clientId, ownerId });

    if (!res.ok) {
      console.error("[portal/competencia] no se pudieron traer las métricas:", res.reason);
      return { ok: false, error: res.reason };
    }

    revalidatePath(`/portal/${clientId}/competencia`);
    return { ok: true, fields: res.fields };
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudieron traer las métricas.",
    };
  }
}
