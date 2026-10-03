-- ============================================================================
-- 0024 — Ideas guardadas por el cliente desde el portal
-- ============================================================================
--
-- QUÉ RESUELVE
--   "Ideas para tu semana" (portal, `/portal/[id]/estrategia`) genera ideas y
--   el cliente guarda SOLO las que le gustan en el mismo banco que usa Paco
--   (`content_ideas`). Hace falta saber quién las guardó: en el banco de
--   /estrategia llevan "Guardada por el cliente", y el portal lista solo las
--   suyas (no el banco interno de Paco).
--
-- QUÉ CAMBIA
--   - `content_ideas.generated_by uuid` → auth.users, `on delete set null`.
--     `null` = la guardó el dueño desde el estudio. Sin CHECK.
--
-- CÓDIGO QUE DEPENDE DE ESTA MIGRACIÓN
--   - lib/portal/weekIdeas.ts (insert/select con service role)
--   - app/(app)/estrategia/{page.tsx,EstrategiaClient.tsx} (badge en el banco)
--
-- Va ANTES del deploy: /estrategia selecciona la columna nueva.
-- Aditiva e idempotente. Ninguna policy cambia: `content_ideas` sigue
-- owner-only; el portal escribe con service role filtrando `client_id` a mano
-- y con el `owner_id` del dueño de la marca.
-- ============================================================================

alter table content_ideas
  add column if not exists generated_by uuid references auth.users(id) on delete set null;

comment on column content_ideas.generated_by is
  'Quién la guardó desde el portal (0024). null = el dueño, desde /estrategia.';
