# Fase D — Portal de cliente (login propio + secciones configurables)

> Plan aprobado 2026-08-12. Reemplaza el esbozo de "Fase D" en `pendientes.md`.
> **Estado: etapas 1 a 8 hechas** (etapa 8: 2026-08-18). Migraciones desde `0006`.
> El detalle de la etapa 8 está en `CLAUDE.md` → "Etapa 8".
> Queda solo Instagram, que está **en pausa** (no pendiente) por decisión de Paco.

## Desvíos del plan original (decididos sobre la marcha)

1. **El cliente edita sus guiones igual que Paco** (etapa 1). En vez de un
   update acotado a `client_approved_at`, la policy `scripts_member_update`
   habilita el `update` completo al rol `collaborator`, y el trigger
   `scripts_guard_update` congela `owner_id`/`client_id` y llena
   `last_edited_by` / `last_edited_at`. **No hay RPC de aprobación**: aprobar es
   una edición más.
2. **El `drop` de las columnas viejas de Apify fue en `0007`**, aplicada después
   del deploy, para que la app publicada siguiera funcionando entre una y otra.
3. **Las etapas 2 a 5 no necesitaron migración**: `enabled_features`,
   `ai_generation_limit`, `ai_usage_log`, `client_members`, `client_invites`,
   `script_comments` y las policies de miembro ya venían completas de `0006`.
   La etapa 6 sí: `0009_portal_generacion_ia.sql`.
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
6. Aceptada la invitación, el miembro cae en `/portal` (etapa 4).

### `/portal` (etapa 4) — `lib/portal/access.ts` + `app/(portal)/`

**Sin migración**: `0006` ya había creado todo lo que la etapa consume
(`reports_member_select`, la vista `portal_clients`, `client_members`). La
`0009` quedó libre hasta la etapa 6. `/portal` **no** va en `PUBLIC_PATHS`: se autentica por
sesión.

- **`lib/portal/access.ts`** es el único lugar que responde "qué marcas ve este
  usuario y con qué rol". La lista sale de la vista `portal_clients`, que ya
  trae `where has_client_access(id)` adentro — por eso no hay ningún `or(...)`
  armado a mano. `getPortalSession()` va envuelto en `cache()` de React: el
  layout, la página y la ruta de descarga la piden por separado y `getUser()`
  valida el JWT contra el servidor de Auth en cada llamada.
- **Rol `owner`** = ausencia de membresía sobre una marca que la vista igual
  devolvió, lo que solo puede pasar si sos el dueño. Sirve para el aviso de
  "estás viendo el portal como tu cliente".
- ⚠️ **Un miembro no puede leer `clients`.** Ninguna pantalla del portal hace
  join a esa tabla (`select("…, clients(nombre)")` le vuelve `null`): el nombre
  de la marca viaja desde `access.ts`.
- **Doble candado**, como estaba planeado: `[clientId]/layout.tsx` valida el
  acceso (404, no 403 — no le confirmamos a nadie que la marca existe) y cada
  página revalida su flag con `requirePortalClient(..., "reportes")`. **El flag
  también corta para el dueño dentro de `/portal`**, que es lo que hace que
  "ver como cliente" sirva para probar los switches. En `(app)` los flags no
  existen: son del portal, no del estudio.
- **`PortalFeature.live`** (nuevo campo en `features.ts`, sin equivalente en la
  base): una sección habilitada pero todavía sin pantalla se dibuja atenuada con
  "Pronto" en vez de linkear a una ruta que no existe. Etapas 5 y 6 la pasan a
  `true` **junto con** su `page.tsx`.
- **Descargas**: `loadReportForUser` (`lib/reports/load.ts`) reemplazó a
  `loadReport` en las dos rutas de `/api/reports/[id]`. El camino de dueño es el
  de siempre; el de miembro exige que el reporte sea de una marca suya **y** que
  esa marca tenga `reportes` prendida. Sin esa segunda condición, apagar el
  switch escondía la pantalla pero el link directo al `.xlsx` seguía sirviendo.
- **Ruteo por rol**: `/` (`app/page.tsx`) es el único lugar que decide estudio
  vs portal, vía `resolveLandingPath`. El login, el callback de Auth y el
  middleware mandan todos a `/`. El middleware no consulta la base: corre en
  cada request.
- `PortalPending` se borró; su lugar lo ocupan `PortalNotice` (sin marca
  asignada) y `[clientId]/page.tsx` (sin secciones habilitadas).

### Secciones y feedback (etapa 5)

**Tampoco necesitó migración**: `script_comments`, `scripts.client_approved_at`
y todas las policies de miembro venían de `0006`. La `0009` la estrenó la etapa 6.

Secciones nuevas, todas de **solo lectura** salvo Guiones:

