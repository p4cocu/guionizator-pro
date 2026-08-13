-- ============================================================================
-- 0006 — Portal de cliente (Fase D, etapa 1)
-- ============================================================================
-- Qué hace:
--   Abre la app a usuarios externos (los clientes de Paco) sin que dejen de ser
--   invisibles entre sí. Agrega membresías, invitaciones, banderas de secciones
--   por marca, medición del add-on de IA, comentarios sobre guiones, y mueve los
--   secretos de Apify fuera de `clients`.
--
-- Por qué:
--   Hasta hoy toda la RLS es `owner_id = auth.uid()`: un solo usuario ve todo.
--   Ver docs/fase-d-portal-cliente.md.
--
-- Propiedad de seguridad que sostiene esta migración:
--   Un miembro externo solo puede leer filas cuyo `client_id` esté en SUS
--   membresías, y solo de las 8 tablas que el portal necesita. Todo lo demás
--   sigue owner-only y es invisible aunque la UI falle.
--   Tablas que NO se tocan a propósito: brain_versions, hooks, script_hooks,
--   tendencias, resources, own_resources, prompt_styles, ingest_tokens,
--   instagram_accounts, instagram_media, competitor_scrapes, transcription_jobs,
--   script_copies, script_prompts, script_covers, public_resources,
--   resource_leads, resource_page_views.
--
-- Código que depende de esta migración:
--   lib/supabase/service.ts            — cliente con service role (server-only)
--   lib/competencia/apifyToken.ts      — lee el cipher desde `client_secrets`
--   app/(app)/clientes/actions.ts      — save/check/removeApifyToken
--   app/(app)/clientes/[id]/page.tsx   — estado enmascarado del token
--   lib/portal/features.ts             — (etapa 2) fuente de verdad de los slugs
--                                        de `clients.enabled_features`
--
-- ⚠️ ORDEN DE APLICACIÓN — esta migración NO borra las columnas viejas de Apify.
--    Las copia a `client_secrets` y las deja donde están, para que el código que
--    hoy está publicado siga funcionando hasta el deploy. El `drop` va en
--    `0007_drop_apify_cols_de_clients.sql`, que se corre DESPUÉS de
--    `netlify deploy --prod`. Entre 0006 y 0007 no cambies tokens de Apify:
--    la app vieja escribiría en las columnas viejas y el cambio no llegaría a
--    `client_secrets`.
--
-- ⚠️ Idempotente, pero conviene aplicarla con la app quieta: toca RLS de tablas
--    en uso.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Membresías: quién puede entrar a qué marca
-- ────────────────────────────────────────────────────────────────────────────
-- N:N a propósito: normalmente un usuario tiene una marca, pero puede tener
-- varias sin necesidad de una segunda cuenta (y el día que haya cobro, la
-- cantidad de filas por usuario es justamente lo que se factura).
--   viewer       = ve y comenta
--   collaborator = además edita los guiones de su marca (decisión 2026-08-12)

create table if not exists client_members (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id)     on delete cascade,
  user_id    uuid not null references auth.users(id)  on delete cascade,
  role       text not null default 'viewer' check (role in ('viewer','collaborator')),
  created_at timestamptz not null default now(),
  unique (client_id, user_id)
);

create index if not exists client_members_user_idx   on client_members(user_id);
create index if not exists client_members_client_idx on client_members(client_id);

comment on table client_members is
  'Qué usuarios externos tienen acceso a qué marca. Fuente de verdad del portal: nunca el user_metadata de Supabase, que el propio usuario puede editar.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Invitaciones
-- ────────────────────────────────────────────────────────────────────────────
-- Se guarda solo el sha256 del token; el token en claro viaja únicamente en el
-- mail. Si alguien lee esta tabla, no puede aceptar la invitación.

create table if not exists client_invites (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id)    on delete cascade,
  email       text not null,
  role        text not null default 'viewer' check (role in ('viewer','collaborator')),
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists client_invites_client_idx on client_invites(client_id, created_at desc);
create index if not exists client_invites_email_idx  on client_invites(lower(email));

