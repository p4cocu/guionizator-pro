# Fase D — Portal de cliente (login propio + secciones configurables)

> Plan aprobado 2026-08-12. Reemplaza el esbozo de "Fase D" en `pendientes.md`.
> **Estado: etapas 1 y 2 hechas** (2026-08-13). Migraciones desde `0006`.

## Desvíos del plan original (decididos sobre la marcha)

1. **El cliente edita sus guiones igual que Paco** (etapa 1). En vez de un
   update acotado a `client_approved_at`, la policy `scripts_member_update`
   habilita el `update` completo al rol `collaborator`, y el trigger
   `scripts_guard_update` congela `owner_id`/`client_id` y llena
   `last_edited_by` / `last_edited_at`. **No hay RPC de aprobación**: aprobar es
   una edición más.
2. **El `drop` de las columnas viejas de Apify fue en `0007`**, aplicada después
   del deploy, para que la app publicada siguiera funcionando entre una y otra.
3. **Ni la etapa 2 ni la 3 necesitaron migración**: `enabled_features`,
   `ai_generation_limit`, `ai_usage_log`, `client_members` y `client_invites`
   ya venían completas de `0006`. El `0008` sigue sin usarse.
4. **La invitación se entrega como link copiable**, no por mail (ver "Flujo de
   invitación"). El envío automático quedó como pendiente.

## Qué se quiere

1. Que un cliente externo entre con **su propio login** y vea **solo su marca**.
2. Que Paco decida, marca por marca, **qué secciones ve** — mostrarle las 12 del
   sidebar sería abrumador e irrelevante (Tendencias, Cerebro, Baúl de Ganchos y
   Recursos son herramientas internas, no entregables).
3. Que **generar con IA sea un add-on de pago**: apagado por defecto, se prende
   por cliente y tiene tope de uso (gasta la API key de Anthropic de Paco, que a
   diferencia de Apify **no** tiene token por cliente).

## Decisiones tomadas (2026-08-12)

| Decisión | Elegido | Por qué |
|---|---|---|
| Alcance del cliente | Ver + comentar/aprobar, y **generar con IA solo si Paco le habilita el add-on** | El feedback vuelve a la app; el gasto de IA queda bajo llave |
| Entrada | **Invitación por email desde la app**, link con expiración | Paco no toca el panel de Supabase por cada cliente |
| Ubicación | **Grupo de rutas `/portal` aparte**, layout y sidebar propios | Las páginas de `(app)` asumen "veo todos mis clientes"; reusarlas es el camino corto a una fuga |
| Multi-marca | Normalmente 1 marca por usuario, pero **un usuario puede tener varias sin crear otra cuenta** | `client_members` es N:N; el selector de marca aparece solo si tiene >1 |

## Propiedad de seguridad que hay que sostener

> Un miembro externo solo puede leer filas cuyo `client_id` esté en **sus**
> membresías, y solo de las tablas que el portal necesita. **Todo lo demás
> queda owner-only y por lo tanto es invisible aunque la UI falle.**

Esto acota la migración a ~8 tablas en vez de las 23. Las que **no se tocan**
(siguen `owner_id = auth.uid()`): `brain_versions`, `hooks`, `script_hooks`,
`tendencias`, `resources`, `own_resources`, `prompt_styles`, `ingest_tokens`,
`instagram_accounts`, `instagram_media`, `competitor_scrapes`,
`transcription_jobs`, `prompt_styles`.

⚠️ **RLS es por fila, no por columna.** Si a un miembro se le da `select` sobre
`clients`, ve *todas* las columnas de su fila: notas internas y
`apify_token_cipher` incluidos. Por eso el portal **no** lee `clients` directo
(ver "Vista `portal_clients`" abajo) y los secretos se mudan de tabla — lo que
`CLAUDE.md` ya anticipaba como condición para abrir el portal.

---

## Modelo de datos (migración `0006_portal_cliente.sql`)

```sql
-- Membresías: N:N, un usuario puede estar en varias marcas.
create table if not exists client_members (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'viewer' check (role in ('viewer','collaborator')),
  created_at timestamptz not null default now(),
  unique (client_id, user_id)
);

-- Invitaciones: la DB es la fuente de verdad, NO el user_metadata de Supabase
-- (el usuario puede editarse su propio metadata y auto-asignarse otra marca).
create table if not exists client_invites (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  email       text not null,
  role        text not null default 'viewer' check (role in ('viewer','collaborator')),
  token_hash  text not null unique,          -- sha256 del token; el token en claro solo viaja en el mail
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

-- Secretos fuera de clients (hoy el dueño puede leer el cipher desde el browser;
-- con miembros externos eso deja de ser aceptable).
create table if not exists client_secrets (
  client_id              uuid primary key references clients(id) on delete cascade,
  owner_id               uuid not null references auth.users(id) on delete cascade,
  apify_token_cipher     text,
  apify_token_last4      text,
  apify_token_valid      boolean,
  apify_token_checked_at timestamptz
);
-- + INSERT ... SELECT de clients y DROP de las 4 columnas viejas.
-- Sin policy de select: solo se lee con service role desde el servidor.

-- Qué secciones ve cada marca. Array con CHECK de contención, para mantener la
-- disciplina de "columna tipo-enum ⇒ CHECK" de CLAUDE.md.
alter table clients add column if not exists enabled_features text[] not null default '{}'::text[];
alter table clients drop constraint if exists clients_enabled_features_check;
alter table clients add constraint clients_enabled_features_check
  check (enabled_features <@ array[
    'reportes','guiones','calendario','competencia','instagram','investigacion','generar_ia'
  ]::text[]);

-- Add-on de IA: tope mensual de generaciones (null = sin tope).
alter table clients add column if not exists ai_generation_limit int;

-- Medición para cobrar y para cortar al llegar al tope.
create table if not exists ai_usage_log (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  client_id     uuid not null references clients(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null,
  input_tokens  int, output_tokens int,
  created_at    timestamptz not null default now()
);

-- Comentarios del cliente sobre un guion.
create table if not exists script_comments (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  client_id  uuid not null references clients(id) on delete cascade,
  script_id  uuid not null references scripts(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
alter table scripts add column if not exists client_approved_at timestamptz;
```

### Helper de acceso + policies

```sql
create or replace function public.has_client_access(p_client_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clients c
                 where c.id = p_client_id and c.owner_id = auth.uid())
      or exists (select 1 from client_members m
                 where m.client_id = p_client_id and m.user_id = auth.uid());
$$;
```

`security definer` es **necesario**: sin él, leer `client_members` dentro de una
policy sobre `client_members` entra en recursión de RLS.

Tablas que suman policy de membresía (`select` con `has_client_access(client_id)`,
manteniendo la de dueño):
`reports`, `scripts`, `content_calendar`, `competitor_posts`, `competitors`,
`client_research`, `client_products`, `script_comments`.

Escritura para miembros, solo dos casos: `script_comments` (insert propio) y
`scripts.client_approved_at` (update acotado por `role = 'collaborator'`).

**Regla de oro del insert:** cuando escribe un miembro, `owner_id` debe quedar
en el **dueño de la marca**, no en el miembro — si no, la fila desaparece de la
vista de Paco. Trigger `before insert` en las tablas donde el portal escribe:

```sql
new.owner_id := (select owner_id from clients where id = new.client_id);
```

### Vista `portal_clients`

El portal necesita nombre/marca/logo del cliente, no la fila entera.

```sql
create or replace view portal_clients as
  select id, nombre, marca, nicho, enabled_features
  from clients
  where has_client_access(id);
```

Con `security_invoker` apagado (default) la vista no aplica la RLS de `clients`:
el control queda en su propio `where`. Es intencional y hay que dejarlo
comentado en la migración, porque es justo el tipo de cosa que se lee como bug.

---

## Rutas y UI

```
app/(portal)/portal/
  layout.tsx                 # resuelve membresías, arma sidebar por enabled_features
  page.tsx                   # 1 marca → redirect; varias → selector
  [clientId]/
    reportes/  guiones/  calendario/  competencia/
app/invitacion/[token]/page.tsx   # público (ver PUBLIC_PATHS)
```

- **`/invitacion` va en `PUBLIC_PATHS`** de `lib/supabase/middleware.ts`, en el
  mismo cambio que se crea la ruta (regla dura de `CLAUDE.md`).
- `app/(app)/layout.tsx`: si el usuario no es dueño de ninguna marca pero tiene
  membresías → `redirect("/portal")`. El dueño sí puede entrar a `/portal` como
  "ver como cliente" (vale oro para probar los flags).
- `/login` hoy manda siempre a `/dashboard`: hay que hacerlo consciente del rol.
- **Doble candado en cada página del portal:** el flag decide si la sección se
  dibuja, y el server vuelve a chequearlo antes de consultar. El flag es UX; la
  seguridad la da RLS.

### Panel del super admin

En `/clientes/[id]`, sección nueva "Portal del cliente":

- Toggles de secciones → `clients.enabled_features`.
- "Generación con IA" marcado como add-on de pago: switch + tope mensual +
  consumo del mes (de `ai_usage_log`).
- Miembros: lista, rol, revocar; invitaciones pendientes con su estado.

Fuente de verdad de los flags: **`lib/portal/features.ts`** (slug, label,
descripción, si es de pago), al estilo de `lib/competencia/taxonomy.ts`. Tocar un
slug obliga a tocar el `CHECK` en la misma entrega.

Implementado en: `app/(app)/clientes/[id]/PortalSection.tsx` (UI),
`app/(app)/clientes/portalActions.ts` (server actions),
`lib/portal/{features,members,usage}.ts`. Las **invitaciones pendientes** no
están en el panel todavía: son la etapa 3. Hasta entonces las membresías se
cargan a mano con un `insert` en `client_members`; el panel las lista, les
cambia el rol y las revoca.

### Flujo de invitación (implementado, etapa 3)

1. Paco invita (email + rol) desde el panel → se crea la fila con el cliente de
   sesión (policy `client_invites_owner_all`) y la app devuelve el link.
2. Se guarda `sha256(token)` con vencimiento a 7 días; el token en claro se
   muestra **una sola vez** en pantalla. Si se pierde, "Nuevo link" genera otro
   e invalida el anterior.
3. **Entrega: link copiable** (decidido 2026-08-13). Paco lo manda por WhatsApp
   o mail. Sin dependencia del SMTP de Supabase, y funciona igual si el
   invitado ya tiene cuenta.
   > 🔜 **Pendiente**: envío automático del mail desde la app. El camino es
   > Resend (dominio propio) y no `inviteUserByEmail`, que además de estar
   > limitado a ~4 mails/hora falla si el email ya existe en Auth.
4. `/invitacion/[token]`: valida hash, vencimiento y **que el email de la sesión
   sea el invitado**; recién ahí inserta en `client_members` (service role, que
   es el único que puede: el invitado no tiene policies ahí).
5. Si no tiene cuenta, se registra en esa misma pantalla con el email fijado; el
   mail de confirmación vuelve vía `/auth/callback?next=/invitacion/<token>`.
6. Aceptada la invitación, hasta que exista `/portal` el miembro ve
   `PortalPending` ("tu portal está en camino") en vez del shell interno.

---

## Orden de implementación

| Etapa | Qué | Verificación |
|---|---|---|
| ✅ 1 | Migración `0006` completa (tablas, RLS, vista, mover secretos) + adaptar `lib/competencia/apifyToken.ts` y `clientes/actions.ts` a `client_secrets` | SQL a mano: con el uid de un miembro de prueba, `select` a cada tabla debe devolver solo lo suyo |
| ✅ 2 | `lib/portal/{features,members,usage}.ts` + panel "Portal del cliente" en `/clientes/[id]` (flags + add-on de IA + miembros) | Prender/apagar flags y ver el array en la DB |
| ✅ 3 | Invitaciones (`lib/portal/invites.ts`) + `/invitacion/[token]` + `PUBLIC_PATHS` + `PortalPending` | Invitar a un mail propio y aceptar |
| 4 | `/portal` con Reportes | Entrar con el usuario invitado |
| 5 | Guiones, Calendario, Competencia + comentarios/aprobación | |
| 6 | Add-on de IA: tope, `ai_usage_log`, corte al pasarse | |

Etapas 1–3 no cambian nada de lo que Paco ve hoy. La 1 es la única con riesgo
real (toca RLS de tablas en uso) y conviene aplicarla con la app quieta.

## Cabos sueltos, a decidir cuando lleguen

- **Cobro del add-on**: no hay pasarela. Arranca como acuerdo por fuera y un
  switch manual; Stripe queda para después.
- **Emails**: pendiente explícito de la etapa 3 — hoy el link de invitación se
  copia y se manda a mano. Cuando moleste, Resend (dominio ya propio).
- `SUPER_ADMIN_USER_ID` sigue siendo solo para el token global de Apify. Los
  permisos del portal se resuelven por `clients.owner_id`, no por super admin,
  para que el día que haya otro dueño funcione igual.
