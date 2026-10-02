-- ============================================================================
-- 0022 — Rendimiento de lo publicado (multiplicar lo que funcionó, punto 6)
-- ============================================================================
--
-- QUÉ RESUELVE
--   Un guion `publicado` no sabía cuál era su post de Instagram ni cómo le fue.
--   Ahora se vincula a su post (de la cuenta conectada de esa marca), se le
--   guardan las métricas reales junto con la mediana de la cuenta, y el código
--   decide si "funcionó" para ofrecer "✦ Multiplicar" (3 variaciones con el
--   mismo esqueleto).
--
-- QUÉ CAMBIA
--   - `scripts.ig_media_id` text: id del post en la API de Instagram.
--   - `scripts.ig_permalink` text: link público del post.
--   - `scripts.ig_posted_at` timestamptz: fecha real de publicación.
--   - `scripts.ig_metrics` jsonb: alcance, vistas, likes, comentarios,
--     compartidos y guardados + la mediana de la cuenta con la que se comparó.
--     Forma y lectura tolerante en lib/multiply/metrics.ts.
--   - `scripts.ig_metrics_at` timestamptz: cuándo se midió.
--   Todas sin CHECK.
--   - `scripts_guard_member_update` congela además las 5 columnas cuando quien
--     edita no es el dueño: un `collaborator` puede hacer `update` sobre
--     `scripts` (policy `scripts_member_update`) y, sin esto, podría inflarse
--     las métricas desde PostgREST. Y un update que SOLO toca esas columnas
--     ya no sella last_edited_by/last_edited_at (no es editar el guion).
--
-- CÓDIGO QUE DEPENDE DE ESTA MIGRACIÓN
--   - app/(app)/guiones/rendimiento/actions.ts, PerformancePanel.tsx
--   - app/(app)/guiones/ScriptCard.tsx, lib/multiply/*
--   - saveScriptVersion (arrastra el vínculo a la versión nueva)
--
-- Va ANTES del deploy: /guiones/[id] y /guiones/hechos leen las columnas.
-- Aditiva e idempotente.
-- ============================================================================

alter table scripts add column if not exists ig_media_id   text;
alter table scripts add column if not exists ig_permalink  text;
alter table scripts add column if not exists ig_posted_at  timestamptz;
alter table scripts add column if not exists ig_metrics    jsonb;
alter table scripts add column if not exists ig_metrics_at timestamptz;

comment on column scripts.ig_media_id is
  'Post de Instagram de este guion (0022). Lo vincula el dueño desde /guiones/[id].';
comment on column scripts.ig_metrics is
  'Métricas reales + mediana de la cuenta (0022). Forma en lib/multiply/metrics.ts.';

create index if not exists scripts_ig_media_id_idx on scripts (ig_media_id) where ig_media_id is not null;

create or replace function public.scripts_guard_member_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Sin sesión de usuario (service role: crons, background functions): no se
  -- toca nada, para no pisar last_edited_by con null.
  if auth.uid() is null then
    return new;
  end if;

  if auth.uid() is distinct from old.owner_id then
    new.owner_id      := old.owner_id;
    new.client_id     := old.client_id;
    new.generated_by  := old.generated_by;
    new.product_id    := old.product_id;
    -- 0022: el rendimiento lo escribe solo el dueño.
    new.ig_media_id   := old.ig_media_id;
    new.ig_permalink  := old.ig_permalink;
    new.ig_posted_at  := old.ig_posted_at;
    new.ig_metrics    := old.ig_metrics;
    new.ig_metrics_at := old.ig_metrics_at;
  end if;

  -- 0022: vincular o refrescar métricas no es "editar el guion". Sin esto,
  -- cada refresco sellaba last_edited_by con el dueño y borraba el aviso
  -- "el cliente editó el texto después de aprobarlo" (feedbackActions.ts).
  if (to_jsonb(new) - array['ig_media_id','ig_permalink','ig_posted_at','ig_metrics','ig_metrics_at','last_edited_by','last_edited_at'])
     = (to_jsonb(old) - array['ig_media_id','ig_permalink','ig_posted_at','ig_metrics','ig_metrics_at','last_edited_by','last_edited_at']) then
    return new;
  end if;

  new.last_edited_by := auth.uid();
  new.last_edited_at := now();
  return new;
end;
$function$;
