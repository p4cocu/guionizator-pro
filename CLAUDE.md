# CLAUDE.md — Guionizator Pro

App web que convierte el prompt "ROL — Guionista" en una herramienta para crear
guiones de **Instagram** (Reels 30–60s y carruseles) por **cliente**, con un
"cerebro" editable, edición por IA y edición manual, persistencia y mejora continua.
Vive en `guionizator.pacocuevasia.com`.

> Plan maestro por fases: `/Users/paco/.claude/plans/rol-guionista-especialista-ticklish-canyon.md`

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript.**
- **CSS puro + CSS Modules** (sin Tailwind), tokens de marca Paco Cuevas en `app/globals.css`.
- **Supabase** (Postgres + Auth + RLS) vía `@supabase/ssr`.
- **Anthropic (Claude)** server-side con prompt caching (Fase 1+).
- **Deploy: Netlify** (`@netlify/plugin-nextjs`).

## Decisiones de arquitectura

- **Multi-tenant desde el día 1.** Solo Paco usa hoy, pero se venderá como SaaS.
  Toda tabla de datos lleva `owner_id` (→ `auth.users`) + **RLS** por `auth.uid()`.
- IA = **Claude** (no OpenAI). Key solo server-side, nunca `NEXT_PUBLIC`.
- El prompt ROL es el **"cerebro"**: editable y versionado (Fase 1) — el claude.md de la app.
- Idioma del producto: **español latinoamericano**, tuteo.

## Convenciones

- Tokens y estética: derivados de `paco diseno.md` (paleta verde ink/forest/emerald
  + signal amarillo; Space Grotesk display + DM Sans body; glass cards; grid blueprint).
  Es **UI de producto** (sidebar + editor), no landing — se toman tokens y voz, no el layout de secciones.
- Clases utilitarias globales en `globals.css`: `.card`, `.btn` (`.btn-primary/secondary/ghost`),
  `.input/.textarea/.field-label`, `.badge`, `.eyebrow`, `.text-grad`, `.blueprint`, `.rule-yellow`.
- Estilos por componente/página en `*.module.css` colocados junto al archivo.
- Supabase: `lib/supabase/{client,server,middleware}.ts`. Nunca exponer `service_role`.
  Para auth en server: `getUser()` (no confiar solo en `getSession()`).
- Anthropic: `lib/ai/anthropic.ts` — `generateWithBrain()` con prompt caching vía
  `client.beta.messages.create()` + `betas: ["prompt-caching-2024-07-31"]`. SDK 0.102.0.
- Knowledge base en `knowledge/` (también copiada a `brain/knowledge/`).
- Cerebro versionado: `brain_versions` en Supabase (activa por `is_active=true` + unique index).
  Si no hay versión activa, cae back a `brain/system-prompt.md` leído con `fs.readFileSync`.

## Columnas tipo-enum y migraciones (⚠️ leer antes de tocar estados)

Varias columnas tienen un **`CHECK constraint` en Supabase** que restringe sus valores.
Las migraciones se aplican **a mano en el SQL Editor de Supabase** (no hay CLI ni
pipeline). **Todo cambio de esquema se escribe como archivo numerado en
`supabase/migrations/`** (`NNNN_descripcion.sql`, idempotente, con comentario de qué
cambia y qué código depende de ella) — ver `supabase/migrations/README.md`, que además
lleva la tabla de cuáles ya se aplicaron. El esquema anterior a `0001` se aplicó ad-hoc
antes de que existiera la carpeta y no está reconstruido ahí.
**Regla dura:** agregar/renombrar un valor en el tipo de TypeScript **exige** el
`ALTER TABLE … DROP/ADD CONSTRAINT` correspondiente **en el mismo cambio** — si no, el
`UPDATE`/`INSERT` revienta con error de servidor en runtime. Cuando toques un valor de
estos, dilo explícitamente y entrega la migración a Paco.

| Tabla / columna | Valores permitidos (deben coincidir con el `CHECK`) |
|---|---|
| `scripts.status` | `idea`, `preproduccion`, `produccion`, `listo`, `publicado`, `baul` |
| `scripts.recording_type` | `voz_off`, `actuacion`, `actuacion_compu`, `actuacion_cel`, `compu`, `cel` |
| `content_calendar.status` | `idea`, `etapa0`, `produccion`, `publicado` |
| `resources.kind` | `capturado`, `universal` |
| `competitor_posts.hook_type` | `resultado`, `vacio_info`, `error`, `controversia`, `dolor_comun`, `filtrante`, `negativo` |
| `competitor_posts.script_structure` | `how_to`, `golpe_valor`, `vacio_info`, `espejo`, `controversial`, `momento_wtf`, `problema_invisible` |
| `competitor_posts.value_pillar` | `utilidad_practica`, `validacion_emocional`, `revelacion`, `curaduria`, `disrupcion`, `actualidad` |
| `clients.ai_generation_mode` | `simple`, `completo` (fuente de verdad en TS: `lib/portal/generationMode.ts`) |

