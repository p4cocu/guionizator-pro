-- ============================================================================
-- 0009 — Add-on de generación con IA en el portal (Fase D, etapa 6)
-- ============================================================================
--
-- QUÉ CAMBIA
--   1. `scripts.generated_by`     — quién generó el guion desde el portal.
--                                    NULL = lo hizo Paco en el estudio.
--   2. `clients.ai_generation_mode` — columna TIPO-ENUM con CHECK: qué flujo ve
--                                    el cliente en /portal/[id]/generar.
--                                    'simple'   = brief → guion (1 llamada)
--                                    'completo' = brief → Big Idea → estructuras → guion
--   3. La vista `portal_clients` suma `ai_generation_mode` (el miembro NO puede
--      leer `clients`: la vista es su única ventana a esa tabla).
--   4. El trigger `scripts_guard_update` congela también `generated_by`, por el
--      mismo motivo que ya congelaba `owner_id`/`client_id`: la RLS es por fila,
--      no por columna, y un `collaborator` puede hacer UPDATE de este guion.
--
-- POR QUÉ NO HAY POLICIES NUEVAS
--   El cliente NO escribe `scripts` ni `ai_usage_log` con su sesión. Si tuviera
--   policy de insert podría llamar a PostgREST directo con su JWT y crear
--   guiones sin pasar por el medidor — es decir, saltarse el tope de un add-on
--   de PAGO. Todo el guardado y todo el log van con SERVICE ROLE desde el
--   servidor (`lib/portal/generate.ts`), que filtra la pertenencia a mano.
--
-- CÓDIGO QUE DEPENDE DE ESTA MIGRACIÓN
--   - lib/portal/generationMode.ts  (fuente de verdad de los slugs del CHECK)
--   - lib/portal/generate.ts        (genera, guarda y registra el consumo)
--   - lib/portal/usage.ts           (tope mensual)
--   - lib/portal/access.ts          (lee ai_generation_mode de la vista)
--   - app/api/portal/generar/*      (las 3 rutas del flujo)
--   - app/(portal)/portal/[clientId]/generar/*
--   - app/(app)/clientes/portalActions.ts  (setAiGenerationMode)
--   - app/(app)/guiones/**          (badge "Generado por el cliente")
--
-- ⚠️ REGLA DURA (CLAUDE.md): tocar un valor de `ai_generation_mode` exige
--    cambiar EN EL MISMO CAMBIO el CHECK de acá, la tabla de CLAUDE.md y
--    `lib/portal/generationMode.ts`.
--
-- CUÁNDO SE APLICA: **ANTES** del deploy, como la 0008. Es puramente aditiva —
--    la app publicada hoy no selecciona ninguna de estas dos columnas, así que
--    sigue funcionando igual entre la migración y el deploy. Al revés no: si se
--    deploya primero, `/portal` pide `ai_generation_mode` a una vista que
--    todavía no la tiene y la pantalla se cae.
--
-- Idempotente: se puede correr dos veces sin romper nada.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Quién generó el guion
-- ────────────────────────────────────────────────────────────────────────────
-- Sin CHECK (es una FK a auth.users). Nullable a propósito: los miles de
-- guiones que ya existen son de Paco y quedan en NULL.

alter table scripts
  add column if not exists generated_by uuid references auth.users(id);

create index if not exists scripts_generated_by_idx
  on scripts(generated_by)
  where generated_by is not null;

comment on column scripts.generated_by is
  'Miembro del portal que generó este guion con el add-on de IA. NULL = lo generó el dueño desde el estudio. Lo escribe lib/portal/generate.ts con service role.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Modo de generación por cliente (columna tipo-enum ⇒ CHECK)
-- ────────────────────────────────────────────────────────────────────────────
-- 'simple' es el default a propósito: un cliente no es guionista, y el flujo
-- largo (Big Idea + elegir estructura) es jerga de taller. Paco lo sube a
-- 'completo' marca por marca cuando el cliente banca el proceso.

alter table clients
  add column if not exists ai_generation_mode text not null default 'simple';

alter table clients
  drop constraint if exists clients_ai_generation_mode_check;

alter table clients
  add constraint clients_ai_generation_mode_check
  check (ai_generation_mode in ('simple', 'completo'));

comment on column clients.ai_generation_mode is
  'Flujo que ve este cliente en /portal/[id]/generar: simple (brief → guion) o completo (brief → Big Idea → estructuras → guion). Los valores deben coincidir con lib/portal/generationMode.ts y con el CHECK de esta columna.';


-- ────────────────────────────────────────────────────────────────────────────
-- 3. La vista del portal suma la columna nueva
-- ────────────────────────────────────────────────────────────────────────────
-- Un miembro NO tiene select sobre `clients` (trae notas internas): esta vista
-- es su única ventana. Agregar la columna AL FINAL es lo único que `create or
-- replace view` permite — no se puede reordenar ni renombrar lo existente.
--
-- ⚠️ Sigue con `security_invoker` APAGADO (el default), igual que en 0006: el
--    control de acceso es su propio `where has_client_access(id)`. El linter de
--    Supabase lo marca como `security_definer_view` y es esperado.

create or replace view portal_clients as
  select id, nombre, marca, nicho, enabled_features, ai_generation_limit, ai_generation_mode
  from clients
  where has_client_access(id);

grant select on public.portal_clients to authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. `generated_by` también se congela en el UPDATE de un miembro
-- ────────────────────────────────────────────────────────────────────────────
-- Mismo motivo que `owner_id`/`client_id`: la policy `scripts_member_update` le
-- da al rol `collaborator` un UPDATE de fila entera, y la RLS no limita
-- columnas. Sin esto, un cliente podría atribuirse (o desatribuirse) un guion.
-- El resto de la función es idéntico a 0006; se reescribe completa porque
-- `create or replace function` no admite parches parciales.

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
    new.owner_id     := old.owner_id;
    new.client_id    := old.client_id;
    new.generated_by := old.generated_by;
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


-- ============================================================================
-- VERIFICACIÓN — correr después de aplicar
-- ============================================================================
-- 1. Las dos columnas y el CHECK existen:
--
--    select column_name, data_type, column_default
--    from information_schema.columns
--    where (table_name = 'scripts'  and column_name = 'generated_by')
--       or (table_name = 'clients'  and column_name = 'ai_generation_mode');
--
--    select conname, pg_get_constraintdef(oid)
--    from pg_constraint where conname = 'clients_ai_generation_mode_check';
--
-- 2. El CHECK realmente corta (esto DEBE fallar):
--
--    update clients set ai_generation_mode = 'medio' where id = '<uuid>';
--    -- ERROR: new row violates check constraint "clients_ai_generation_mode_check"
--
-- 3. La vista devuelve la columna nueva:
--
--    select id, ai_generation_mode from portal_clients limit 1;
--
-- 4. Ningún guion existente quedó atribuido a nadie:
--
--    select count(*) from scripts where generated_by is not null;  -- 0
-- ============================================================================
