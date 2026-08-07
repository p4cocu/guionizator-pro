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

## Token de Apify por cliente (secretos cifrados)

Cada cliente puede tener **su propio token de Apify** para que cada marca pague su
scraping de competencia (pensado para marcas externas; las marcas propias de Paco
usan el global). Columnas en `clients` — sin `CHECK`, pero requieren `ALTER TABLE`
a mano: `apify_token_cipher`, `apify_token_last4`, `apify_token_valid`,
`apify_token_checked_at`.

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
- ⚠️ Hoy el dueño puede leer `apify_token_cipher` desde el browser con la anon key
  (RLS `owner_id = auth.uid()`). Aceptable mientras el único usuario sea Paco;
  al abrir el portal de clientes (Fase D en `pendientes.md`), mover la columna a
  una tabla sin policy de `select`.

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
`SUPER_ADMIN_USER_ID` (único uuid que puede usar el token global de Apify).

## Comandos

- `npm run dev` — desarrollo local (http://localhost:3000)
- `npm run build` — build de producción
- `npm run lint` — linter

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

### ⚠️ Pendiente de infraestructura — Auto-refresh del token de Instagram

El long-lived token de Instagram **caduca a los ~60 días**. Hoy se renueva con un
**botón manual** ("Renovar token" en el perfil del cliente). Esto es frágil: si Paco
no entra a renovar, las cuentas dejan de traer métricas.

**RECORDATORIO PARA CLAUDE:** cuando Paco vaya a modificar la infraestructura del
proyecto (cron jobs, Netlify Functions, scheduled functions, edge functions, o
cualquier cambio de backend/infra), **recomendar proactivamente** automatizar el
refresh con un cron (ej. Netlify Scheduled Function diaria) que llame a
`refreshInstagramToken` para las cuentas cuyo `token_expires_at` esté dentro de los
próximos ~7 días. No forzarlo fuera de ese contexto (Etapa B/C en stand-by).
El patrón de Scheduled Function ya existe en el repo — copiar la estructura de
`cleanup-competencia-scheduled` (ver "Jobs programados" arriba).
