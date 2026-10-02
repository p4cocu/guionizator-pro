-- ============================================================================
-- 0021 — Esqueleto del post de competencia (adaptar con estructura visible)
-- ============================================================================
--
-- QUÉ RESUELVE
--   Al adaptar desde /competencia, antes de reescribir se muestra el
--   ESQUELETO del post fuente (método Andrea, "Nivel 2"): cuál es el gancho,
--   en qué segundo cae el primer problema, cómo retiene, cómo cierra y la
--   estructura en piezas genéricas. Se guarda para no pagar dos veces la misma
--   extracción y para que "multiplicar lo que funcionó" (punto 6) lo reuse.
--
-- QUÉ CAMBIA
--   - `competitor_posts.skeleton` jsonb, sin CHECK. Forma y lectura tolerante
--     en lib/competencia/skeleton.ts (`sanitizeSkeleton`). El segundo del
--     primer problema lo calcula el código, no la IA (ver ese archivo).
--   - `competitor_posts.skeleton_at` timestamptz: cuándo se extrajo.
--
-- CÓDIGO QUE DEPENDE DE ESTA MIGRACIÓN
--   - app/(app)/competencia/{actions.ts,AdaptarModal.tsx,CompetenciaClient.tsx}
--   - app/api/ai/adapt-competitor/route.ts, lib/competencia/skeleton.ts
--
-- Va ANTES del deploy: /competencia selecciona las columnas nuevas.
-- Aditiva e idempotente. Ninguna policy cambia: la escribe el dueño con su
-- sesión (policy de owner que ya existe) y el portal no la selecciona.
-- ============================================================================

alter table competitor_posts add column if not exists skeleton jsonb;
alter table competitor_posts add column if not exists skeleton_at timestamptz;

comment on column competitor_posts.skeleton is
  'Esqueleto del post (0021): gancho, primer problema, retención, cierre y piezas. Forma en lib/competencia/skeleton.ts.';
comment on column competitor_posts.skeleton_at is
  'Cuándo se extrajo el esqueleto (0021).';
