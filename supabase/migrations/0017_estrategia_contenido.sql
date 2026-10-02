-- ============================================================================
-- 0017 — Estrategia de contenido por marca + banco de ideas
-- ============================================================================
--
-- QUÉ RESUELVE
--   Hasta acá las ideas salían de AFUERA (Competencia, Tendencias). Faltaba el
--   lado de ADENTRO: quién es el cliente ideal de la marca, cuáles son sus 5
--   pilares de contenido, y un generador que cruce pilar × dolor/deseo/objeción
--   × la taxonomía de Andrea Estratega para crear ideas desde cero.
--
-- QUÉ CAMBIA
--   1. `content_strategies` — UNA fila por marca (PK `client_id`). Texto libre
--      del cliente ideal (avatar, dolores, deseos, objeciones, transformación,
--      diferenciador, fuentes) + `pillars` (jsonb, array de 3-6 pilares).
--      Los pilares van en jsonb y no en tabla propia porque siempre se editan
--      y se leen juntos. La forma del objeto la fija `lib/strategy/pillars.ts`
--      (`sanitizeStrategy` es el único camino de escritura).
--
--   2. `content_ideas` — el banco de ideas guardadas desde el generador.
--      `pillar_key`, `source`, `stage`, `format`, `value_pillar`, `hook_type`,
--      `script_structure` son texto SIN CHECK a propósito: los normaliza
--      `lib/strategy/*` antes de escribir, y un pilar renombrado no debe
--      romper un insert. `used_at` marca la idea que ya se convirtió en guion.
--
--   Las dos son OWNER-ONLY (`owner_id = auth.uid()`). No hay policies de
--   miembro: el portal no ve la estrategia (todavía).
--
-- CÓDIGO QUE DEPENDE DE ESTA MIGRACIÓN
--   - lib/strategy/pillars.ts, lib/strategy/prompts.ts
--   - app/(app)/estrategia/*
--
-- Aditiva e idempotente. Puede ir antes o después del deploy: la app publicada
-- hoy no toca estas tablas, y `/estrategia` sin la migración muestra un aviso
-- en vez de caerse.
-- ============================================================================

create table if not exists content_strategies (
  client_id      uuid primary key references clients(id) on delete cascade,
  owner_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  avatar         text,
  dolores        text,
  deseos         text,
  objeciones     text,
  transformacion text,
  diferenciador  text,
  fuentes        text,
  pillars        jsonb not null default '[]'::jsonb,
  updated_at     timestamptz not null default now()
);

comment on table content_strategies is 'Estrategia de contenido por marca (0017): cliente ideal + pilares. Forma de `pillars`: lib/strategy/pillars.ts.';

alter table content_strategies enable row level security;

drop policy if exists content_strategies_owner_all on content_strategies;
create policy content_strategies_owner_all on content_strategies
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());


create table if not exists content_ideas (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id        uuid not null references clients(id) on delete cascade,
  pillar_key       text,
  source           text,
  stage            text,
  format           text,
  value_pillar     text,
  hook_type        text,
  script_structure text,
  hook             text not null,
  angle            text,
  brief            text not null,
  why              text,
  used_at          timestamptz,
  created_at       timestamptz not null default now()
);

comment on table content_ideas is 'Banco de ideas del generador de /estrategia (0017). used_at = ya se hizo guion.';

create index if not exists content_ideas_client_idx on content_ideas (client_id, created_at desc);

alter table content_ideas enable row level security;

drop policy if exists content_ideas_owner_all on content_ideas;
create policy content_ideas_owner_all on content_ideas
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