`baul` = ideas buenas pero congeladas (falta pulir herramientas para producirlas).
**Se oculta por defecto** en la lista de Guiones (`getScripts` filtra `neq baul` si no hay
filtro de estado); solo aparece al elegir "Baúl" en el filtro. No estorba en la vista principal.

`resources.kind` separa los tres tabs de `/recursos` que comparten tabla `resources`:
`capturado` (ideas para reels/carruseles, con cliente/guión) vs `universal` (uso personal,
sin cliente ni guión — no pensados para contenido). `getResources`/`getUniversalResources`
filtran por `kind`; `updateResourceKind` mueve entre ambos. Los **Recursos Propios** son
otra tabla (`own_resources`), no un `kind`.

Las 3 columnas de clasificación de `competitor_posts` (`hook_type`, `script_structure`,
`value_pillar`) las asigna la IA a partir de la transcripción (`classifyPost` en
`competencia/actions.ts`, modelo `MODEL_FAST` con retry). La **fuente de verdad** de los
slugs, labels, colores y definiciones (destiladas de los playbooks de Andrea Estratega) es
`lib/competencia/taxonomy.ts` — al tocar un valor del enum, actualiza **el CHECK, la tabla
de arriba y `taxonomy.ts` en el mismo cambio**. Columnas acompañantes sin CHECK:
`classification_notes` (text, 1 frase de por qué la IA eligió) y `classified_at` (timestamptz,
marca lo ya clasificado → alimenta el botón "Clasificar pendientes" y la subvista
`/competencia/analisis`). La clasificación se dispara auto tras transcribir, en lote, o
individual; corre en producción (es solo una llamada a Claude, a diferencia de la
transcripción que es local).

Columnas booleanas nuevas (sin `CHECK`, pero también requieren `ALTER TABLE` a mano):
`scripts.featured` (`default false`) — guiones destacados para desarrollar pronto; se
ordenan primero en `getScripts` y llevan borde amarillo. Toggle vía `toggleScriptFeatured`
+ `StarButton` (client, `stopPropagation` porque la tarjeta es un `<Link>`).

Además: los handlers de estos cambios (en `ScriptDetailClient.tsx`) capturan el error,
revierten la UI optimista y muestran el mensaje en línea — **nunca** dejar un server
action de mutación sin `try/catch` en el cliente (evita la pantalla "This page couldn't load").

## ⚠️ Middleware (`proxy.ts`) y rutas server-to-server

El matcher de `proxy.ts` aplica a **todas** las rutas excepto estáticos/imágenes —
incluye por defecto cualquier ruta nueva, también las que no pasan por Next.js
(`/.netlify/functions/*`). `updateSession` (`lib/supabase/middleware.ts`) redirige
(307) a `/login` cualquier request sin sesión de usuario que no esté en `PUBLIC_PATHS`.

**Cualquier endpoint llamado server-to-server (Netlify Background/Scheduled
Functions, webhooks, workers) NO lleva cookies de sesión** → si su ruta no está en
`PUBLIC_PATHS`, el middleware lo redirige a `/login` **antes** de que su código
corra. Como `fetch()` no lanza error en respuestas no-2xx (307 incluido), el fallo
queda silencioso: el caller cree que disparó el job y el job nunca se ejecuta.
Ya pasó dos veces: Portadas (`d60badd`) y el scraper de Competencia
(`scrape-competencia-background`, corregido agregando `/.netlify/functions` a
`PUBLIC_PATHS`). **Regla dura:** toda ruta nueva que se autentique por su propio
secreto/token (no por sesión de usuario) debe agregarse a `PUBLIC_PATHS`
**en el mismo cambio** que la crea. Y todo `fetch()` que dispare un worker debe
chequear `res.ok` y tratar respuestas no-2xx como error (no asumir éxito solo
porque no lanzó excepción).

## Jobs programados (Netlify Scheduled Functions)

- **`cleanup-competencia-scheduled`** (`netlify/functions/cleanup-competencia-scheduled.ts`,
  cron `@daily` en `netlify.toml`) — borra posts de `competitor_posts` con más de
  **40 días** desde `posted_at`, para todos los owners/clientes (independiente de que
  se dispare una búsqueda). Excluye posts marcados `is_favorite`. Usa service role.
  El mismo umbral de 40 días también corre "al vuelo" en `runScrapeJob`
  (`lib/competencia/scrape.ts`) al terminar cada búsqueda, solo para el cliente
  recién scrapeado — el cron cubre a los que no se vuelven a buscar.
  Netlify bloquea (404) cualquier invocación externa a una función con `schedule`
  configurado, así que no necesita secreto propio como `scrape-competencia-background`.
