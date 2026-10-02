-- ============================================================================
-- 0019 — "Tu estrategia" en el portal + test de estrategia
-- ============================================================================
--
-- QUÉ RESUELVE
--   La estrategia (`content_strategies`, 0017) la llenaba solo Paco. Ahora el
--   cliente responde un test sin jerga desde el portal y de ahí salen su
--   cliente ideal, sus 5 pilares y la etapa de su cuenta.
--
-- QUÉ CAMBIA
--   1. Slug `estrategia` en `clients.enabled_features` (amplía el CHECK de
--      contención). Fuente de verdad en el código: lib/portal/features.ts.
--   2. `content_strategies.test_answers` (jsonb), `test_completed_at`,
--      `test_completed_by`: las respuestas crudas del último test, para que
--      Paco vea con qué palabras se describió el cliente. La forma la fija
--      lib/strategy/test.ts (`sanitizeTestAnswers`).
--
--   NO se agregan policies de miembro: `content_strategies` sigue owner-only.
--   El portal la lee y la escribe con service role filtrando `client_id` a
--   mano (lib/portal/strategy.ts), mismo patrón que la ficha de servicio.
--
--   Decisión de Paco (2026-10-02): el test REEMPLAZA la estrategia que hubiera.
--
-- CÓDIGO QUE DEPENDE DE ESTA MIGRACIÓN
--   - lib/portal/features.ts, lib/portal/strategy.ts, lib/strategy/test.ts
--   - app/(portal)/portal/[clientId]/estrategia/*
--   - app/(app)/estrategia/* (muestra las respuestas del test)
--
-- Va ANTES del deploy: /estrategia selecciona las columnas nuevas, y prender
-- el slug sin el CHECK nuevo revienta el update del panel de la marca.
-- Aditiva e idempotente.
-- ============================================================================

alter table clients drop constraint if exists clients_enabled_features_check;
alter table clients add constraint clients_enabled_features_check
  check (enabled_features <@ array[
    'reportes','guiones','calendario','competencia','instagram','investigacion','generar_ia','estrategia'
  ]::text[]);

alter table content_strategies
  add column if not exists test_answers      jsonb,
  add column if not exists test_completed_at timestamptz,
  add column if not exists test_completed_by uuid references auth.users(id) on delete set null;

comment on column content_strategies.test_answers is
  'Respuestas del último test de estrategia (0019). Forma: lib/strategy/test.ts.';