| Sección | Qué muestra | Decisión que se tomó |
|---|---|---|
| Competencia | Posts de competidores con métricas, clasificación de la IA, transcripción y el ID público | **Esconde los `is_disliked`**: es la señal interna de "esto no sirve"; al cliente le sería ruido inaccionable |
| Calendario | Plan del mes por semana, navegable con `?month=&year=` | **Cero JS**: navegación con `<Link>`. Y `etapa0` se muestra como "En preparación" — es jerga del taller |
| Guiones | Guiones vigentes, con comentarios y aprobación | **Esconde `idea` y `baul`**: apuntes crudos y congelados. Solo `is_latest`: el historial de versiones es herramienta de taller |
| Investigación | Perfil de marca + productos + investigación cargada | Los datos de la marca salen de `portal_clients`, **nunca** de `clients` |

- **`lib/portal/comments.ts`** — el `insert` **no manda `owner_id`**: lo pone el
  trigger `set_owner_from_client`. Si quedara en el miembro, la fila
  desaparecería de la vista de Paco. No hay `update` ni `delete` para nadie: un
  comentario se responde, no se edita.
- **Aprobar es un `update` a `scripts.client_approved_at`**, como decía el plan
  (no hay RPC). Por lo tanto **solo el rol `collaborator`** puede: la policy
  `scripts_member_update` no le da `update` al `viewer`. La UI le esconde el
  botón y la action lo rechaza con un mensaje, no con un error de servidor.
- **El feedback vuelve a la pantalla de Paco**: `ClientFeedbackPanel` al pie de
  `/guiones/[id]` muestra el hilo y el estado de aprobación, y deja responder
  (`feedbackActions.ts`). Sin eso el portal sería un buzón sin destinatario.
  Se dibuja **solo si hay comentarios o aprobación**, para no meter un bloque
  vacío en cada guion.
- **`lib/competencia/outliers.ts`** — `withOutliers` salió de
  `app/(app)/competencia/actions.ts` (un módulo `"use server"`, donde todo export
  tiene que ser async y por eso no se podía compartir). Ahora el portal marca los
  destacados con exactamente los mismos umbrales.
- **`lib/portal/scriptView.ts`** — normaliza el `content` (jsonb, sin esquema) a
  algo dibujable y **nunca lanza**: un guion viejo con otra forma se muestra
  degradado, no rompe la pantalla del cliente. `parseMarkup` devuelve datos y no
  HTML, así el markdown ligero del editor se dibuja sin
  `dangerouslySetInnerHTML`.

### Generación con IA (etapa 6) — migración `0009_portal_generacion_ia.sql`

La primera etapa desde la `0006` que **sí** necesitó migración, y es aditiva:
se aplica **antes** del deploy (como la `0008`).

| Cambio | Por qué |
|---|---|
| `clients.ai_generation_mode` (`simple` \| `completo`, con `CHECK`) | Paco decidió que el flujo se elige **por marca**: hay clientes que quieren pedir y recibir, y otros que quieren elegir el ángulo. Fuente de verdad `lib/portal/generationMode.ts` |
| `scripts.generated_by` | Distinguir en `/guiones` lo que pidió el cliente, y poder listarle "lo que generaste antes" en el portal |
| La vista `portal_clients` suma `ai_generation_mode` | Un miembro no puede leer `clients`: la vista es su única ventana |
| `scripts_guard_update` congela también `generated_by` | La policy `scripts_member_update` le da al `collaborator` un update de fila entera y la RLS no limita columnas — sin esto podría atribuirse un guion |

Decisiones que conviene no re-discutir:

- **Ninguna policy nueva de escritura, a propósito.** El cliente no tiene
  `insert` sobre `scripts` ni sobre `ai_usage_log`, y no lo va a tener: con su
  JWT y la anon key puede llamar a PostgREST directo, así que una policy de
  insert sería **regalarle el medidor de un add-on de pago**. Todo el guardado y
  todo el log van con service role desde `lib/portal/generate.ts`.
- **`clients.notas` no entra al prompt.** Son apuntes internos sobre la marca, y
  todo lo que entra al prompt puede volver parafraseado en el guion. El resto
  del perfil sí va: es información que el cliente dio.
- **Orden del tope**: chequeo antes de llamar a la API (pasarse no gasta
  tokens), registro después de que respondió (un error de la API no come cupo).
  Una fila = un guion generado; los pasos intermedios del modo completo no
  cuentan y regenerar sí. Dos pestañas en paralelo pueden colarse por una:
  asumido, ver el comentario en `usage.ts`.
- **Generar y guardar son pasos separados.** Generar cuesta cupo siempre;
  guardar es gratis y opcional. Así el cliente puede regenerar sin llenarle el
  tablero a Paco de borradores que no le convencieron.
