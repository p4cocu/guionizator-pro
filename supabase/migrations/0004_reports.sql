-- ============================================================================
-- 0004 — Tabla `reports` (reportes de competencia para clientes)
-- ============================================================================
-- Qué hace:
--   Guarda un reporte generado a partir de los posts que Paco selecciona en
--   /competencia. El contenido se congela en `snapshot` (jsonb).
--
-- Por qué el snapshot y no consultar en vivo:
--   El cron `cleanup-competencia-scheduled` borra posts con más de 40 días. Un
--   reporte que consultara las tablas al momento de descargarlo se iría
--   vaciando solo — el cliente abre en septiembre el reporte de julio y no hay
--   nada. Con el snapshot, el .xlsx y el .pdf se regeneran idénticos siempre.
--
-- Por qué NO se guarda el archivo en Supabase Storage:
--   Regenerarlo desde el snapshot da el mismo resultado y evita administrar un
--   bucket, políticas de acceso y URLs firmadas. Una pieza menos.
--
-- Código que depende de esta migración:
--   lib/reports/snapshot.ts            — arma y tipa el snapshot
--   lib/reports/xlsx.ts                — genera el Excel (exceljs)
--   lib/reports/pdf.ts                 — genera el PDF (pdfkit)
--   app/api/reports/route.ts           — POST: crea el reporte
--   app/api/reports/[id]/xlsx|pdf      — GET: descarga
--   app/(app)/reportes/                — historial por cliente
--
-- Notas:
--   - RLS owner-only, igual que el resto de las tablas de datos.
--   - `client_id` con `on delete cascade`: si se borra el cliente, sus reportes
--     no tienen sentido. El snapshot ya no se podría contextualizar.
-- ============================================================================

create table if not exists reports (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  client_id     uuid not null references clients(id)    on delete cascade,
  title         text not null,
  period_start  date,
  period_end    date,
  snapshot      jsonb not null,
  post_count    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists reports_owner_client_idx
  on reports(owner_id, client_id, created_at desc);

alter table reports enable row level security;

drop policy if exists reports_owner_all on reports;
create policy reports_owner_all on reports
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

comment on table reports is
  'Reportes de competencia congelados. `snapshot` guarda las filas al momento de generar, para que el reporte sobreviva a la purga de posts de 40 días.';
comment on column reports.snapshot is
  'jsonb: { client: {...}, rows: [ { post, classification, script } ], stats: {...} }. Ver lib/reports/snapshot.ts.';

-- ── Verificación (opcional) ─────────────────────────────────────────────────
-- select table_name from information_schema.tables where table_name = 'reports';
-- select policyname from pg_policies where tablename = 'reports';
