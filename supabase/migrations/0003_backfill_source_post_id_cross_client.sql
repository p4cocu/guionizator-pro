-- ============================================================================
-- 0003 — Completar el backfill de `scripts.source_post_id` (adaptaciones
--        entre clientes)
-- ============================================================================
-- Qué hace:
--   Liga los guiones adaptados que la 0002 dejó fuera porque exigía que el post
--   perteneciera al MISMO cliente que el guion.
--
-- Por qué:
--   Adaptar entre marcas es un flujo real: en la competencia de FLUIA aparece un
--   post de @construyendoia y de ahí sale un guion para Paco Cuevas IA. La 0002
--   filtraba por `client_id` para no elegir una fila arbitraria cuando el mismo
--   permalink está cargado en varios clientes — pero eso también descartó estos
--   casos legítimos (2 guiones en producción al momento de escribir esto).
--
-- La regla correcta: ligar por owner + permalink SOLO cuando el match es
-- inequívoco (exactamente una fila candidata). Si el mismo permalink existe en
-- dos clientes del owner, no hay forma de saber cuál corresponde, así que se
-- deja en NULL en vez de adivinar.
--
-- Idempotente: solo toca filas con `source_post_id is null`.
--
-- Nota para la Fase C: que un guion apunte a un post de OTRO cliente es dato
-- válido a nivel base. Es la capa del reporte la que debe filtrar por el
-- cliente del reporte, no la FK.
-- ============================================================================

-- Nota: Postgres no tiene `min(uuid)`, así que el id no se puede agregar con
-- min/max. Como el `having count(*) = 1` ya garantiza una sola fila candidata,
-- `(array_agg(p.id))[1]` toma esa única fila sin necesidad de ordenarla.
update scripts s
set source_post_id = m.post_id
from (
  select s2.id as script_id, (array_agg(p.id))[1] as post_id
  from scripts s2
  join competitor_posts p
    on p.permalink = s2.source_post_permalink
   and p.owner_id  = s2.owner_id
  where s2.source_post_id is null
    and s2.source_post_permalink is not null
  group by s2.id
  having count(*) = 1   -- solo matches inequívocos
) m
where s.id = m.script_id
  and s.source_post_id is null;

-- ── Verificación (opcional) ─────────────────────────────────────────────────
-- select
--   count(*) filter (where source_post_id is not null) as ligados,
--   count(*) filter (where source_post_id is null)     as sin_ligar
-- from scripts where source_post_permalink is not null;
-- (los "sin_ligar" que queden son posts ya purgados por el cron de 40 días)