comment on column client_invites.token_hash is
  'sha256 del token de invitación. El token en claro NUNCA se guarda: solo se envía por mail.';


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Secretos fuera de `clients`
-- ────────────────────────────────────────────────────────────────────────────
-- RLS es por fila, no por columna: si un miembro llegara a leer su fila de
-- `clients`, leería también `apify_token_cipher` y las notas internas. Los
-- secretos se mudan a una tabla SIN policies: ni anon ni authenticated pueden
-- tocarla, solo el service role desde el servidor.

create table if not exists client_secrets (
  client_id              uuid primary key references clients(id)    on delete cascade,
  owner_id               uuid not null      references auth.users(id) on delete cascade,
  apify_token_cipher     text,
  apify_token_last4      text,
  apify_token_valid      boolean not null default false,
  apify_token_checked_at timestamptz,
  updated_at             timestamptz not null default now()
);

comment on table client_secrets is
  'Secretos por cliente (hoy: token de Apify cifrado). Sin policies de RLS y sin grants a anon/authenticated: se lee y escribe SOLO con service role desde el servidor.';

-- Copia de los tokens que hoy viven en `clients`. Envuelto en un bloque que
-- chequea que la columna exista, para que re-correr 0006 después de 0007 no
-- reviente.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients'
      and column_name = 'apify_token_cipher'
  ) then
    execute $mig$
      insert into client_secrets (
        client_id, owner_id, apify_token_cipher, apify_token_last4,
        apify_token_valid, apify_token_checked_at
      )
      select id, owner_id, apify_token_cipher, apify_token_last4,
             coalesce(apify_token_valid, false), apify_token_checked_at
      from clients
      where apify_token_cipher is not null
      on conflict (client_id) do nothing
    $mig$;
  end if;
end $$;

alter table client_secrets enable row level security;
-- Sin policies: con RLS activa y cero policies, authenticated no lee ni escribe
-- nada. El revoke es el candado principal; la RLS es el cinturón de seguridad
-- (Supabase otorga grants por default a anon/authenticated en tablas nuevas).
revoke all on public.client_secrets from anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Qué secciones ve cada marca + tope del add-on de IA
-- ────────────────────────────────────────────────────────────────────────────
-- Array con CHECK de contención, para mantener la disciplina de
-- "columna tipo-enum ⇒ CHECK" de CLAUDE.md. La fuente de verdad de los slugs en
-- el código es lib/portal/features.ts: tocar uno obliga a tocar este CHECK en la
-- misma entrega.

alter table clients add column if not exists enabled_features text[] not null default '{}'::text[];

alter table clients drop constraint if exists clients_enabled_features_check;
alter table clients add constraint clients_enabled_features_check
  check (enabled_features <@ array[
    'reportes','guiones','calendario','competencia','instagram','investigacion','generar_ia'
  ]::text[]);

-- Add-on de IA: tope mensual de generaciones. null = sin tope.
-- Se mide contra ai_usage_log. La API key de Anthropic la paga Paco (a
-- diferencia de Apify, no hay key por cliente), por eso nace apagado.
alter table clients add column if not exists ai_generation_limit int;

comment on column clients.enabled_features is
  'Secciones que ve este cliente en /portal. Vacío = no ve ninguna. Los slugs deben coincidir con lib/portal/features.ts y con el CHECK de esta columna.';


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Medición del add-on de IA
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists ai_usage_log (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  client_id     uuid not null references clients(id)    on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null,
  input_tokens  int,
  output_tokens int,
  created_at    timestamptz not null default now()
);

create index if not exists ai_usage_log_client_idx on ai_usage_log(client_id, created_at desc);
create index if not exists ai_usage_log_owner_idx  on ai_usage_log(owner_id, created_at desc);

