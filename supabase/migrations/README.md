# Migraciones — Guionizator Pro

Las migraciones se aplican **a mano en el SQL Editor de Supabase**. No hay CLI ni
pipeline automático: esta carpeta es el registro versionado de lo que hay que
correr, en orden.

## Convención

- Un archivo por cambio: `NNNN_descripcion_en_snake_case.sql`, numerado
  correlativo (`0001`, `0002`, …). El número manda el orden de aplicación.
- **Idempotentes siempre** (`if not exists`, `drop constraint if exists`) para
  que volver a correr una migración no rompa nada.
- Cada archivo abre con un comentario: qué cambia, por qué, y qué código depende
  de ella.
- La migración se escribe **en el mismo cambio** que el código que la necesita
  (regla dura de `CLAUDE.md`): agregar o renombrar un valor de una columna con
  `CHECK constraint` sin su `ALTER TABLE` revienta en runtime.

## Estado

El esquema anterior a `0001` (tablas `clients`, `scripts`, `competitor_posts`,
`brain_versions`, etc.) se aplicó ad-hoc antes de que existiera esta carpeta, así
que **no está reconstruido aquí**. La fuente de verdad de esas tablas es la base
en Supabase; `CLAUDE.md` documenta las columnas con `CHECK constraint`.

## Aplicadas

| # | Archivo | Aplicada en Supabase |
|---|---|---|
| 0001 | `0001_apify_token_por_cliente.sql` | ✅ 2026-08-07 |
| 0002 | `0002_scripts_source_post_id.sql` | ✅ 2026-08-07 |
| 0003 | `0003_backfill_source_post_id_cross_client.sql` | ✅ 2026-08-07 |
| 0004 | `0004_reports.sql` | ✅ 2026-08-07 |
| 0005 | `0005_instagram_refresh_estado.sql` | ✅ 2026-08-10 |
| 0006 | `0006_portal_cliente.sql` | ⏳ pendiente |
| 0007 | `0007_drop_apify_cols_de_clients.sql` | ⏳ pendiente — **después** del deploy (ver abajo) |

### 0006 + 0007 van separadas a propósito

El deploy es manual. `0006` crea todo y **copia** los tokens de Apify a
`client_secrets` dejando las columnas viejas en su lugar, para que la app que
está publicada siga funcionando. `0007` las borra, y se corre recién después de
`netlify build && netlify deploy --prod`. Entre una y otra: no cambies tokens de
Apify (la app vieja escribiría en las columnas viejas y el cambio se perdería).
