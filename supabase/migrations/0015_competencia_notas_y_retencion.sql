-- ============================================================================
-- 0015 — Notas en los posts de competencia (hilo de comentarios)
-- ============================================================================
-- Qué hace:
--   Crea `competitor_post_comments`: un hilo de notas por cada post de
--   competencia, escrito por los dos lados (Paco desde /competencia y el
--   cliente desde /portal/[id]/competencia).
--
-- Por qué:
--   Hasta ahora la única forma de decir "este reel me gustó por X" era la
--   estrella, que es un booleano y no explica nada. El feedback terminaba en
--   WhatsApp, igual que pasaba con los guiones antes de `script_comments`.
--
-- Es un CALCO de `script_comments` (`0006`), a propósito:
--   - Mismo trigger `set_owner_from_client` (ya existe desde 0006, acá solo se
--     engancha): si `owner_id` quedara en el miembro que comentó, la fila
--     desaparecería de la vista de Paco, cuya RLS es `owner_id = auth.uid()`.
--   - Mismas tres policies (owner all / member select / member insert), todas
--     PERMISSIVE, así que se suman con OR.
--   - Sin `update` ni `delete` para el miembro: una nota se responde, no se
--     edita. Paco sí puede borrar (entra por `competitor_post_comments_owner_all`).
--
-- `on delete cascade` desde `competitor_posts`: **es lo que hace seguro el bote
-- de basura del portal** y la limpieza automática por antigüedad. Si no, borrar
-- un post dejaría sus notas huérfanas apuntando a una fila que ya no existe.
--
-- Código que depende de esta migración:
--   lib/competencia/postComments.ts                          — listar/agregar
--   app/(portal)/portal/[clientId]/competencia/actions.ts     — comentar / borrar
--   app/(app)/competencia/actions.ts                          — comentar (estudio)
--
-- ⚠️ ORDEN DE APLICACIÓN — esta migración va ANTES del deploy. Es aditiva
--    (tabla nueva, ninguna columna existente cambia), así que el código de hoy
--    sigue funcionando entre la migración y el deploy. Al revés NO: la pantalla
--    de competencia consultaría una tabla inexistente y se quedaría sin posts.
--
-- ⚠️ NO trae cambio de esquema la otra mitad de esta entrega — la RETENCIÓN.
--    Los posts guardados a mano (`is_manual`) pasan a vivir 120 días (3 × 40)
--    en vez de ser inmortales por llevar estrella. Eso vive en
--    `lib/competencia/retention.ts` y lo aplican el cron
--    `cleanup-competencia-scheduled` y `runScrapeJob`. Se anota acá porque es
--    la misma entrega y porque cambia qué filas sobreviven en esta tabla.
-- ============================================================================

create table if not exists competitor_post_comments (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id)        on delete cascade,
  client_id  uuid not null references clients(id)           on delete cascade,
  post_id    uuid not null references competitor_posts(id)  on delete cascade,
  author_id  uuid not null references auth.users(id)        on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- El hilo siempre se lee entero y en orden: (post_id, created_at) cubre las dos
-- consultas que hace la app (el hilo de una tarjeta y el conteo por lote).
create index if not exists competitor_post_comments_post_idx
  on competitor_post_comments (post_id, created_at);

-- El portal carga de una sola vez las notas de todos los posts de la marca.
create index if not exists competitor_post_comments_client_idx
  on competitor_post_comments (client_id, created_at);

-- `owner_id` lo pone el trigger, nunca el que escribe. La función ya existe
-- desde 0006 (security definer: el miembro no puede leer `clients`).
drop trigger if exists competitor_post_comments_set_owner on competitor_post_comments;
create trigger competitor_post_comments_set_owner
  before insert on competitor_post_comments
  for each row execute function public.set_owner_from_client();

alter table competitor_post_comments enable row level security;

drop policy if exists competitor_post_comments_owner_all on competitor_post_comments;
create policy competitor_post_comments_owner_all on competitor_post_comments
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists competitor_post_comments_member_select on competitor_post_comments;
create policy competitor_post_comments_member_select on competitor_post_comments
  for select using (has_client_access(client_id));

-- El `with check` exige las dos cosas: que la marca sea suya y que no pueda
-- firmar la nota con el nombre de otro. `owner_id` no se valida acá porque
-- todavía no existe cuando corre el check — lo pone el trigger, que es BEFORE.
drop policy if exists competitor_post_comments_member_insert on competitor_post_comments;
create policy competitor_post_comments_member_insert on competitor_post_comments
  for insert
  with check (has_client_access(client_id) and author_id = auth.uid());

comment on table competitor_post_comments is
  'Notas sobre un post de competencia. Las escriben Paco y los miembros del portal; se borran solas con el post (cascade).';

-- ── Verificación (correr a mano después de aplicar) ─────────────────────────
-- select policyname, cmd from pg_policies where tablename = 'competitor_post_comments';
--   → 3 filas: owner_all (ALL), member_select (SELECT), member_insert (INSERT)
-- select tgname from pg_trigger where tgrelid = 'competitor_post_comments'::regclass and not tgisinternal;
--   → competitor_post_comments_set_owner
