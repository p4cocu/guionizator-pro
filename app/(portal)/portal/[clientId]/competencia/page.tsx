/**
 * `/portal/[clientId]/competencia` — el tablero de competencia de la marca
 * (Fase D, etapas 5 y 7).
 *
 * Candado 2: revalida el flag `competencia` antes de consultar.
 *
 * Qué SIGUE sin tener, a diferencia de `/competencia` (la pantalla de Paco):
 * buscar/agregar competidores, clasificar, marcar favoritos, borrar y
 * seleccionar para reporte. Son mutaciones internas de taller, no algo que el
 * cliente necesite — y la RLS del miembro tampoco las permitiría (la policy
 * `competitor_posts_member_select` es solo `select`).
 *
 * Lo que SÍ tiene (etapa 7): la portada del post (mismo embed de Instagram que
 * el estudio), transcribir y adaptar a su marca — las dos gastan crédito, así
 * que la página trae el estado del cupo para que `CompetenciaPortalClient`
 * pueda mostrarlo y bloquear los botones sin ida y vuelta al servidor.
 *
 * **Los posts marcados como descartados (`is_disliked`) no se muestran.** Es la
 * señal de "esto no sirve" que Paco deja al revisar; pasársela al cliente sería
 * ruido con el que no puede hacer nada.
 */

import { requirePortalClient, requirePortalSession, portalClientLabel } from "@/lib/portal/access";
import { withOutliers } from "@/lib/competencia/outliers";
import { hasFeature, AI_FEATURE_SLUG } from "@/lib/portal/features";
import { getClientOwnerId, getGenerationState } from "@/lib/portal/generate";
import { getTranscriptionUsageState } from "@/lib/competencia/transcriptionUsage";
import { createServiceClient } from "@/lib/supabase/service";
import CompetenciaPortalClient, { type PortalPostBase } from "./CompetenciaPortalClient";

/** Solo lo que la pantalla dibuja. Menos columnas que `POST_COLUMNS` de `(app)`. */
const POST_COLUMNS =
  "id, public_id, username, permalink, type, caption, likes, comments, video_views, posted_at, transcription, is_favorite, is_manual, hook_type, script_structure, value_pillar";

export default async function PortalCompetenciaPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { supabase, user } = await requirePortalSession();
  const client = await requirePortalClient(user.id, clientId, "competencia");

  const canAdapt = hasFeature(client.features, AI_FEATURE_SLUG);

  const { data } = await supabase
    .from("competitor_posts")
    .select(POST_COLUMNS)
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

  const [transcriptionUsage, adaptUsage] = await Promise.all([
    getClientOwnerId(client.id)
      .then((ownerId) =>
        getTranscriptionUsageState(admin, client.id, ownerId, client.transcriptionLimit),
      )
      .catch((e) => {
        console.error("[portal/competencia] no se pudo leer el cupo de transcripción:", e);
        return null;
      }),
    canAdapt
      ? getClientOwnerId(client.id)
          .then((ownerId) => getGenerationState(client.id, ownerId, client.aiGenerationLimit))
          .catch((e) => {
            console.error("[portal/competencia] no se pudo leer el cupo de adaptación:", e);
            return null;
          })
      : Promise.resolve(null),
  ]);

  return (
    <CompetenciaPortalClient
      posts={posts}
      clientId={client.id}
      clientLabel={portalClientLabel(client)}
      canAdapt={canAdapt}
      transcriptionRemaining={transcriptionUsage?.remaining ?? null}
      adaptRemaining={adaptUsage?.remaining ?? null}
    />
  );
}
