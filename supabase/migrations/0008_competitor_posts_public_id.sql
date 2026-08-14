-- ============================================================================
-- 0008 — ID público y legible para cada post de competencia
-- ============================================================================
-- Qué hace:
--   Agrega `competitor_posts.public_id`: un código de 6 caracteres, único a
--   nivel global (no por cliente), pensado para decirse por WhatsApp y
--   escribirse a mano. Ej: Q7F2M9.
--
-- Por qué:
--   El cliente necesita poder referirse a una pieza concreta ("cambiame el
--   Q7F2M9") sin mandar links ni describir el video. El uuid de la fila no
--   sirve para eso: no se dicta ni se recuerda.
--
-- Alfabeto (31 caracteres): 23456789ABCDEFGHJKMNPQRSTUVWXYZ
--   Sin 0/O ni 1/I/L, que son los pares que se confunden al leer o dictar.
--   31^6 ≈ 887 millones de combinaciones: con miles de posts, la probabilidad
--   de colisión es despreciable, y además hay índice único + reintento.
--
-- Código que depende de esta migración:
--   lib/competencia/publicId.ts             — alfabeto/normalización (fuente de
--                                             verdad en el lado TypeScript)
--   app/(app)/competencia/actions.ts        — POST_COLUMNS, findPostByPublicId
--   app/(app)/competencia/CompetenciaClient.tsx — badge en la tarjeta + buscador
--   lib/reports/snapshot.ts                 — `publicId` en el snapshot (v2)
--   lib/reports/{xlsx,pdf}.ts               — columna / línea con el ID
--
-- ⚠️ ORDEN DE APLICACIÓN — esta migración va ANTES del deploy.
--    Es puramente aditiva: el código publicado hoy no selecciona `public_id` ni
--    lo inserta (el default lo llena solo), así que la app vieja sigue
--    funcionando entre la migración y el deploy. Al revés NO: si se deploya
--    primero, el `select` de /competencia pide una columna que todavía no
--    existe y la página se queda sin posts.
--
-- Notas sobre estabilidad del ID:
--   - El upsert de `lib/competencia/scrape.ts` (onConflict
--     owner_id,client_id,shortcode) no manda `public_id`, así que re-scrapear
--     una cuenta actualiza métricas SIN tocar el ID. Es el punto: el ID tiene
--     que sobrevivir a las búsquedas o no sirve como referencia.
--   - El mismo reel guardado para dos clientes distintos son dos filas y por lo
--     tanto dos IDs. Correcto: el ID identifica la pieza en el tablero de esa
--     marca.
--   - `cleanup-competencia-scheduled` borra posts a los 40 días y su ID no se
--     reutiliza (se genera al azar, no por secuencia). Los reportes ya
--     generados conservan el ID dentro de su snapshot congelado.
-- ============================================================================

-- 1. La columna, todavía nullable y sin default: primero hay que poder
--    backfillear las filas existentes.
alter table public.competitor_posts
  add column if not exists public_id text;

-- 2. Generador con reintento.
--    `security definer` NO es cosmético: la unicidad es global pero la RLS de
--    `competitor_posts` es por owner. Sin definer, el `exists` de abajo solo
--    vería los posts del usuario que inserta y podría devolver un código que ya
--    usa otro owner — el índice único lo rechazaría y el insert reventaría.
--    La función no lee ni devuelve datos de nadie: solo un string al azar.
create or replace function public.gen_competitor_public_id()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  id_length constant int := 6;
  candidate text;
  i int;
  attempts int := 0;
begin
  loop
    candidate := '';
    for i in 1..id_length loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    exit when not exists (
      select 1 from public.competitor_posts where public_id = candidate
    );

    attempts := attempts + 1;
    if attempts > 50 then
      raise exception 'No se pudo generar un public_id único tras 50 intentos';
    end if;
  end loop;

  return candidate;
end;
$$;

-- 3. El índice único va ANTES del backfill a propósito: si algo colisiona,
--    queremos que falle ruidoso y no que queden dos posts con el mismo código.
--    Acepta nulls (varios) mientras dura el backfill.
create unique index if not exists competitor_posts_public_id_key
  on public.competitor_posts (public_id);

-- 4. Backfill fila por fila. NO se puede hacer con un solo UPDATE masivo: dentro
--    de una misma sentencia, el `exists` de la función no ve las filas que ella
--    misma acaba de escribir (snapshot previo a la sentencia) y repetiría
--    códigos. Cada UPDATE separado sí ve lo anterior.
do $$
declare
  r record;
begin
  for r in select id from public.competitor_posts where public_id is null loop
    update public.competitor_posts
      set public_id = public.gen_competitor_public_id()
      where id = r.id;
  end loop;
end;
$$;

-- 5. Recién ahora: default para todo lo que se inserte de acá en adelante
--    (scrape, alta manual) y not null.
alter table public.competitor_posts
  alter column public_id set default public.gen_competitor_public_id();

alter table public.competitor_posts
  alter column public_id set not null;

comment on column public.competitor_posts.public_id is
  'Código corto (6 chars, sin 0/O/1/I/L) único global, para que el cliente pueda referirse a una pieza: "cambiame el Q7F2M9". Estable: el upsert del scrape no lo toca.';

-- ── Verificación (correr a mano después de aplicar) ──────────────────────────
-- select count(*) as total,
--        count(public_id) as con_id,
--        count(distinct public_id) as distintos
--   from public.competitor_posts;
-- Los tres números tienen que ser iguales.
