-- ============================================================================
-- 0014 — Publicación externa (video grabado fuera de la app) + copy en 2 versiones
-- ============================================================================
--
-- QUÉ RESUELVE
--   Hasta acá, para sacar el copy y las portadas de una publicación había que
--   haber generado el guion en la app: `Copy Expert` y `Creador de portadas`
--   viven en `/guiones/[id]` y exigen un `script_id`. Si el video se grabó
--   afuera (por ejemplo inspirado en un reel de la competencia, pero producido
--   por completo fuera de la plataforma), no había puerta de entrada.
--
--   La solución NO es una herramienta nueva en paralelo: es dejar registrar la
--   publicación como una fila de `scripts` marcada como externa, y reusar tal
--   cual todo lo que ya cuelga de un guion (copy, portadas, calendario,
--   versiones, feedback del portal).
--
-- QUÉ CAMBIA
--   1. `scripts.is_external boolean not null default false`
--      `true` = el video/carrusel se grabó fuera de la app y esta fila existe
--      solo para colgarle el copy y la portada. Su `content.voice_off` es la
--      descripción que escribió Paco, no un guion generado, y su
--      `structure_name` es 'Publicación externa'.
--      Booleana sin CHECK, igual que `scripts.featured` — no es un enum.
--
--   2. `script_copies.copy_short text` (nullable)
--      El copy ahora se genera en DOS versiones por plataforma: una corta y
--      directa (`copy_short`) y una desarrollada (`copy_text`, la de siempre).
--      Nullable a propósito: las filas generadas antes de esta migración solo
--      tienen la larga y la UI las muestra igual.
--
-- POR QUÉ NO UNA TABLA `external_posts` APARTE
--   Duplicaría el almacenamiento del copy y las portadas (`script_copies` /
--   `script_covers` cuelgan de `scripts.id` con FK y ON DELETE CASCADE) y
--   obligaría a duplicar los dos paneles. Con una columna, la publicación
--   externa ES un guion para todo lo que ya existe.
--
-- POR QUÉ NO UN VALOR NUEVO DE `scripts.type`
--   `scripts.type` tiene un CHECK cerrado (`reel|carousel`) que decide el
--   formato en toda la app (el resumen que se le manda a la IA de portadas, el
--   render del detalle, el export). Una publicación externa SIGUE siendo un
--   reel o un carrusel: lo externo es de dónde salió, no qué es.
--
-- CÓDIGO QUE DEPENDE DE ESTA MIGRACIÓN
--   - app/(app)/guiones/actions.ts                   (createExternalPublication, saveScriptCopy)
--   - app/(app)/guiones/nuevo/NuevaPublicacionForm.tsx (el formulario nuevo)
--   - app/(app)/guiones/[id]/CopyExpertPanel.tsx     (muestra las dos versiones)
--   - app/api/ai/copy/route.ts                       (devuelve copy_short + copy_long)
--   - lib/ai/copyPrompt.ts                           (prompt compartido estudio/portal)
--   - lib/portal/scriptTools.ts                      (mismo copy en el portal)
--
-- Aditiva e idempotente. Se aplica ANTES del deploy: el código publicado hoy
-- no conoce ninguna de las dos columnas, así que la app vieja sigue andando
-- entre la migración y el deploy. Al revés no.
-- ============================================================================

alter table scripts
  add column if not exists is_external boolean not null default false;

comment on column scripts.is_external is
  'true = el video/carrusel se grabó FUERA de la app; la fila existe para colgarle copy y portada. content.voice_off es la descripción escrita por el dueño, no un guion generado. Ver migración 0014.';

alter table script_copies
  add column if not exists copy_short text;

comment on column script_copies.copy_short is
  'Versión corta y directa del copy. copy_text sigue siendo la versión desarrollada. NULL en las filas anteriores a la migración 0014 (se generaron cuando había una sola versión).';


-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- select column_name, data_type, column_default
-- from information_schema.columns
-- where (table_name = 'scripts' and column_name = 'is_external')
--    or (table_name = 'script_copies' and column_name = 'copy_short');
-- ============================================================================
