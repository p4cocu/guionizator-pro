/**
 * `/portal/[clientId]/competencia` — el tablero de competencia de la marca,
 * **solo lectura** (Fase D, etapa 5).
 *
 * Candado 2: revalida el flag `competencia` antes de consultar.
 *
 * Qué NO tiene, a diferencia de `/competencia` (la pantalla de Paco): buscar
 * competidores, transcribir, clasificar, adaptar a guion, marcar favoritos,
 * borrar y seleccionar para reporte. Todo eso son mutaciones que la RLS del
 * miembro no permite igual — la policy `competitor_posts_member_select` es solo
 * `select`. Acá directamente no se dibujan, para no ofrecer botones que van a
 * fallar.
 *
 * **Los posts marcados como descartados (`is_disliked`) no se muestran.** Es la
 * señal de "esto no sirve" que Paco deja al revisar; pasársela al cliente sería
 * ruido con el que no puede hacer nada.
 */

import { requirePortalClient, requirePortalSession, portalClientLabel } from "@/lib/portal/access";
import { withOutliers } from "@/lib/competencia/outliers";
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

  return <CompetenciaPortalClient posts={posts} clientLabel={portalClientLabel(client)} />;
}
