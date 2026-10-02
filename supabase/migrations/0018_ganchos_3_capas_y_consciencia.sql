-- ============================================================================
-- 0018 — Ganchos de 3 capas + niveles de consciencia en la estrategia
-- ============================================================================
--
-- QUÉ RESUELVE (aprendizajes de Andrea Estratega, 2026-10-02)
--   El análisis de 1000 ganchos dice que el gancho tiene 3 capas (lo que se
--   lee, lo que se ve, lo que se dice) y que la que más pesa en nichos de
--   negocio es el TEXTO en pantalla. La app solo guardaba la frase hablada.
--   Y la estrategia usaba 3 etapas (atraer/nutrir/convertir) en vez de los
--   5 niveles de consciencia + propósito (viral/valor/venta) + formato.
--
-- QUÉ CAMBIA (todo aditivo, todo texto SIN CHECK — los valores los fija el
-- código: lib/hooks/criteria.ts y lib/strategy/pillars.ts)
--   1. `script_hooks`: `text_overlay`, `visual`, `hook_type`, `checks` (jsonb,
--      los 7 criterios), `why`. `hook_text` sigue siendo la capa verbal.
--   2. `content_strategies.account_phase`: freshman | sophomore | junior |
--      senior (etapa de la cuenta → reparto del mes).
--   3. `content_ideas`: `purpose`, `format_style`, `hook_text`, `hook_visual`.
--      `stage` se reusa para el NIVEL DE CONSCIENCIA (inconsciente, emocional,
--      racional, oportunidad, solucion_unica); las filas viejas con
--      atraer/nutrir/convertir se leen mapeadas.
--
-- CÓDIGO QUE DEPENDE DE ESTA MIGRACIÓN
--   - lib/hooks/*, app/(app)/guiones/[id]/{HooksPanel,hooksActions}
--   - app/(app)/ganchos/* (revisor)
--   - lib/strategy/*, app/(app)/estrategia/*
--
-- Va ANTES del deploy: el código nuevo selecciona estas columnas.
-- ============================================================================

alter table script_hooks
  add column if not exists text_overlay text,
  add column if not exists visual       text,
  add column if not exists hook_type    text,
  add column if not exists checks       jsonb,
  add column if not exists why          text;

alter table content_strategies
  add column if not exists account_phase text;

alter table content_ideas
  add column if not exists purpose      text,
  add column if not exists format_style text,
  add column if not exists hook_text    text,
  add column if not exists hook_visual  text;
