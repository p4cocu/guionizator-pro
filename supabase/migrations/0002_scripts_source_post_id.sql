-- ============================================================================
-- 0002 — Vínculo confiable guion ↔ post de competencia
-- ============================================================================
-- Qué hace:
--   Agrega `scripts.source_post_id` como FK real a `competitor_posts`. Hasta
--   ahora la única liga era `scripts.source_post_permalink` (un string suelto),
--   que sirve para mostrar el link pero no para cruzar datos con confianza.
--
-- Por qué:
--   Fase B del plan de reportes (ver `pendientes.md`). El reporte necesita decir
--   "este post → este guion adaptado" sin adivinar por coincidencia de URL.
--
-- Por qué `on delete set null` y NO `cascade`:
--   El cron `cleanup-competencia-scheduled` borra posts con más de 40 días. Con
--   `cascade` se llevaría por delante los guiones adaptados. Con `set null` el
--   guion sobrevive, pierde la FK y conserva `source_post_permalink` como
--   registro histórico de dónde salió.
--
-- Código que depende de esta migración:
--   app/(app)/guiones/actions.ts           — saveScriptSilent / saveScriptWithNewIdea /
--                                            saveScriptVersion (arrastra la liga entre versiones)
--   app/(app)/competencia/AdaptarModal.tsx — rutas "ligera" (guarda directo) y
--                                            "completa" (via /guiones/nuevo)
--   app/(app)/guiones/nuevo/{page.tsx,NuevoGuionForm.tsx} — propagan el id
--
-- Notas:
--   - Sin CHECK constraints ni RLS nueva: `scripts` ya tiene su policy por owner.
--   - `source_post_permalink` se conserva: sigue siendo el que se muestra en el
--     detalle del guion y el único dato que queda si el post se borra.
-- ============================================================================

alter table scripts
  add column if not exists source_post_id uuid
    references competitor_posts(id) on delete set null;

create index if not exists scripts_source_post_id_idx
  on scripts(source_post_id);

comment on column scripts.source_post_id is
  'Post de competencia del que se adaptó este guion. NULL si el guion no nació de una adaptación, o si el post ya fue purgado por el cron de 40 días (on delete set null).';

-- ── Backfill de los guiones adaptados que ya existen ────────────────────────
-- Recupera la liga de los guiones viejos cruzando por permalink. Se acota por
-- owner_id Y client_id porque el mismo permalink puede estar cargado en varios
-- clientes del mismo owner: sin ese filtro, el UPDATE elegiría una fila
-- arbitraria y ligaría el guion al post del cliente equivocado.
-- Los posts ya purgados por el cron de 40 días no se pueden recuperar: esos
-- guiones se quedan con `source_post_id` en NULL y solo conservan el permalink.
update scripts s
set source_post_id = p.id
from competitor_posts p
where s.source_post_id is null
  and s.source_post_permalink is not null
  and p.permalink  = s.source_post_permalink
  and p.owner_id   = s.owner_id
  and p.client_id  = s.client_id;

-- ── Verificación (opcional) ─────────────────────────────────────────────────
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_name = 'scripts' and column_name like 'source_post%';
