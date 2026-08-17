-- ============================================================================
-- 0010 — Transcripción online con Whisper (OpenAI) + tope por cliente
-- ============================================================================
--
-- Reemplaza el pipeline local (faster-whisper + yt-dlp en la Mac de Paco, ver
-- scripts/transcribe_reel.py) por una llamada server-side a la API de Whisper
-- de OpenAI. Habilita transcribir desde producción — y por lo tanto desde el
-- portal del cliente.
--
-- QUÉ CAMBIA
--   1. `competitor_posts.video_url` — el link de descarga que trae Apify en
--      cada scrape. Se pisa en cada re-scrape del mismo shortcode (igual que
--      likes/comentarios). Es un link FIRMADO de Instagram: puede expirar en
--      horas. `lib/competencia/transcribe.ts` lo usa como primer intento y,
--      si ya murió, le pide a Apify ese post puntual de nuevo (`directUrls`)
--      antes de transcribir.
--   2. `clients.transcription_limit` — tope mensual de transcripciones
--      (null = sin tope). Separado de `ai_generation_limit` a propósito: el
--      costo por unidad es muy distinto (Whisper cobra por minuto de audio,
--      no por tokens de LLM), mezclarlos no representaría el gasto real.
--   3. `transcription_usage_log` — misma forma que `ai_usage_log`: una fila
--      por transcripción que se completó con éxito.
--
-- QUIÉN CUENTA CONTRA EL TOPE
--   Solo lo que se dispara DESDE EL PORTAL. Transcribir desde tu estudio
--   (`/competencia`) queda sin tope, igual que generar guiones desde
--   `/guiones/nuevo`: es tuyo, lo controlás vos scrapeando cuando querés, y
--   por eso NO escribe en `transcription_usage_log` (mismo criterio que ya
--   usa `ai_usage_log`: los guiones que generás en el estudio no dejan fila
--   ahí tampoco).
--
-- CÓDIGO QUE DEPENDE DE ESTA MIGRACIÓN
--   - lib/apify/client.ts            (mapea/pide `videoUrl`)
--   - lib/competencia/scrape.ts       (persiste `video_url` al guardar posts)
--   - lib/competencia/transcribe.ts   (orquesta: video fresco → Whisper → guarda)
--   - lib/competencia/transcriptionUsage.ts (tope + log, espejo de lib/portal/usage.ts)
--   - app/api/transcribe-reel/route.ts               (estudio, sin tope)
--   - app/(portal)/portal/[clientId]/competencia/actions.ts  (portal, con tope)
--   - lib/portal/access.ts            (suma transcriptionLimit a PortalClient)
--
-- Aditiva e idempotente. Se aplica ANTES del deploy: el código publicado hoy
-- no selecciona ninguna columna nueva, así que sigue funcionando igual entre
-- la migración y el deploy.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Link de descarga del video (sin CHECK: es solo texto, puede venir vacío)
-- ────────────────────────────────────────────────────────────────────────────

alter table competitor_posts
  add column if not exists video_url text;

comment on column competitor_posts.video_url is
  'Link de descarga directo que trae Apify en cada scrape. Firmado y de vida corta (horas) — antes de transcribir, lib/competencia/transcribe.ts intenta usarlo y si expiró vuelve a pedirlo a Apify (directUrls) para ese post puntual.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Tope mensual por cliente
-- ────────────────────────────────────────────────────────────────────────────

alter table clients
  add column if not exists transcription_limit int;

comment on column clients.transcription_limit is
  'Tope mensual de transcripciones desde el portal (null = sin tope). Separado de ai_generation_limit: el costo por unidad de Whisper no es comparable al de generar un guion.';


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Medición
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists transcription_usage_log (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  client_id   uuid not null references clients(id)    on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  post_id     uuid references competitor_posts(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists transcription_usage_log_client_idx
  on transcription_usage_log(client_id, created_at desc);
create index if not exists transcription_usage_log_owner_idx
  on transcription_usage_log(owner_id, created_at desc);

comment on table transcription_usage_log is
  'Una fila por transcripción disparada desde el portal que terminó con éxito. Alimenta el tope de clients.transcription_limit. Las transcripciones desde el estudio de Paco NO dejan fila acá (sin tope), igual que ai_usage_log con los guiones del estudio.';

alter table transcription_usage_log enable row level security;

drop policy if exists transcription_usage_log_owner_select on transcription_usage_log;
create policy transcription_usage_log_owner_select on transcription_usage_log
  for select using (owner_id = auth.uid());

-- Sin policy de insert para nadie: el mismo motivo que ai_usage_log — con la
-- anon key y su sesión, un miembro podría insertar filas falsas o saltarse el
-- tope. El insert va siempre por service role (lib/competencia/transcriptionUsage.ts).


-- ────────────────────────────────────────────────────────────────────────────
-- 4. La vista del portal suma el tope (para mostrar "te quedan N" al cliente)
-- ────────────────────────────────────────────────────────────────────────────
-- Un miembro no puede leer `clients` directo; esta vista es su única ventana.
-- Se agrega al final, como hizo la 0009 con `ai_generation_mode`.

create or replace view portal_clients as
  select id, nombre, marca, nicho, enabled_features, ai_generation_limit,
         ai_generation_mode, transcription_limit
  from clients
  where has_client_access(id);

grant select on public.portal_clients to authenticated;


-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- select column_name from information_schema.columns
-- where (table_name = 'competitor_posts' and column_name = 'video_url')
--    or (table_name = 'clients' and column_name = 'transcription_limit');
--
-- select id, transcription_limit from portal_clients limit 1;
-- ============================================================================
