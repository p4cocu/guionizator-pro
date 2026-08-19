-- ============================================================================
-- 0012 — Nombre de usuario del portal (`portal_profiles`)
-- ============================================================================
-- QUÉ CAMBIA
--   Crea la tabla `portal_profiles` (user_id → display_name): el nombre con el
--   que cada persona aparece en los comentarios y en el rastro de ediciones.
--
-- POR QUÉ
--   Hasta ahora el portal le mostraba al cliente el EMAIL CRUDO del autor de
--   cada comentario (`c.authorEmail ?? "Alguien del equipo"` en
--   `guiones/[scriptId]/page.tsx`). O sea que el cliente veía la dirección
--   personal de Paco. Además, con varios miembros por marca hacía falta saber
--   quién pidió qué para darle seguimiento, y un email no siempre lo dice.
--
-- POR QUÉ NO VA EN `auth.users.user_metadata`
--   Porque el usuario puede editarse su propio metadata con su JWT: cualquiera
--   podría renombrarse igual que otro y firmar comentarios en su nombre. Es la
--   misma razón por la que `client_invites` no confía en el metadata (ver
--   `docs/fase-d-portal-cliente.md`).
--
-- SEGURIDAD — RLS ACTIVA **SIN NINGUNA POLICY**, A PROPÓSITO
--   Mismo patrón que `client_secrets` (migración 0006): se lee y se escribe
--   SOLO con service role desde el servidor (`lib/portal/profiles.ts`). Si el
--   miembro tuviera `update` sobre su fila, podría renombrarse "Paco" cuando
--   quisiera. El nombre lo elige él UNA VEZ al entrar; cambiarlo después es
--   atribución del dueño. Como el service role saltea la RLS, todo acceso
--   filtra la pertenencia a mano.
--
-- CÓDIGO QUE DEPENDE DE ESTA MIGRACIÓN
--   - lib/portal/profiles.ts                       (único acceso a la tabla)
--   - lib/portal/comments.ts                       (resuelve el autor)
--   - app/(portal)/portal/layout.tsx + NameGate    (alta obligatoria)
--   - app/invitacion/[token]/*                     (nombre al aceptar)
--   - app/(app)/clientes/[id]/PortalSection.tsx    (Paco edita nombres)
--   - app/(app)/clientes/portalActions.ts          (setMemberDisplayName…)
--   - app/(app)/guiones/[id]/ClientFeedbackPanel   (nombre + email)
--
-- CUÁNDO SE APLICA: **ANTES** del deploy. Es puramente aditiva — el código
--   publicado hoy no conoce la tabla, así que sigue funcionando igual entre la
--   migración y el deploy. Al revés no: la app nueva la consulta en el gate de
--   `/portal` y en cada lectura de comentarios.
-- ============================================================================

create table if not exists public.portal_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- El largo se valida también en TypeScript (`lib/portal/profiles.ts`), pero el
-- CHECK es el que impide que una fila mal escrita entre por otro camino.
alter table public.portal_profiles
  drop constraint if exists portal_profiles_display_name_check;
alter table public.portal_profiles
  add constraint portal_profiles_display_name_check
  check (char_length(btrim(display_name)) between 2 and 40);

alter table public.portal_profiles enable row level security;

-- Sin policies: nadie llega con anon key. Solo service role.
revoke all on public.portal_profiles from anon, authenticated;

comment on table public.portal_profiles is
  'Nombre visible de cada usuario en el portal. Solo service role (RLS sin policies), igual que client_secrets.';


-- ============================================================================
-- VERIFICACIÓN — correr después de aplicar
-- ============================================================================
-- 1. La tabla existe y tiene el CHECK:
--
--    select conname, pg_get_constraintdef(oid)
--    from pg_constraint
--    where conrelid = 'public.portal_profiles'::regclass;
--
-- 2. RLS prendida y sin policies (debe devolver 0 filas):
--
--    select policyname from pg_policies where tablename = 'portal_profiles';
--
-- 3. Con la anon key / un JWT de miembro, esto debe fallar por permisos:
--
--    select * from portal_profiles;
--
-- 4. Nombres ya cargados (después de usar la app un rato):
--
--    select p.display_name, u.email
--    from portal_profiles p join auth.users u on u.id = p.user_id;
-- ============================================================================
