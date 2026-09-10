/**
 * `/portal/[clientId]/competencia` — el tablero de competencia de la marca
 * (Fase D, etapas 5 y 7).
 *
 * Candado 2: revalida el flag `competencia` antes de consultar.
 *
 * Qué SIGUE sin tener, a diferencia de `/competencia` (la pantalla de Paco):
 * buscar/agregar competidores, clasificar, descartar, borrar y seleccionar
 * para reporte. Son mutaciones internas de taller, no algo que el cliente
 * necesite — y la RLS del miembro tampoco las permitiría (la policy
 * `competitor_posts_member_select` es solo `select`).
 *
 * Sí puede, desde la etapa 9, **marcar la estrella** (`toggleClientFavorite`),
 * y escribe en la misma columna `is_favorite` que usa Paco: la curaduría es
 * una sola. Va con service role por lo mismo de arriba — el miembro no tiene
 * `update` sobre la tabla.
 *
 * Lo que SÍ tiene (etapa 7): la portada del post (mismo embed de Instagram que
 * el estudio), transcribir y adaptar a su marca — las dos gastan crédito, así
 * que la página trae el estado del cupo para que `CompetenciaPortalClient`
 * pueda mostrarlo y bloquear los botones sin ida y vuelta al servidor.
 *
 * **Los posts marcados como descartados (`is_disliked`) no se muestran.** Es la
 * señal de "esto no sirve" que Paco deja al revisar; pasársela al cliente sería
 * ruido con el que no puede hacer nada.
 *
 * Desde 2026-09-10 el cliente además **guarda links sueltos** (nacen con la
 * estrella y con `is_manual`, viven 120 días), **deja notas** en cualquier post
 * —guardado o scrapeado— y **borra** lo que no tiene que ver con su marca. Las
 * tres van con service role salvo las notas, que van con su sesión porque la
 * policy exige `author_id = auth.uid()`.
 */

import { requirePortalClient, requirePortalSession, portalClientLabel } from "@/lib/portal/access";
import { withOutliers } from "@/lib/competencia/outliers";
import { hasFeature, AI_FEATURE_SLUG } from "@/lib/portal/features";
import { getClientOwnerId, getGenerationState } from "@/lib/portal/generate";
import { getTranscriptionUsageState } from "@/lib/competencia/transcriptionUsage";
import { getBillingState } from "@/lib/billing/access";
import { effectiveLimit, PLAN_TRANSCRIPTIONS } from "@/lib/billing/plan";
import { createServiceClient } from "@/lib/supabase/service";
import { listPostCommentsByClient } from "@/lib/competencia/postComments";
import { PORTAL_POST_COLUMNS } from "@/lib/portal/competencia";
import CompetenciaPortalClient, { type PortalPostBase } from "./CompetenciaPortalClient";

export default async function PortalCompetenciaPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { supabase, user } = await requirePortalSession();
  const client = await requirePortalClient(user.id, clientId, "competencia");

  // Adaptar gasta el mismo cupo que generar un guion ⇒ mismo candado de rol.
  const canAdapt =
    hasFeature(client.features, AI_FEATURE_SLUG) && client.role !== "viewer";
  // Un `viewer` no modifica nada, igual que no aprueba guiones. El dueño en
  // modo preview sí, que es como se prueba la pantalla.
  const canFavorite = client.role !== "viewer";
  // Guardar un link y borrar un post escriben sobre el tablero compartido:
  // mismo candado que la estrella. Comentar, en cambio, lo puede hacer también
  // un `viewer` — es conversación, no modificación (igual que en los guiones).
  const canSaveLink = client.role !== "viewer";
  const canDelete = client.role !== "viewer";

  const { data } = await supabase
    .from("competitor_posts")
    .select(PORTAL_POST_COLUMNS)
    .eq("client_id", client.id)
    .eq("is_disliked", false)
    .order("posted_at", { ascending: false, nullsFirst: false });

  // La mediana por cuenta se calcula sobre todo lo que trajimos, no sobre lo
  // que el usuario filtre después: si se recalculara por filtro, el mismo post
  // sería outlier o no según lo que estés mirando.
  const posts = withOutliers((data ?? []) as unknown as PortalPostBase[]);

  // El cupo se lee con service role: el miembro no tiene select sobre
  // ai_usage_log ni transcription_usage_log. Si falla, se degrada a "sin
  // datos" en vez de tumbar la pantalla — el corte real igual lo hace el
  // servidor en las server actions.
  const admin = createServiceClient();

  // Se resuelve una sola vez: lo piden el cupo de transcripción, el de
  // adaptación y las notas (para saber cuáles escribió el dueño).
  const ownerId = await getClientOwnerId(client.id);

  // El periodo que se cuenta sale del ciclo de facturación (Fase E); sin
  // suscripción cae al mes calendario UTC de siempre.
  const billing = await getBillingState(client.id);

  const [transcriptionUsage, adaptUsage, commentsByPost] = await Promise.all([
    getTranscriptionUsageState(
      admin,
      client.id,
      ownerId,
      effectiveLimit(client.transcriptionLimit, billing.reason === "exempt", PLAN_TRANSCRIPTIONS),
      { cycleStart: billing.cycleStart, cycleEnd: billing.cycleEnd },
    ).catch((e) => {
      console.error("[portal/competencia] no se pudo leer el cupo de transcripción:", e);
      return null;
    }),
    canAdapt
      ? getGenerationState(client.id, ownerId, client.aiGenerationLimit).catch((e) => {
          console.error("[portal/competencia] no se pudo leer el cupo de adaptación:", e);
          return null;
        })
      : Promise.resolve(null),
    // Las notas de TODOS los posts en una sola consulta: una por tarjeta sería
    // una tormenta de requests para mostrar, casi siempre, cero notas.
    // Va con la sesión del miembro (la policy `..._member_select` ya la cubre).
    listPostCommentsByClient(supabase, client.id, user.id, ownerId),
  ]);

  return (
    <CompetenciaPortalClient
      posts={posts}
      clientId={client.id}
      clientLabel={portalClientLabel(client)}
      canAdapt={canAdapt}
      canFavorite={canFavorite}
      canSaveLink={canSaveLink}
      canDelete={canDelete}
      commentsByPost={commentsByPost}
      transcriptionRemaining={transcriptionUsage?.remaining ?? null}
      adaptRemaining={adaptUsage?.remaining ?? null}
      adaptCreditBalance={adaptUsage?.creditBalance ?? 0}
    />
  );
}