- **Se guarda en `preproduccion`**, no en `idea`: el portal esconde `idea` y el
  cliente perdería de vista lo que acaba de generar. Y **no** se crea la idea en
  `content_calendar`: cuándo se publica lo decide Paco.
- Rutas `POST /api/portal/generar/{big-idea,estructuras,guion}`, autenticadas
  por sesión ⇒ **no** van en `PUBLIC_PATHS`.
- ⚠️ Los prompts están **duplicados** con `/api/ai/{big-idea,structures,script}`
  (esas rutas son handlers, no módulos importables). Al tocar uno, revisar el
  otro: si se desincronizan, el cliente recibe guiones con otro criterio.

### Etapa 7 — transcripción online, Competencia en el portal, papelera y agenda

Migraciones `0010_transcripcion_online.sql` y `0011_papelera_guiones.sql`.
Detalle completo (por qué cada decisión, qué código depende de qué) en
`CLAUDE.md` → "Etapa 7"; acá solo el resumen de qué cambió para el cliente:

- **Transcripción ya no es solo local.** El pipeline de Whisper corre online
  (OpenAI), así que ahora también funciona desde el portal — con tope propio
  (`clients.transcription_limit`). Desde el estudio sigue sin tope.
- **Competencia en el portal** sumó portada del video (embed de Instagram),
  "Adaptar a mi marca" (gasta el mismo cupo que generar guiones — exige que
  `generar_ia` también esté prendido) y "Transcribir".
- **Aprobar un guion sin idea previa** ahora agenda solo, a 14 días, en
  `content_calendar`. Si el guion ya tenía una idea vinculada, no se toca.
- **Papelera**: cualquier miembro puede tirar un guion (dos clics para
  confirmar); solo Paco la ve y puede restaurar, en `/guiones/papelera`. Se
  borra en firme a los 30 días.

**Instagram queda EN PAUSA** (decidido 2026-08-14), no pendiente. Dos razones:
`instagram_media` e `instagram_accounts` están en la lista de tablas que `0006`
dejó **owner-only** a propósito, así que haría falta una migración nueva; y el
flujo real sería que cada cliente conecte su propia cuenta — mucho OAuth para lo
poco que hoy devuelven esas métricas. El slug **no se borra** de
`lib/portal/features.ts` (sacarlo obligaría al `ALTER TABLE` del CHECK) y con
`live: false` prender el switch no habilita nada.

---

## Orden de implementación

| Etapa | Qué | Verificación |
|---|---|---|
| ✅ 1 | Migración `0006` completa (tablas, RLS, vista, mover secretos) + adaptar `lib/competencia/apifyToken.ts` y `clientes/actions.ts` a `client_secrets` | SQL a mano: con el uid de un miembro de prueba, `select` a cada tabla debe devolver solo lo suyo |
| ✅ 2 | `lib/portal/{features,members,usage}.ts` + panel "Portal del cliente" en `/clientes/[id]` (flags + add-on de IA + miembros) | Prender/apagar flags y ver el array en la DB |
| ✅ 3 | Invitaciones (`lib/portal/invites.ts`) + `/invitacion/[token]` + `PUBLIC_PATHS` + `PortalPending` | Invitar a un mail propio y aceptar |
| ✅ 4 | `/portal` con Reportes (`lib/portal/access.ts`, `app/(portal)/`) | Entrar con el usuario invitado |
| ✅ 5 | Guiones (+ comentarios/aprobación), Calendario, Competencia, Investigación | Comentar desde el portal y ver el hilo en `/guiones/[id]` |
| ✅ 6 | Add-on de IA: pantalla, tope, `ai_usage_log`, corte al pasarse (migración `0009`) | Poner tope 2, generar 3 veces: la tercera corta sin llamar a la API |
| ✅ 7 | Transcripción online (Whisper), Competencia con portada/adaptar/transcribir en el portal, agenda automática al aprobar, papelera de guiones (migraciones `0010` y `0011`) | Transcribir desde el portal, adaptar un post, aprobar un guion sin idea previa y verlo en `/calendario`, tirar un guion y verlo en `/guiones/papelera` |
| ✅ 8 | Edición del guion desde el portal (antes y después de guardar), nombre de usuario (`portal_profiles`, migración `0012`), Portadas y Copy Expert con tope, copiar/descargar, filtros separados en Competencia, guion en el modal del calendario, link a `/portal` en el sidebar | Editar un guion como `collaborator` y ver el aviso en `/guiones/[id]`; comentar y ver el nombre en vez del email; con tope 1, generar portadas y que el copy corte |
| — | Instagram en el portal: **necesita migración** (hoy `instagram_media` es owner-only) | |

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