- **`refresh-instagram-tokens-scheduled`**
  (`netlify/functions/refresh-instagram-tokens-scheduled.ts`, cron `@daily`) —
  renueva los long-lived tokens de `instagram_accounts` que vencen dentro de
  **7 días** (o que no tienen `token_expires_at`), para todos los owners. Salta
  las cuentas renovadas hace menos de 24h (Instagram rechaza refrescar un token
  más nuevo que eso). Usa service role. Un fallo por cuenta no frena al resto:
  queda en `instagram_accounts.last_refresh_error` y se muestra en el perfil del
  cliente (`InstagramSection`), junto con `last_refresh_attempt_at` — migración
  `0005`. El botón manual "Renovar token" sigue existiendo y limpia ese error.

## Token de Apify por cliente (secretos cifrados)

Cada cliente puede tener **su propio token de Apify** para que cada marca pague su
scraping de competencia (pensado para marcas externas; las marcas propias de Paco
usan el global). Desde la migración `0006` viven en la tabla **`client_secrets`**
(`client_id` PK, `owner_id`, `apify_token_cipher`, `apify_token_last4`,
`apify_token_valid`, `apify_token_checked_at`, `updated_at`), **no** en `clients`.

⚠️ `client_secrets` tiene RLS activa **sin ninguna policy** y `revoke all … from
anon, authenticated`: solo se lee y escribe con **service role** desde el
servidor (`lib/supabase/service.ts` → `createServiceClient()`). Como ese cliente
saltea la RLS, **toda** consulta filtra `owner_id` a mano. Los helpers están en
`lib/competencia/apifyToken.ts` (`getApifyTokenState`, `saveApifyTokenSecret`,
`removeApifyTokenSecret`, `markApifyTokenChecked`, `readApifyToken`,
`resolveApifyToken`) — las server actions de `clientes/actions.ts` no tocan la
tabla directo. Esto obliga a tener `SUPABASE_SERVICE_ROLE_KEY` **también en
local**, no solo en Netlify.

- **Cifrado**: `lib/crypto/secrets.ts` — AES-256-GCM con `SECRETS_KEY`
  (32 bytes en base64, `openssl rand -base64 32`). Formato guardado:
  `v1:<iv>:<tag>:<ciphertext>`. **El mismo valor debe existir en local y en
  Netlify**; si cambia, los tokens guardados dejan de descifrarse y hay que
  volver a cargarlos.
- **Resolución**: `lib/competencia/apifyToken.ts` → `resolveApifyToken(supabase, clientId)`.
  Cadena: token del cliente → `APIFY_API_TOKEN` global, **y el global es exclusivo
  del super admin** (`SUPER_ADMIN_USER_ID` = uuid de `auth.users`, se compara contra
  `clients.owner_id`). Cualquier otro usuario que no cargue su key ve un error, no
  gasta los créditos del dueño. Si `SUPER_ADMIN_USER_ID` no está definida, **nadie**
  usa el global (falla cerrado a propósito). Se compara por `owner_id` y no por
  sesión porque la background function de Netlify no tiene sesión de usuario.
  **No** hay fallback silencioso al global cuando el cliente sí tiene token: si el
  suyo está roto, falla con mensaje claro en vez de cobrarle el scrape a la cuenta
  equivocada. `runScrapeJob` lo resuelve solo (ya no recibe el token como parámetro)
  y `startScrape` lo valida antes de crear la fila del scrape.
- **Nunca al browser**: las server actions (`saveApifyToken`, `checkApifyToken`,
  `removeApifyToken` en `clientes/actions.ts`) devuelven solo `last4`/estado.
  `saveApifyToken` valida contra `GET /v2/users/me` de Apify **antes** de guardar,
  así lo persistido siempre funcionó alguna vez. UI: `clientes/[id]/ApifySection.tsx`.
- `resolveApifyToken(clientId, { expectedOwnerId })` — el segundo parámetro lo
  pasan los llamadores con sesión (server actions); la background function no,
  porque ya arranca desde la fila del scrape. Sin él no hay chequeo de
  pertenencia: el service role no tiene RLS que lo cubra.

## ID público de los posts de competencia (`competitor_posts.public_id`)

Código de **6 caracteres, único global** (no por cliente) para que el cliente
pueda pedir cambios sin mandar links: "cambiame el Q7F2M9". Migración `0008`.

