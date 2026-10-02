-- ============================================================================
-- 0023 — Gancho visual de un reel de competencia (análisis con Gemini)
-- ============================================================================
--
-- QUÉ RESUELVE
--   La transcripción solo ve lo que se DICE. El gancho tiene 3 capas (texto en
--   pantalla, lo que se ve en el primer segundo, lo que se dice) y las dos
--   primeras solo se ven en el video. Gemini mira los primeros 3, 5 o 10
--   segundos del reel (nunca el video completo) y devuelve esas capas. Se
--   guarda por post para no pagar dos veces el mismo análisis.
--
-- QUÉ CAMBIA
--   - `competitor_posts.visual_hook` jsonb, sin CHECK. Forma y lectura
--     tolerante en lib/competencia/visualHook.ts (`sanitizeVisualHook`).
--   - `competitor_posts.visual_hook_at` timestamptz: cuándo se analizó.
--   - `competitor_posts.visual_hook_seconds` smallint: cuántos segundos se
--     miraron (3, 5 o 10 — la validación vive en el código, no en un CHECK).
--
-- CÓDIGO QUE DEPENDE DE ESTA MIGRACIÓN
--   - app/(app)/competencia/{actions.ts,VisualHookModal.tsx,AdaptarModal.tsx}
--   - lib/competencia/visualHook.ts, lib/ai/gemini.ts
--
-- Va ANTES del deploy: /competencia selecciona las columnas nuevas.
-- Aditiva e idempotente. Ninguna policy cambia: la escribe el dueño con su
-- sesión (policy de owner que ya existe) y el portal no la selecciona.
-- ============================================================================

alter table competitor_posts add column if not exists visual_hook jsonb;
alter table competitor_posts add column if not exists visual_hook_at timestamptz;
alter table competitor_posts add column if not exists visual_hook_seconds smallint;

comment on column competitor_posts.visual_hook is
  'Gancho visual del reel (0023, Gemini): texto en pantalla, primer segundo, capas, cámara, sin audio. Forma en lib/competencia/visualHook.ts.';
comment on column competitor_posts.visual_hook_at is
  'Cuándo se analizó el gancho visual (0023).';
comment on column competitor_posts.visual_hook_seconds is
  'Segundos del inicio del reel que miró Gemini (0023): 3, 5 o 10.';
