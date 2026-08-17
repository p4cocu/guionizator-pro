-- ============================================================================
-- 0011 — Papelera de guiones (borrado suave, 30 días, solo Paco la ve)
-- ============================================================================
--
-- Deja que un miembro del portal mande un guion a la papelera sin borrarlo de
-- verdad. Solo Paco ve la papelera y puede restaurar; a los 30 días un cron lo
-- borra en firme.
--
-- QUÉ CAMBIA
--   `scripts.trashed_at timestamptz` — NULL = guion normal. Con fecha = está
--   en la papelera desde ese momento. Sin CHECK (no es un enum, es una marca
--   de tiempo, como `client_approved_at`).
--
-- POR QUÉ NO ES UN VALOR NUEVO DE `scripts.status`
--   `status` ya tiene un CHECK cerrado (`idea|preproduccion|produccion|listo|
--   publicado|baul`) y agregar `basura` ahí pisaría el significado de `baul`
--   (que es "bueno pero congelado", no "descartado"). Una columna aparte no
--   interfiere con ningún filtro existente por `status`.
--
-- QUIÉN LO VE
--   Nadie del portal ve la papelera: `trashed_at is not null` se filtra tanto
--   en el listado del portal como en el del estudio por defecto. Solo un
--   filtro nuevo en `/guiones` (Paco) la muestra, con botón de restaurar.
--
-- QUIÉN PUEDE MANDAR A LA PAPELERA
--   Cualquier miembro del portal (viewer o collaborator) — es reversible y
--   solo Paco la ve, así que no hace falta el nivel de permiso de aprobar.
--   Va por SERVICE ROLE (`lib/portal/trash.ts`): un `viewer` no tiene ninguna
--   policy de `update` sobre `scripts` (solo `collaborator` la tiene, vía
--   `scripts_member_update`), así que una escritura con su propia sesión
--   fallaría para la mitad de los miembros. Mismo patrón que los comentarios.
--
-- CÓDIGO QUE DEPENDE DE ESTA MIGRACIÓN
--   - lib/portal/trash.ts                              (nuevo, service role)
--   - app/(portal)/portal/[clientId]/guiones/actions.ts (acción del portal)
--   - app/(app)/guiones/actions.ts                       (getScripts filtra, restore/delete)
--   - app/(app)/guiones/page.tsx                         (filtro "Papelera")
--   - netlify/functions/cleanup-scripts-trash-scheduled.ts (borrado a los 30 días)
--
-- Aditiva e idempotente. Se aplica ANTES del deploy (no rompe nada publicado:
-- el código de hoy nunca escribe ni lee esta columna).
-- ============================================================================

alter table scripts
  add column if not exists trashed_at timestamptz;

create index if not exists scripts_trashed_at_idx
  on scripts(trashed_at)
  where trashed_at is not null;

comment on column scripts.trashed_at is
  'Borrado suave: NULL = guion normal. Con fecha, está en la papelera desde ese momento — invisible en el portal y en /guiones salvo el filtro "Papelera". netlify/functions/cleanup-scripts-trash-scheduled.ts lo borra en firme a los 30 días.';


-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- select column_name from information_schema.columns
-- where table_name = 'scripts' and column_name = 'trashed_at';
-- ============================================================================