comment on table ai_usage_log is
  'Una fila por generación con IA disparada desde el portal. Alimenta el tope de clients.ai_generation_limit y el consumo que se muestra en /clientes/[id].';


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Comentarios del cliente sobre un guion + aprobación + rastro de edición
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists script_comments (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  client_id  uuid not null references clients(id)    on delete cascade,
  script_id  uuid not null references scripts(id)    on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists script_comments_script_idx on script_comments(script_id, created_at);

alter table scripts add column if not exists client_approved_at timestamptz;
-- Rastro de quién tocó el guion por última vez: con el cliente editando, hace
-- falta poder distinguir "lo cambié yo" de "lo cambió el cliente".
alter table scripts add column if not exists last_edited_by uuid references auth.users(id);
alter table scripts add column if not exists last_edited_at timestamptz;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. Funciones de acceso
-- ────────────────────────────────────────────────────────────────────────────
-- `security definer` es OBLIGATORIO acá: sin él, una policy sobre client_members
-- que consulta client_members entra en recursión de RLS. Además permite mirar
-- `clients` sin darle al miembro permiso de leer esa tabla.

create or replace function public.has_client_access(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1 from clients c
           where c.id = p_client_id and c.owner_id = auth.uid()
         )
      or exists (
           select 1 from client_members m
           where m.client_id = p_client_id and m.user_id = auth.uid()
         );
$$;

comment on function public.has_client_access(uuid) is
  'true si el usuario actual es dueño de la marca o miembro de ella. security definer para evitar recursión de RLS sobre client_members.';

create or replace function public.is_client_owner(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from clients c
    where c.id = p_client_id and c.owner_id = auth.uid()
  );
$$;

create or replace function public.is_client_collaborator(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from client_members m
    where m.client_id = p_client_id
      and m.user_id = auth.uid()
      and m.role = 'collaborator'
  );
$$;

grant execute on function public.has_client_access(uuid)      to authenticated;
grant execute on function public.is_client_owner(uuid)        to authenticated;
grant execute on function public.is_client_collaborator(uuid) to authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 8. Triggers
-- ────────────────────────────────────────────────────────────────────────────

-- Regla de oro del insert: cuando escribe un miembro, `owner_id` tiene que
-- quedar en el DUEÑO de la marca. Si quedara en el miembro, la fila
-- desaparecería de la vista de Paco (su RLS es owner_id = auth.uid()).
-- security definer porque el miembro no puede leer `clients`.
create or replace function public.set_owner_from_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.owner_id := (select owner_id from clients where id = new.client_id);
  if new.owner_id is null then
    raise exception 'Cliente % inexistente', new.client_id;
  end if;
  return new;
end;
$$;

drop trigger if exists script_comments_set_owner on script_comments;
create trigger script_comments_set_owner
  before insert on script_comments
  for each row execute function public.set_owner_from_client();

-- El cliente edita su guion como Paco, pero no puede APROPIÁRSELO: el guion
-- sigue siendo del dueño y sigue perteneciendo a la misma marca. RLS no puede
-- limitar columnas, así que las columnas de identidad se congelan acá.
-- También deja el rastro de quién editó.
create or replace function public.scripts_guard_member_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sin sesión de usuario (service role: crons, background functions): no se
  -- toca nada, para no pisar last_edited_by con null.
  if auth.uid() is null then
    return new;
  end if;

  if auth.uid() is distinct from old.owner_id then
    new.owner_id  := old.owner_id;
    new.client_id := old.client_id;
  end if;

  new.last_edited_by := auth.uid();
  new.last_edited_at := now();
  return new;
end;
$$;

drop trigger if exists scripts_guard_update on scripts;
create trigger scripts_guard_update
  before update on scripts
  for each row execute function public.scripts_guard_member_update();


-- ────────────────────────────────────────────────────────────────────────────
-- 9. Policies
-- ────────────────────────────────────────────────────────────────────────────
-- Todas las policies existentes son PERMISSIVE, así que las de abajo se SUMAN
-- (OR) sin modificar ni una sola policy de dueño. Ninguna de estas líneas puede
-- quitarle acceso a Paco.

-- 9.1 Administración de membresías e invitaciones: solo el dueño de la marca.
alter table client_members enable row level security;

drop policy if exists client_members_owner_all on client_members;
create policy client_members_owner_all on client_members
  for all
  using (is_client_owner(client_id))
  with check (is_client_owner(client_id));

-- El miembro necesita leer SUS membresías para que el portal sepa qué marcas
-- mostrarle. Solo las suyas: no ve quién más está en la marca.
drop policy if exists client_members_self_select on client_members;
create policy client_members_self_select on client_members
  for select
  using (user_id = auth.uid());

alter table client_invites enable row level security;

drop policy if exists client_invites_owner_all on client_invites;
create policy client_invites_owner_all on client_invites
  for all
  using (is_client_owner(client_id))
  with check (is_client_owner(client_id));
-- El invitado NO tiene policy: aceptar la invitación se resuelve server-side
-- con service role, que valida hash + vencimiento + que el mail coincida.

-- 9.2 Lectura de miembros sobre las tablas del portal.
drop policy if exists scripts_member_select on scripts;
create policy scripts_member_select on scripts
  for select using (has_client_access(client_id));

drop policy if exists reports_member_select on reports;
create policy reports_member_select on reports
  for select using (has_client_access(client_id));

drop policy if exists content_calendar_member_select on content_calendar;
create policy content_calendar_member_select on content_calendar
  for select using (has_client_access(client_id));

drop policy if exists competitor_posts_member_select on competitor_posts;
create policy competitor_posts_member_select on competitor_posts
  for select using (has_client_access(client_id));

drop policy if exists competitors_member_select on competitors;
create policy competitors_member_select on competitors
  for select using (has_client_access(client_id));

drop policy if exists client_research_member_select on client_research;
create policy client_research_member_select on client_research
  for select using (has_client_access(client_id));

drop policy if exists client_products_member_select on client_products;
create policy client_products_member_select on client_products
  for select using (has_client_access(client_id));

-- 9.3 Escritura de miembros: edición de guiones (rol collaborator).
-- No hay policy de INSERT ni de DELETE: el cliente edita lo que existe, no crea
-- ni borra guiones. El trigger `scripts_guard_update` impide que se lleve el
-- guion a otra marca o lo ponga a su nombre.
drop policy if exists scripts_member_update on scripts;
create policy scripts_member_update on scripts
  for update
  using (is_client_collaborator(client_id))
  with check (is_client_collaborator(client_id));

-- 9.4 Comentarios.
alter table script_comments enable row level security;

drop policy if exists script_comments_owner_all on script_comments;
create policy script_comments_owner_all on script_comments
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists script_comments_member_select on script_comments;
create policy script_comments_member_select on script_comments
  for select using (has_client_access(client_id));

-- `owner_id` lo pone el trigger, no el cliente. El with check solo exige que la
-- marca sea suya y que no pueda firmar el comentario con el nombre de otro.
drop policy if exists script_comments_member_insert on script_comments;
create policy script_comments_member_insert on script_comments
  for insert
  with check (has_client_access(client_id) and author_id = auth.uid());

-- 9.5 Consumo de IA: solo lo ve el dueño. Los inserts los hace el servidor con
-- service role, para que el cliente no pueda borrar ni falsear su consumo.
alter table ai_usage_log enable row level security;

drop policy if exists ai_usage_log_owner_select on ai_usage_log;
create policy ai_usage_log_owner_select on ai_usage_log
  for select using (owner_id = auth.uid());


-- ────────────────────────────────────────────────────────────────────────────
-- 10. Vista `portal_clients`
-- ────────────────────────────────────────────────────────────────────────────
-- El portal necesita el nombre de la marca y sus banderas, NO la fila entera de
-- `clients` (que trae notas internas y, hasta 0007, el token de Apify cifrado).
--
-- ⚠️ Se deja a propósito con `security_invoker` APAGADO (el default). Eso
--    significa que la vista NO aplica la RLS de `clients`: el control de acceso
--    es el `where has_client_access(id)` de acá abajo. Se lee como un bug y no
--    lo es — sin eso, un miembro necesitaría permiso de select sobre `clients`,
--    que es justamente lo que estamos evitando.
--    El linter de Supabase lo va a marcar como `security_definer_view`.

create or replace view portal_clients as
  select id, nombre, marca, nicho, enabled_features, ai_generation_limit
  from clients
  where has_client_access(id);

grant select on public.portal_clients to authenticated;

comment on view portal_clients is
  'Lo único de `clients` que puede ver un miembro del portal. security_invoker apagado a propósito: el filtro es el where has_client_access(id).';


-- ============================================================================
-- VERIFICACIÓN — correr después de aplicar (ver instrucciones al pie)
-- ============================================================================
-- El SQL Editor corre como `postgres` y SALTEA la RLS. Para probar de verdad hay
-- que suplantar el JWT del usuario. Todo va dentro de begin/rollback para que
-- `set local` no quede pegado en la sesión.
--
-- Preparación:
--   1. Authentication → Add user → crear p.ej. paco+test@tudominio.com
--   2. Copiar su uid y el id del cliente A (una sola marca):
--        select id, nombre from clients order by nombre;
--   3. insert into client_members (client_id, user_id, role)
--      values ('<CLIENTE_A>', '<UID_MIEMBRO>', 'collaborator');
--
-- ── A. Foto previa (correr ANTES de la migración, con tu usuario) ───────────
-- select 'scripts' t, count(*) from scripts
-- union all select 'reports', count(*) from reports
-- union all select 'content_calendar', count(*) from content_calendar
-- union all select 'competitor_posts', count(*) from competitor_posts
-- union all select 'competitors', count(*) from competitors
-- union all select 'client_research', count(*) from client_research
-- union all select 'client_products', count(*) from client_products;
--
-- ── B. Qué ve el miembro (debe ver SOLO lo del cliente A) ───────────────────
-- begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<UID_MIEMBRO>","role":"authenticated"}';
--
--   select auth.uid();                                  -- confirma la suplantación
--
--   -- Lo suyo: cada conteo debe coincidir con el del cliente A
--   select 'scripts' t, count(*) from scripts
--   union all select 'reports', count(*) from reports
--   union all select 'content_calendar', count(*) from content_calendar
--   union all select 'competitor_posts', count(*) from competitor_posts
--   union all select 'competitors', count(*) from competitors
--   union all select 'client_research', count(*) from client_research
--   union all select 'client_products', count(*) from client_products;
--
--   select count(distinct client_id) from scripts;      -- 1
--   select id, nombre from portal_clients;              -- solo el cliente A
--
--   -- Lo que NO debe ver: todos en 0 (o permission denied en client_secrets)
--   select 'clients' t, count(*) from clients
--   union all select 'hooks', count(*) from hooks
--   union all select 'resources', count(*) from resources
--   union all select 'own_resources', count(*) from own_resources
--   union all select 'tendencias', count(*) from tendencias
--   union all select 'brain_versions', count(*) from brain_versions
--   union all select 'competitor_scrapes', count(*) from competitor_scrapes
--   union all select 'instagram_accounts', count(*) from instagram_accounts
--   union all select 'ai_usage_log', count(*) from ai_usage_log;
--   select count(*) from client_secrets;                -- permission denied ← el que importa
-- rollback;
--
-- ── C. Qué puede escribir el miembro ────────────────────────────────────────
-- begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<UID_MIEMBRO>","role":"authenticated"}';
--
--   -- Comentario en su marca: PASA, y owner_id queda en el dueño (no en él)
--   insert into script_comments (client_id, script_id, author_id, body)
--   values ('<CLIENTE_A>', '<ID_GUION_DE_A>', auth.uid(), 'prueba')
--   returning owner_id, author_id;                      -- owner_id = TU uid
--
--   -- Comentario en una marca ajena: FALLA (violates row-level security)
--   insert into script_comments (client_id, script_id, author_id, body)
--   values ('<CLIENTE_B>', '<ID_GUION_DE_B>', auth.uid(), 'no deberia entrar');
--
--   -- Editar un guion de su marca: PASA (rol collaborator)
--   -- (la columna es `title`, no `titulo`)
--   update scripts set title = coalesce(title,'') || ' (editado por el cliente)'
--   where id = '<ID_GUION_DE_A>' returning last_edited_by, owner_id;
--
--   -- Robarse el guion: PASA el update pero el trigger revierte las columnas.
--   -- owner_id y client_id vuelven a los originales.
--   update scripts set owner_id = auth.uid(), client_id = '<CLIENTE_B>'
--   where id = '<ID_GUION_DE_A>' returning owner_id, client_id;
--
--   -- Borrar un guion: 0 filas (no hay policy de delete para miembros)
--   delete from scripts where id = '<ID_GUION_DE_A>';
--
--   -- Editar un guion de otra marca: 0 filas
--   update scripts set title = 'x' where id = '<ID_GUION_DE_B>';
-- rollback;
--
-- ── D. No-regresión: vos tenés que ver EXACTAMENTE lo mismo que antes ───────
-- begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<TU_UID>","role":"authenticated"}';
--   -- misma consulta de conteos del paso A: debe dar idéntico
-- rollback;
--
-- ── E. Que los secretos se copiaron bien (antes de correr 0007) ─────────────
-- select c.nombre, s.apify_token_last4, s.apify_token_valid
-- from clients c left join client_secrets s on s.client_id = c.id
-- order by c.nombre;
-- ============================================================================