- Alfabeto de 31 sin ambiguos: `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (fuera `0 O 1 I L`).
  Fuente de verdad en TypeScript: `lib/competencia/publicId.ts`
  (`normalizePublicId`, `looksLikePublicId`); en la base, la función
  `gen_competitor_public_id()`. **Los dos alfabetos tienen que coincidir.**
- La función es `security definer` a propósito: la unicidad es global pero la RLS
  de `competitor_posts` es por owner — sin definer, el chequeo de colisión solo
  vería los posts del usuario que inserta.
- **El ID es estable**: el upsert de `scrape.ts` (`onConflict
  owner_id,client_id,shortcode`) no manda `public_id`, así que re-scrapear
  actualiza métricas sin tocarlo. El mismo reel guardado para dos clientes son
  dos filas y dos IDs — el ID identifica la pieza en el tablero de esa marca.
- UI: badge monoespaciado en la fila de métricas de cada tarjeta (clic = copiar)
  y buscador arriba de los filtros que acepta ID o `@cuenta`. Si el ID no está en
  la marca abierta, `findPostByPublicId` lo busca en las otras marcas del dueño y
  ofrece saltar — es el caso real, porque el cliente dicta el ID sin decir de qué
  marca es.
- Va en el snapshot de los reportes (`SNAPSHOT_VERSION` **2**). Los reportes v1 ya
  generados se descargan igual pero muestran `—`: hay que regenerarlos.

## Reportes de competencia (`/reportes`)

Entregable para el cliente: se seleccionan posts en `/competencia` (checkbox por
tarjeta + barra flotante) y se genera un reporte descargable en **.xlsx y .pdf**.

- **Snapshot congelado** (`reports.snapshot`, jsonb). El reporte **no** consulta
  las tablas al descargarse: `cleanup-competencia-scheduled` borra posts a los 40
  días y un reporte "en vivo" se vaciaría solo. Los archivos se regeneran desde el
  snapshot en cada descarga — no se guarda el binario (sin Storage, sin bucket).
  Consecuencia práctica: transcribir o clasificar **después** de generar no se
  refleja; hay que regenerar el reporte.
- `lib/reports/snapshot.ts` arma las filas (post + clasificación IA + guion
  adaptado vía `scripts.source_post_id`) y calcula outliers. La mediana de
  comentarios se saca de **todos** los posts de esa cuenta en el cliente, no solo
  de los seleccionados: con 3-4 posts elegidos a mano —y elegidos justo por
  destacar— la mediana no significaría nada.
- El guion se acota al cliente del reporte: adaptar entre marcas es válido a nivel
  base (`source_post_id` no lo impide), pero el guion de otra marca no va en este
  reporte.
- `lib/reports/xlsx.ts` (exceljs): hojas *Plan de grabación*, *Guiones*, *Datos*,
  *Qué está funcionando*. `lib/reports/pdf.ts` (pdfkit): portada, hallazgos y los
  guiones completos. El guion completo va en hoja propia y **no** como columna de
  *Datos*: 200 palabras en una celda estiran la fila y arruinan la lectura de las
  métricas. En *Plan de grabación* solo aparece el gancho (primera frase).
- **pdfkit, no @react-pdf/renderer**: este código se bundlea en una Netlify
  Function y @react-pdf arrastra `yoga-layout` (WASM), frágil de empaquetar.
  Contrapartida: sin Space Grotesk (las fuentes vienen de Google vía `next/font`,
  no hay TTF en el repo) — usa Helvetica.
  ⚠️ Al tocar el pie de página: escribir por debajo del margen inferior hace que
  pdfkit agregue una página en blanco por cada pie. Se neutraliza poniendo
  `doc.page.margins.bottom = 0` mientras se escribe (ya está hecho).
- Rutas `POST /api/reports`, `GET /api/reports/[id]/{xlsx,pdf}` — autenticadas por
  sesión, **no** van en `PUBLIC_PATHS`.

## Portal de cliente (Fase D) — RLS con miembros

Plan completo: `docs/fase-d-portal-cliente.md`. Migración `0006_portal_cliente.sql`.
Hasta acá **toda** la RLS era `owner_id = auth.uid()`; ahora hay usuarios externos.

**Propiedad que hay que sostener:** un miembro solo lee filas cuyo `client_id`
esté en *sus* membresías, y solo de las 8 tablas del portal. Todo lo demás sigue
owner-only y es invisible aunque la UI falle.

- `client_members` (N:N, roles `viewer` / `collaborator`), `client_invites`
  (guarda `sha256` del token, nunca el token), `script_comments`, `ai_usage_log`.
- `clients.enabled_features text[]` — qué secciones ve esa marca. **Tiene `CHECK`
  de contención**: `reportes`, `guiones`, `calendario`, `competencia`,
  `instagram`, `investigacion`, `generar_ia`. La fuente de verdad en el código es
  `lib/portal/features.ts`; tocar un slug obliga a tocar el `CHECK` en la misma
  entrega (misma regla dura que `taxonomy.ts`).
- `clients.ai_generation_limit` — tope mensual del add-on de IA (`null` = sin tope).
- Funciones `security definer`: `has_client_access(uuid)`, `is_client_owner(uuid)`,
  `is_client_collaborator(uuid)`. El `security definer` **no es opcional**: sin él
  una policy sobre `client_members` que consulta `client_members` recursa.
- Policies de miembro: solo `select` con `has_client_access(client_id)` sobre
  `scripts`, `reports`, `content_calendar`, `competitor_posts`, `competitors`,
  `client_research`, `client_products`, `script_comments`. Son **aditivas** — las
  policies de dueño no se tocan (todas son `PERMISSIVE`, así que se suman con OR).
- Escritura de miembros: comentarios (insert propio) y **edición de guiones**
  (`scripts_member_update`, rol `collaborator`). Sin `insert` ni `delete`.
- ⚠️ **RLS no limita columnas.** Por eso el trigger `scripts_guard_update`
  congela `owner_id` y `client_id` cuando quien edita no es el dueño (si no, el
  cliente podría llevarse el guion a otra marca), y llena `last_edited_by` /
  `last_edited_at`. Por lo mismo, `script_comments` tiene un trigger
  `set_owner_from_client` (también definer): si `owner_id` quedara en el miembro,
  la fila desaparecería de la vista de Paco.
- Vista `portal_clients` — lo único de `clients` que ve un miembro.
  `security_invoker` **apagado a propósito**: el control es su `where
  has_client_access(id)`. El linter de Supabase la marca como
  `security_definer_view`; es esperado.
- **`/invitacion` está en `PUBLIC_PATHS`** (etapa 3): el invitado llega sin
  sesión y sin cuenta. La autorización la da el token, no el middleware.

### Panel de configuración (etapa 2) — `lib/portal/*`

Sección "Portal del cliente" en `/clientes/[id]`
(`[id]/PortalSection.tsx` + `clientes/portalActions.ts`). No necesitó migración:
todo lo que usa lo creó `0006`.

- **`lib/portal/features.ts`** — fuente de verdad de los slugs de
  `clients.enabled_features` (`slug`, `label`, `description`, `paid`, `path`),
  con la unión `PortalFeatureSlug` cerrada y un assert de compilación para que
  renombrar un slug rompa el build. Misma regla dura que `taxonomy.ts`: tocar un
  slug **exige** el `ALTER TABLE … clients_enabled_features_check` en la misma
  entrega. `sanitizeFeatures()` es el único camino de escritura — filtra
  desconocidos, deduplica y ordena — así nunca sale un array que viole el CHECK.
  El módulo es puro (no importa Supabase) para poder usarse desde el cliente.
- **`lib/portal/members.ts`** — `client_members` guarda `user_id`, no email. Las
  filas se leen con el **cliente de sesión** (la policy `client_members_owner_all`
  ya alcanza); solo los emails salen de `auth.admin.getUserById` con service role,
  y si eso falla la fila cae al uuid en vez de tumbar el perfil. `PortalMemberRole`
  espeja el `CHECK` de `client_members.role`.
- **`lib/portal/usage.ts`** — consumo del add-on de IA: cuenta filas de
  `ai_usage_log` del mes en curso, cortado en **UTC** (la misma referencia que
  `created_at`). El insert de esas filas es de la etapa 6.
- El switch del add-on de IA **es** el slug `generar_ia` dentro de
  `enabled_features`; `clients.ai_generation_limit` es solo el número
  (`null` = sin tope).
- Prender un flag no le da acceso a nadie: define qué se dibuja en `/portal`
  (etapa 4). Quién entra lo deciden las membresías, y qué puede leer, la RLS.

### Invitaciones (etapa 3) — `lib/portal/invites.ts` + `/invitacion/[token]`

- **El token en claro se muestra una sola vez**, dentro del link: en
  `client_invites` solo vive su `sha256`. Recargar el panel no lo recupera —
  hay botón "Nuevo link", que además invalida el anterior. Vence a los 7 días
  (`INVITE_TTL_DAYS`).
- **Entrega por link copiable**, no por mail: el SMTP default de Supabase corta
  a ~4 mails/hora y `inviteUserByEmail` falla si el email ya existe en Auth. El
  envío automático (Resend) quedó pendiente.
- Crear/listar/revocar/regenerar usan el **cliente de sesión** (policy
  `client_invites_owner_all`). **Solo validar y aceptar** usan service role: el
  invitado no tiene policies sobre `client_invites` ni puede leer `clients`.
- `acceptInvite` valida, en orden: token existe → no aceptada → no vencida →
  **el email de la sesión es exactamente el invitado**. Sin ese último chequeo,
  cualquiera con el link entraría con su cuenta.
- ⚠️ **`/invitacion` está en `PUBLIC_PATHS`.** Si se saca, el link deja de
  funcionar: el middleware manda a `/login` antes de que corra la página.
- La confirmación de correo vuelve a la invitación vía
  `/auth/callback?next=/invitacion/<token>` (esa ruta ya soportaba `next`).
- `app/(app)/layout.tsx`: quien **no es dueño de ninguna marca pero tiene
  membresías** se redirige a `/portal` (etapa 4). El dueño no: puede entrar a
  `/portal` a mano, pero su casa sigue siendo el estudio.

### `/portal` (etapa 4) — `lib/portal/access.ts` + `app/(portal)/`

No necesitó migración: `0006` ya traía todo. `/portal` **no** va en
`PUBLIC_PATHS` (se autentica por sesión).

- **`lib/portal/access.ts`** es el único lugar que resuelve "qué marcas ve este
  usuario y con qué rol". Lee la vista **`portal_clients`**, que ya trae
  `where has_client_access(id)` adentro — por eso no hay ningún `or(...)` armado
  a mano. `getPortalSession()` está envuelto en `cache()` de React para no
  repetir `getUser()` (valida el JWT contra Auth en cada llamada) por request.
- ⚠️ **Un miembro no puede leer `clients`** (no hay policy de select para él ahí:
  esa tabla trae notas internas). Ninguna pantalla del portal hace join a
  `clients` — `select("…, clients(nombre)")` le vuelve `null`. El nombre de la
  marca viene de `access.ts`.
- **Doble candado**: `[clientId]/layout.tsx` valida acceso (**404, no 403**: no
  se confirma que la marca exista) y cada página revalida su flag con
  `requirePortalClient(..., slug)`. El flag **también corta para el dueño dentro
  de `/portal`** — eso es lo que hace que "ver como cliente" sirva para probar
  los switches. En `(app)` los flags no aplican: son del portal, no del estudio.
- **`PortalFeature.live`** en `features.ts` (campo de código, sin equivalente en
  la base): sección habilitada pero sin pantalla todavía → el sidebar la dibuja
  atenuada con "Pronto". Pasarla a `true` **exige** entregar su `page.tsx` en el
  mismo cambio, o queda un link roto en la cara del cliente.
- **Descargas**: `loadReportForUser` (`lib/reports/load.ts`) reemplazó a
  `loadReport` en `/api/reports/[id]/{xlsx,pdf}`. Dueño = camino de siempre;
  miembro = el reporte tiene que ser de una marca suya **y** esa marca tener
  `reportes` prendida. Sin lo segundo, apagar el switch escondía la pantalla
  pero el link directo al `.xlsx` seguía sirviendo.
- **Ruteo por rol**: `/` (`app/page.tsx`) es el **único** lugar que decide
  estudio vs portal, vía `resolveLandingPath`. El login, `/auth/callback` y el
  middleware mandan todos a `/`. El middleware no consulta la base a propósito:
  corre en cada request.

### Secciones del portal (etapa 5) — tampoco necesitó migración

Reportes, Competencia, Calendario, Investigación y Guiones. **Instagram queda
EN PAUSA** (decidido 2026-08-14), no pendiente: `instagram_media` e
`instagram_accounts` quedaron owner-only en `0006` (haría falta migración) y el
flujo real exigiría que cada cliente conecte su propia cuenta — mucho OAuth para
lo que devuelven esas métricas. El slug NO se borra de `features.ts`: sacarlo
obliga al `ALTER TABLE` del CHECK, y con `live: false` prenderlo no habilita nada.

Qué se le esconde al cliente en cada una (decisiones de producto, no de
seguridad — la RLS le dejaría verlas):

- **Competencia**: los posts `is_disliked`. Es la marca interna de "esto no
  sirve"; al cliente le sería ruido inaccionable.
- **Guiones**: los estados `idea` y `baul`, y las versiones viejas
  (solo `is_latest`). Mismo criterio con el que `getScripts` esconde el baúl.
- **Calendario**: nada, pero `etapa0` se rotula "En preparación" — la jerga del
  taller no le dice nada al cliente.

Módulos que aparecieron:

- **`lib/portal/comments.ts`** — el `insert` de `script_comments` **no manda
  `owner_id`**: lo pone el trigger `set_owner_from_client`. Si quedara en el
  miembro, la fila desaparecería de la vista de Paco. No hay `update` ni
  `delete`: un comentario se responde, no se edita.
- **`lib/portal/scriptView.ts`** — normaliza el `content` (jsonb sin esquema) y
  **nunca lanza**. `parseMarkup` devuelve datos, no HTML: el markdown ligero del
  editor se dibuja sin `dangerouslySetInnerHTML`.
- **`lib/competencia/outliers.ts`** — `withOutliers` salió de
  `competencia/actions.ts` (módulo `"use server"`: todo export tiene que ser
  async, por eso no se podía compartir). Portal y estudio marcan destacados con
  los mismos umbrales.

### Generación con IA en el portal (etapa 6) — migración `0009`

El add-on de pago: prender el slug `generar_ia` le da al cliente
`/portal/[id]/generar`. Migración `0009_portal_generacion_ia.sql` (aditiva,
**antes** del deploy).

- **`clients.ai_generation_mode`** (columna tipo-enum, `CHECK`): `simple`
  (brief → guion, 1 llamada) o `completo` (brief → Big Idea → estructura →
  guion). Lo elige Paco por marca en el panel del add-on. Fuente de verdad
  `lib/portal/generationMode.ts` — misma regla dura que `taxonomy.ts`. La vista
  `portal_clients` suma la columna (el miembro no puede leer `clients`).
- **`scripts.generated_by`** — quién lo pidió desde el portal (`null` = Paco).
  Alimenta el badge "Generado por el cliente" en `/guiones` y la lista "lo que
  generaste antes" del portal. El trigger `scripts_guard_update` ahora también
  **congela** esta columna cuando quien edita no es el dueño.
- **Nada se escribe con la sesión del miembro.** No hay policy de insert sobre
  `scripts` ni sobre `ai_usage_log`, y no la va a haber: con su JWT y la anon key
  el cliente puede llamar a PostgREST directo, así que una policy de insert sería
  **regalarle el medidor de un add-on de pago**. Todo pasa por service role en
  `lib/portal/generate.ts`, que filtra la pertenencia a mano.
- **Contexto de la marca sin `notas`**: se lee con service role (el miembro no
  ve `clients`) y se le saca `notas`, que son apuntes internos — todo lo que
  entra al prompt puede salir parafraseado en el guion.
- **El tope**: `assertCanGenerate` corre **antes** de llamar a la API (pasarse
  no gasta tokens) y `logAiGeneration` **después** de que respondió (un error de
  la API no come cupo). Una fila de `ai_usage_log` = **un guion generado**; los
  pasos intermedios no cuentan y regenerar sí. Dos pestañas en paralelo pueden
  colarse por una: asumido a propósito, ver el comentario en `usage.ts`.
- **El guion se guarda en `preproduccion`**, no en `idea`: el portal esconde
  `idea` y el cliente perdería de vista lo que acaba de generar. **No** se crea
  la idea en `content_calendar` (a diferencia de `saveScriptWithNewIdea`):
  cuándo se publica lo decide Paco. Generar y guardar son pasos separados —
  regenerar cuesta cupo, pero no le llena el tablero de borradores.
- Rutas `POST /api/portal/generar/{big-idea,estructuras,guion}`, autenticadas
  **por sesión** ⇒ **no** van en `PUBLIC_PATHS`. La del guion hereda el margen
  contra el límite de Netlify de `/api/ai/script` (mismo modelo, mismos tokens).
- ⚠️ Los prompts están **duplicados** entre `lib/portal/generate.ts` y
  `/api/ai/{big-idea,structures,script}` (esas rutas son handlers, no módulos
  importables). Al tocar uno, revisar el otro o el cliente recibe guiones con
  otro criterio que los de Paco.

**Aprobar es un `update` a `scripts.client_approved_at`** (no hay RPC), así que
**solo el rol `collaborator`** puede: `scripts_member_update` no le da `update`
al `viewer`. El feedback vuelve a `/guiones/[id]` vía `ClientFeedbackPanel` +
`feedbackActions.ts` — se dibuja solo si hay comentarios o aprobación.

## Respuestas JSON de la IA (`lib/ai/json.ts`)

Todo endpoint que le pide JSON a Claude pasa por `lib/ai/json.ts` — **nunca
`JSON.parse()` pelado sobre `result.text`**. El helper hace dos cosas:

1. **Parseo tolerante** (`extractJson`): aguanta fences de markdown, una frase
   antes o después del JSON y comas colgantes.
2. **Un reintento automático** si aun así no parsea, reenviando el mismo prompt
   con un bloque de corrección que dice qué falló. Si el primer intento se cortó
   por `max_tokens` (`stopReason`), el reintento duplica el presupuesto (techo
   8192) y pide brevedad. Tras 2 intentos tira `AiJsonError` con el texto crudo.

Dos entradas según cómo se llame al modelo:
`generateJson()` (envuelve `generateWithBrain`, devuelve `{ data, result }` — el
`result` trae el uso de tokens) y `generateJsonPlain()` (system prompt propio,
sin cerebro; `system` es opcional). En el handler:

```ts
} catch (e) {
  if (e instanceof AiJsonError) return NextResponse.json({ error: "...", raw: e.rawText }, { status: 500 });
  throw e;
}
```

⚠️ El reintento **duplica la latencia** del peor caso. En rutas síncronas
pegadas al límite de Netlify (~26-30s) —`cover`, `calendar`— un segundo intento
puede terminar en 504 en vez de en mensaje de error. Si eso aparece, la salida
es mover esa ruta a background function, no sacar el reintento.

## Estructura de carpetas

```
app/
  layout.tsx            # fuentes de marca + metadata
  globals.css           # tokens + utilitarios
  page.tsx              # redirect a /dashboard
  login/                # login/signup (client) + auth/callback
  api/ai/route.ts       # route handler Anthropic (server-only, POST)
  (app)/                # grupo protegido: layout con Sidebar + Topbar
    dashboard/  clientes/  guiones/
    cerebro/            # page.tsx + CerebroEditor.tsx + actions.ts + cerebro.module.css
    clientes/           # page.tsx + ClientesList + ClienteCard + ClienteForm + actions.ts + clientes.module.css
      nuevo/            # page.tsx (nueva entrada)
      [id]/             # page.tsx + ResearchSection + DeleteClienteButton (editar + investigación)
brain/
  system-prompt.md      # cerebro base (ROL actualizado: 4 estructuras equiparables)
  knowledge/            # copia de knowledge/ (10 docs)
components/             # Sidebar, Topbar, LogoutButton, Placeholder
lib/
  supabase/             # clients server/browser + middleware de sesión
  ai/anthropic.ts       # cliente Anthropic con prompt caching
middleware.ts           # refresca sesión + protege rutas privadas
knowledge/              # fuente original de la base de conocimiento
```

## Variables de entorno (`.env.local`, ver `.env.example`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`ANTHROPIC_API_KEY` (server-only), `NEXT_PUBLIC_SITE_URL`,
`APIFY_API_TOKEN` (global/fallback), `SECRETS_KEY` (cifrado de tokens por cliente),
`SUPER_ADMIN_USER_ID` (único uuid que puede usar el token global de Apify),
`SUPABASE_SERVICE_ROLE_KEY` (server-only; **también en local** desde `0006`, para
leer `client_secrets`).

## Comandos

- `npm run dev` — desarrollo local (http://localhost:3000)
- `npm run build` — build de producción
- `npm run lint` — linter
- `netlify build && netlify deploy --prod` — deploy manual (el único que hay)

### ⚠️ Deploy: dos formas de romper producción sin tocar una línea de código

Pasó el 2026-08-13, con el deploy de la etapa 1 de Fase D:

1. **Nunca `netlify deploy --prod --no-build`.** Con ese flag el CLI publica el
   `publish` de `netlify.toml` (`.next`) tal cual, sin las mutaciones del
   `@netlify/plugin-nextjs` que colocan los estáticos en `/_next/static/*`. El
   SSR sigue respondiendo (la página "carga"), pero **todo el CSS y el JS dan
   404**: el sitio se ve como texto plano y nada interactivo funciona. Se
   diagnostica en 10 segundos: `curl -s <url>/login | grep -o '/_next/static/[^"]*\.css'`
   y pedir ese archivo — si da 404, es esto.
2. **Nunca `rm -rf .netlify`.** Ahí vive `state.json` con el vínculo al sitio.
   Sin él, `netlify deploy --prod` **crea un sitio nuevo** y publica ahí (con un
   nombre autogenerado), dejando producción intacta pero al operador convencido
   de que deployó. Si pasa: `netlify unlink && netlify link --name guionizator-pro`.

## Estado por fases

- [x] **Fase 0** — Setup, marca, login (Supabase Auth) y deploy. Shell de app con sidebar/topbar.
- [x] **Fase 1** — `brain/system-prompt.md` (4 estructuras equiparables, IA propone 3 de 4 por brief),
  `brain/knowledge/` (10 docs), tablas `narrative_structures` + `brain_versions` (Supabase),
  `lib/ai/anthropic.ts` (prompt caching), `app/api/ai/route.ts`, pantalla Cerebro con versionado.
- [x] **Fase 2** — Clientes (CRM-lite): tabla `clients` + `client_research` + RLS, CRUD completo
  en `/clientes` (listado, crear, editar, eliminar), barra de completeness 0–100, sección de investigación por cliente.
- [x] **Fase 3** — Generación: brief → 3 estructuras + explicación → guion (Reel/carrusel).
- [x] **Fase 4** — Edición: flujo adoptado = exportar el guion generado a Claude/Gemini Projects
  para pulido externo y regresar el resultado a la app. No se implementó editor IA in-app
  (tiempos de respuesta inaceptables). El editor manual sí está operativo.
- [~] **Fase 5** — Mejora continua: **descartada como sistema automático.** La mejora se hace
  puntualmente: (a) agregar campo "tono de voz" (archivo de texto plano) al perfil de cliente
  para enriquecer los guiones, (b) ajustes directos al knowledge cuando Paco los solicite.
- [ ] **Fase 6** — Hardening multi-tenant + base SaaS + placeholder YouTube.

## Integración Instagram (Etapa A — lectura de métricas)

Flujo **Instagram Login** (`graph.instagram.com`, NO Facebook Login). Tabla
`instagram_accounts` (RLS owner-only), `lib/instagram/client.ts`,
`app/(app)/instagram/` (dashboard + actions), panel de conexión en perfil de cliente.
Etapas B (publicar) y C (programar) en **stand-by indefinido**.

### Auto-refresh del token de Instagram (resuelto)

El long-lived token **caduca a los ~60 días**. Se renueva solo con el cron diario
`refresh-instagram-tokens-scheduled` (ver "Jobs programados" arriba); el botón
manual "Renovar token" del perfil del cliente queda como respaldo.

Columnas de diagnóstico en `instagram_accounts` (sin `CHECK`, migración `0005`):
`last_refresh_attempt_at` (último intento del cron, salga bien o mal) y
`last_refresh_error` (mensaje del último fallo, `NULL` si el último salió bien).
Si el cron empieza a fallar, el aviso aparece en el perfil del cliente — no hay
alerta por fuera de la app, así que el único síntoma visible es ese cartel más el
contador "Token vence en N días" en amarillo.
