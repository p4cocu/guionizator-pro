-- ============================================================================
-- 0013 — Cobro con Stripe (Fase E)
-- ============================================================================
--
-- QUÉ CAMBIA
--   1. `client_subscriptions` — una fila por MARCA (no por persona). Estado de
--      la suscripción de Stripe, ciclo de facturación, saldo de recargas,
--      exención y quién es el contacto de facturación.
--   2. `credit_purchases`     — una fila por recarga PAGADA. Su
--      `stripe_checkout_session_id` unique ES la idempotencia de la acreditación.
--   3. `stripe_events`        — un `evt_...` por evento ya procesado. El webhook
--      inserta con `on conflict do nothing`: si no insertó, ya corrió y sale.
--   4. `ai_usage_log.paid_with` — columna TIPO-ENUM con CHECK: si esa generación
--      salió del cupo del plan o de una recarga comprada.
--   5. Backfill: TODAS las marcas que existen hoy nacen **exentas**.
--
-- POR QUÉ SE COBRA POR MARCA Y NO POR PERSONA
--   Una suscripción de $300 MXN/mes por cliente; adentro pueden entrar 2, 3 o 5
--   miembros sin costo extra. El cupo de IA es de la marca y se COMPARTE entre
--   sus miembros: si uno se lo gasta, la marca se queda sin cupo hasta el
--   próximo ciclo o hasta comprar una recarga.
--
-- POR QUÉ `billing_contact_user_id` Y NO UN ROL NUEVO
--   Solo quien pagó puede comprar créditos y ver la facturación. Agregar un rol
--   a `client_members.role` obligaría a tocar su CHECK y arrastraría
--   `lib/portal/roles.ts`, la UI de miembros y las policies de `scripts`. Un
--   uuid en la suscripción resuelve lo mismo sin mover nada de eso.
--
-- POR QUÉ `exempt` ES UNA COLUMNA APARTE Y NO UN VALOR DE `status`
--   `status` espeja LITERALMENTE lo que dice Stripe, y lo escribe el webhook.
--   Si la exención viviera ahí, un `customer.subscription.updated` que llegara
--   tarde (los webhooks NO llegan en orden) podría pisar una exención y cortarle
--   el acceso a una marca tuya. Separadas, ningún evento de Stripe puede tocar
--   la decisión de negocio.
--
-- POR QUÉ EL SALDO DE RECARGAS ES UN CONTADOR Y NO UN CÁLCULO
--   Las recargas NO vencen, pero el cupo del plan se reinicia cada ciclo.
--   Derivar "cuántos créditos comprados quedan" exigiría recorrer todos los
--   ciclos cerrados sumando excedentes. `credit_balance` es el saldo real, y
--   `ai_usage_log.paid_with` deja el rastro de por qué bajó.
--
-- SEGURIDAD — LAS TRES TABLAS CON RLS ACTIVA **Y SIN NINGUNA POLICY**
--   Mismo patrón que `client_secrets` (0006) y `portal_profiles` (0012): se leen
--   y se escriben SOLO con service role desde el servidor (`lib/billing/*`).
--   Es la misma regla que ya rige `ai_usage_log`: con su JWT y la anon key, un
--   miembro del portal puede llamar a PostgREST directo — darle policy de
--   update sobre `credit_balance` sería regalarle el medidor de un producto de
--   PAGO. Como el service role saltea la RLS, TODA consulta filtra la
--   pertenencia a mano.
--
-- CÓDIGO QUE DEPENDE DE ESTA MIGRACIÓN
--   - lib/billing/plan.ts          (módulo puro: 40 créditos, packs, price ids)
--   - lib/billing/status.ts        (fuente de verdad del CHECK de `status`)
--   - lib/billing/subscription.ts  (único acceso a `client_subscriptions`)
--   - lib/billing/credits.ts       (saldo, decremento atómico, acreditación)
--   - lib/billing/access.ts        (getBillingState → quién entra y quién no)
--   - app/api/stripe/webhook/route.ts   (⚠️ va en PUBLIC_PATHS)
--   - app/api/billing/{checkout,credits,portal}/route.ts
--   - lib/portal/usage.ts               (corte por CICLO, ya no por mes)
--   - lib/competencia/transcriptionUsage.ts  (idem)
--   - lib/portal/generate.ts            (assertCanGenerate mira plan + saldo)
--   - lib/portal/access.ts              (requirePortalClient corta por impago)
--   - lib/reports/load.ts               (el link directo al .xlsx también corta)
--   - app/(app)/clientes/[id]/BillingSection.tsx
--
-- ⚠️ REGLA DURA (CLAUDE.md): tocar un valor de `client_subscriptions.status` o
--    de `ai_usage_log.paid_with` exige cambiar EN EL MISMO CAMBIO el CHECK de
--    acá, la tabla de CLAUDE.md y `lib/billing/status.ts` / `lib/billing/plan.ts`.
--
-- ⚠️ CAMBIA EL SIGNIFICADO DE `clients.ai_generation_limit`
--    Antes: `null` = SIN TOPE.  Ahora: `null` = el tope del plan (40).
--    Por eso el backfill deja exentas a todas las marcas de hoy: para una marca
--    exenta `null` sigue queriendo decir sin tope. Lo mismo con
--    `clients.transcription_limit`.
--
-- CUÁNDO SE APLICA: **ANTES** de cualquier deploy de Fase E. Es puramente
--    aditiva y el código publicado hoy no conoce ninguna de estas tablas ni la
--    columna nueva, así que la app sigue funcionando igual entre la migración y
--    el deploy. Al revés no: el código nuevo consulta `client_subscriptions` en
--    cada request del portal.
--
-- Idempotente: se puede correr dos veces sin romper nada.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Suscripción por marca
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.client_subscriptions (
  client_id               uuid primary key references public.clients(id) on delete cascade,

  -- Se filtra a mano en cada consulta: el service role no tiene RLS debajo.
  owner_id                uuid not null references auth.users(id) on delete cascade,

  -- Quién pagó. Único que compra créditos y ve /portal/[id]/facturacion.
  -- `on delete set null`: si esa persona borra su cuenta, la marca NO se cae —
  -- queda sin contacto y Paco reasigna.
  billing_contact_user_id uuid references auth.users(id) on delete set null,

  -- `unique` sobre columna nullable: Postgres permite muchos NULL, así que
  -- todas las marcas exentas (sin Stripe) conviven sin chocar.
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,

  -- Espeja lo que dice Stripe. Lo escribe SOLO el webhook.
  status                  text not null default 'incomplete',

  -- Decisión de Paco, no de Stripe. Una marca exenta nunca se corta y no tiene
  -- tope de IA ni de transcripción.
  exempt                  boolean not null default false,

  -- El ciclo de facturación. Reemplaza al mes calendario UTC como referencia
  -- del cupo (ver lib/portal/usage.ts).
  current_period_start    timestamptz,
  current_period_end      timestamptz,

  -- Lo pone el webhook al PRIMER invoice.payment_failed; lo limpia invoice.paid.
  -- El corte se calcula en lectura (`now() >= grace_until`), no hay cron.
  grace_until             timestamptz,

  cancel_at_period_end    boolean not null default false,

  -- Saldo de recargas compradas. No vence. Baja de a 1 cuando el cupo del plan
  -- del ciclo ya se agotó.
  credit_balance          integer not null default 0,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ⚠️ COLUMNA TIPO-ENUM. Los mismos valores viven en lib/billing/status.ts y en
--    la tabla de CLAUDE.md. Agregar uno acá sin agregarlo allá (o al revés)
--    revienta el UPDATE del webhook en runtime.
alter table public.client_subscriptions
  drop constraint if exists client_subscriptions_status_check;
alter table public.client_subscriptions
  add constraint client_subscriptions_status_check
  check (status in ('incomplete', 'active', 'past_due', 'canceled'));

-- El saldo nunca puede quedar negativo. El decremento en TypeScript ya lleva
-- `where credit_balance > 0`; esto es el cinturón por si alguien escribe a mano.
alter table public.client_subscriptions
  drop constraint if exists client_subscriptions_credit_balance_check;
alter table public.client_subscriptions
  add constraint client_subscriptions_credit_balance_check
  check (credit_balance >= 0);

create index if not exists client_subscriptions_owner_idx
  on public.client_subscriptions (owner_id);

alter table public.client_subscriptions enable row level security;
revoke all on public.client_subscriptions from anon, authenticated;

comment on table public.client_subscriptions is
  'Suscripción de Stripe por marca (Fase E). Solo service role (RLS sin policies), igual que client_secrets.';
comment on column public.client_subscriptions.exempt is
  'Marca interna o de cortesía: no paga y nunca se corta. Decisión de Paco, ningún webhook la toca.';
comment on column public.client_subscriptions.credit_balance is
  'Saldo de recargas compradas. No vence. Se descuenta solo cuando el cupo del ciclo ya se agotó.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Recargas de crédito (pago único)
-- ────────────────────────────────────────────────────────────────────────────
-- Una fila por compra PAGADA. `stripe_checkout_session_id` unique es lo que
-- impide acreditar dos veces la misma recarga si Stripe reenvía el evento: el
-- insert falla por conflicto y el saldo no se toca.
--
-- ⚠️ `credits` se resuelve del `price_id` que viene en el evento de Stripe
--    (lib/billing/plan.ts), NUNCA de nada que haya mandado el browser. Si
--    viniera del body, cualquiera compraría 20 y reclamaría 5000.

create table if not exists public.credit_purchases (
  id                         uuid primary key default gen_random_uuid(),
  client_id                  uuid not null references public.clients(id) on delete cascade,
  owner_id                   uuid not null references auth.users(id) on delete cascade,
  purchased_by               uuid references auth.users(id) on delete set null,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id   text,
  credits                    integer not null,
  amount_cents               integer,
  currency                   text not null default 'mxn',
  created_at                 timestamptz not null default now()
);

alter table public.credit_purchases
  drop constraint if exists credit_purchases_credits_check;
alter table public.credit_purchases
  add constraint credit_purchases_credits_check
  check (credits > 0);

create index if not exists credit_purchases_client_idx
  on public.credit_purchases (client_id, created_at desc);

alter table public.credit_purchases enable row level security;
revoke all on public.credit_purchases from anon, authenticated;

comment on table public.credit_purchases is
  'Recargas de crédito pagadas (Fase E). Solo service role. El unique de la checkout session es la idempotencia.';


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Eventos de Stripe ya procesados (idempotencia del webhook)
-- ────────────────────────────────────────────────────────────────────────────
-- Stripe REINTENTA cualquier evento al que no le respondas 2xx, y puede mandar
-- el mismo evento más de una vez aunque le hayas respondido bien. Sin esta
-- tabla, un reintento de `checkout.session.completed` acreditaría la recarga
-- dos veces.
--
-- El handler hace `insert ... on conflict (id) do nothing` ANTES de tocar nada:
-- si no insertó ninguna fila, el evento ya se procesó → responde 200 y sale.

create table if not exists public.stripe_events (
  id          text primary key,   -- el `evt_...` de Stripe
  type        text not null,
  received_at timestamptz not null default now(),
  -- Se guarda para poder depurar un cobro que salió raro sin pedirle el log a
  -- Stripe. Stripe NUNCA manda el número de tarjeta acá. Si algún día molesta
  -- el tamaño, se puede vaciar con un update: no lo lee ningún código.
  payload     jsonb
);

create index if not exists stripe_events_received_idx
  on public.stripe_events (received_at desc);

alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

comment on table public.stripe_events is
  'Eventos de Stripe ya procesados (Fase E). Guard de idempotencia del webhook. Solo service role.';


-- ────────────────────────────────────────────────────────────────────────────
-- 3.bis. Acreditar una recarga, atómicamente
-- ────────────────────────────────────────────────────────────────────────────
-- Acreditar son DOS escrituras: dejar la fila en `credit_purchases` (que es el
-- guard de idempotencia) y sumar el saldo. Hechas por separado desde
-- TypeScript hay un hueco real: si la primera entra y la segunda falla, Stripe
-- reintenta el evento, el insert choca con el unique, el código lo lee como
-- "ya estaba acreditado" y el cliente pagó por créditos que nunca recibió.
--
-- Adentro de una función plpgsql las dos van en la misma transacción: si el
-- update falla, el insert se deshace, Stripe reintenta y la segunda vez sale
-- limpio.
--
-- Devuelve TRUE si acreditó, FALSE si ese `checkout_session_id` ya estaba
-- (reintento de Stripe) — el webhook responde 200 igual en los dos casos.
--
-- ⚠️ `security invoker` (el default) a propósito, y REVOKE explícito abajo.
--    PostgREST expone las funciones del esquema `public`: sin el revoke, un
--    miembro del portal con su JWT podría llamar a este RPC y regalarse
--    créditos. Con `invoker` + revoke hay dos candados — aunque alguien
--    restaurara el grant, la RLS de las tablas lo pararía igual.

create or replace function public.apply_credit_purchase(
  p_client_id          uuid,
  p_owner_id           uuid,
  p_purchased_by       uuid,
  p_session_id         text,
  p_payment_intent_id  text,
  p_credits            integer,
  p_amount_cents       integer,
  p_currency           text
)
returns boolean
language plpgsql
as $$
declare
  v_inserted integer;
begin
  insert into public.credit_purchases (
    client_id, owner_id, purchased_by,
    stripe_checkout_session_id, stripe_payment_intent_id,
    credits, amount_cents, currency
  )
  values (
    p_client_id, p_owner_id, p_purchased_by,
    p_session_id, p_payment_intent_id,
    p_credits, p_amount_cents, coalesce(p_currency, 'mxn')
  )
  on conflict (stripe_checkout_session_id) do nothing;

  get diagnostics v_inserted = row_count;

  -- Ya estaba acreditada: Stripe reenvió el evento. No se toca el saldo.
  if v_inserted = 0 then
    return false;
  end if;

  update public.client_subscriptions
     set credit_balance = credit_balance + p_credits,
         updated_at     = now()
   where client_id = p_client_id;

  return true;
end;
$$;

revoke all on function public.apply_credit_purchase(
  uuid, uuid, uuid, text, text, integer, integer, text
) from public, anon, authenticated;

comment on function public.apply_credit_purchase(
  uuid, uuid, uuid, text, text, integer, integer, text
) is
  'Acredita una recarga (compra + saldo) en una sola transacción. Solo service role: el REVOKE es lo que impide que un miembro se regale créditos vía PostgREST.';


-- ────────────────────────────────────────────────────────────────────────────
-- 3.ter. Descontar un crédito comprado
-- ────────────────────────────────────────────────────────────────────────────
-- Va como función y no como UPDATE desde TypeScript por una razón concreta:
-- PostgREST no acepta expresiones de columna (`credit_balance = credit_balance
-- - 1`) en un update. Leer el saldo, restarle uno en JS y escribirlo de vuelta
-- sería una condición de carrera con dinero adentro.
--
-- El `and credit_balance > 0` es lo que hace la operación segura sin necesidad
-- de transacción explícita: Postgres resuelve el UPDATE fila por fila, así que
-- dos requests simultáneos no pueden llevarse el mismo último crédito, y el
-- saldo nunca queda negativo.
--
-- Devuelve TRUE si descontó, FALSE si no había saldo.
--
-- ⚠️ Mismo REVOKE que arriba: sin él, cualquiera con un JWT podría llamar al
--    RPC y quemarle los créditos a su propia marca.

create or replace function public.consume_client_credit(p_client_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_rows integer;
begin
  update public.client_subscriptions
     set credit_balance = credit_balance - 1,
         updated_at     = now()
   where client_id = p_client_id
     and credit_balance > 0;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.consume_client_credit(uuid) from public, anon, authenticated;

comment on function public.consume_client_credit(uuid) is
  'Descuenta un crédito comprado, atómicamente. Devuelve false si no hay saldo. Solo service role.';


-- ────────────────────────────────────────────────────────────────────────────
-- 4. De dónde salió cada generación: del plan o de una recarga
-- ────────────────────────────────────────────────────────────────────────────
-- ⚠️ COLUMNA TIPO-ENUM. Espeja `AiPaymentSource` en lib/billing/plan.ts.
--
-- Sin esto, `credit_balance` bajaría sin dejar rastro de por qué y no habría
-- forma de auditar un reclamo ("compré 20 y me quedan 12"). El default 'plan'
-- deja las filas viejas coherentes: todas se generaron antes de que existieran
-- las recargas.

alter table public.ai_usage_log
  add column if not exists paid_with text not null default 'plan';

alter table public.ai_usage_log
  drop constraint if exists ai_usage_log_paid_with_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_paid_with_check
  check (paid_with in ('plan', 'credit'));

comment on column public.ai_usage_log.paid_with is
  'plan = salió del cupo incluido del ciclo. credit = descontó una recarga comprada.';


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Índices para el conteo del ciclo
-- ────────────────────────────────────────────────────────────────────────────
-- Los dos conteos pasan a estar en el camino caliente: corren ANTES de cada
-- generación y de cada transcripción del portal, filtrando por client_id +
-- created_at >= inicio del ciclo.

create index if not exists ai_usage_log_client_created_idx
  on public.ai_usage_log (client_id, created_at desc);

create index if not exists transcription_usage_log_client_created_idx
  on public.transcription_usage_log (client_id, created_at desc);


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Backfill: TODAS las marcas de hoy nacen EXENTAS
-- ────────────────────────────────────────────────────────────────────────────
-- Esto es lo que hace que el deploy de Fase E no le corte el acceso a nadie.
-- Entre esta migración y el día que enciendas el cobro, absolutamente todas las
-- marcas están exentas: el gate las deja pasar y los topes no aplican.
--
-- También es lo que salva el cambio de significado de `clients.ai_generation_limit`
-- (`null` pasó de "sin tope" a "el tope del plan"): para una marca exenta sigue
-- queriendo decir sin tope.
--
-- Después, marca por marca y avisándole al cliente, se le quita la exención y
-- entra por Checkout. Las marcas propias de Paco quedan exentas para siempre.

insert into public.client_subscriptions (client_id, owner_id, exempt, status)
select c.id, c.owner_id, true, 'incomplete'
from public.clients c
on conflict (client_id) do nothing;


-- ============================================================================
-- VERIFICACIÓN — correr después de aplicar
-- ============================================================================
-- 1. Toda marca tiene suscripción y está exenta (las dos cuentas deben coincidir):
--
--    select
--      (select count(*) from clients)                                as marcas,
--      (select count(*) from client_subscriptions)                   as suscripciones,
--      (select count(*) from client_subscriptions where exempt)      as exentas;
--
-- 2. Los CHECK quedaron puestos:
--
--    select conrelid::regclass as tabla, conname, pg_get_constraintdef(oid)
--    from pg_constraint
--    where conname in (
--      'client_subscriptions_status_check',
--      'client_subscriptions_credit_balance_check',
--      'ai_usage_log_paid_with_check',
--      'credit_purchases_credits_check'
--    );
--
-- 3. RLS prendida y SIN policies en las tres (debe devolver 0 filas):
--
--    select tablename, policyname from pg_policies
--    where tablename in ('client_subscriptions','credit_purchases','stripe_events');
--
-- 4. Con la anon key o con un JWT de miembro, esto debe fallar por permisos:
--
--    select * from client_subscriptions;
--
-- 4.bis. Y el RPC de acreditar NO debe ser invocable por `authenticated`
--    (debe devolver 0 filas):
--
--    select grantee, privilege_type
--    from information_schema.routine_privileges
--    where routine_name = 'apply_credit_purchase'
--      and grantee in ('anon', 'authenticated', 'PUBLIC');
--
-- 5. El histórico de consumo quedó marcado como 'plan':
--
--    select paid_with, count(*) from ai_usage_log group by 1;
-- ============================================================================
