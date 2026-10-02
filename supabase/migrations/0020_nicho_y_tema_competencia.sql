-- ============================================================================
-- 0020 — Nicho por cuenta de competencia + tema por post (posts de autoridad)
-- ============================================================================
--
-- QUÉ RESUELVE
--   El post de "investigación" ("analicé 80 reels de cuentas de dentistas…")
--   tiene que ser VERDAD. Para eso hay que saber:
--   (a) de qué nicho es cada cuenta → `competitors.niche` (lo pone Paco a mano
--       en /competencia; texto libre, ej. "dentistas", "creadores de IA");
--   (b) de qué trata cada post → `competitor_posts.topic` (lo pone
--       `classifyPost` en la misma llamada que el gancho/estructura/pilar).
--   Con (a) la afirmación por nicho es cierta aunque cada reel hable de otra
--   cosa: el hallazgo es de PATRONES. Con (b) se puede afirmar por tema.
--
-- QUÉ CAMBIA
--   - `competitors.niche` text, sin CHECK.
--   - `competitor_posts.topic` text, sin CHECK.
--   Las dos se normalizan en código (minúsculas, recortadas):
--   lib/competencia/research.ts (`normalizeNiche`, `normalizeTopic`).
--   Los posts ya clasificados quedan con `topic` null y vuelven a aparecer en
--   "Clasificar pendientes" para completarlo.
--
-- CÓDIGO QUE DEPENDE DE ESTA MIGRACIÓN
--   - app/(app)/competencia/{actions.ts,CompetenciaClient.tsx}
--   - lib/competencia/research.ts, app/(app)/estrategia/*
--
-- Va ANTES del deploy: /competencia selecciona las columnas nuevas.
-- Aditiva e idempotente. Ninguna policy cambia (las dos tablas ya tienen las
-- suyas; el portal solo lee `competitor_posts` y no usa estas columnas).
-- ============================================================================

alter table competitors add column if not exists niche text;
alter table competitor_posts add column if not exists topic text;

comment on column competitors.niche is
  'Nicho de la cuenta (0020), texto libre normalizado en lib/competencia/research.ts. Alimenta los posts de investigación.';
comment on column competitor_posts.topic is
  'Tema corto del post (0020), lo pone classifyPost. Normalizado en lib/competencia/research.ts.';
