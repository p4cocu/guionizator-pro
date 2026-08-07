-- ============================================================================
-- 0001 — Token de Apify por cliente
-- ============================================================================
-- Qué hace:
--   Agrega a `clients` las columnas para que cada marca guarde SU PROPIO token
--   de Apify (cifrado), y así cada cliente pague su scraping de competencia.
--   Los clientes sin token propio siguen usando el global `APIFY_API_TOKEN`.
--
-- Por qué:
--   Fase A del plan de "Reportes para clientes externos" (ver `pendientes.md`).
--
-- Código que depende de esta migración:
--   lib/crypto/secrets.ts              — cifra/descifra con SECRETS_KEY (AES-256-GCM)
--   lib/competencia/apifyToken.ts      — resuelve token del cliente → global
--   lib/competencia/scrape.ts          — runScrapeJob resuelve el token por client_id
--   app/(app)/clientes/actions.ts      — saveApifyToken / checkApifyToken / removeApifyToken
--   app/(app)/clientes/[id]/ApifySection.tsx — UI en el perfil del cliente
--
-- ⚠️ Requiere además la variable de entorno `SECRETS_KEY` (32 bytes en base64,
--    `openssl rand -base64 32`) con el MISMO valor en local y en Netlify. Si
--    cambia, los tokens ya guardados no se pueden descifrar.
--
-- Notas:
--   - Sin CHECK constraints: ninguna de estas columnas es tipo-enum.
--   - Sin RLS nueva: `clients` ya tiene su policy por `owner_id = auth.uid()`.
--   - `apify_token_cipher` guarda el formato `v1:<iv>:<tag>:<ciphertext>`,
--     NUNCA el token en claro.
-- ============================================================================

alter table clients
  add column if not exists apify_token_cipher     text,
  add column if not exists apify_token_last4      text,
  add column if not exists apify_token_valid      boolean not null default false,
  add column if not exists apify_token_checked_at timestamptz;

comment on column clients.apify_token_cipher is
  'Token de API de Apify del cliente, cifrado con AES-256-GCM (SECRETS_KEY). Formato v1:<iv>:<tag>:<ciphertext>. Nunca se expone al browser.';
comment on column clients.apify_token_last4 is
  'Últimos 4 caracteres del token, para mostrarlo enmascarado en la UI.';
comment on column clients.apify_token_valid is
  'true si Apify aceptó el token la última vez que se verificó. En false, startScrape falla con mensaje claro en vez de gastar créditos.';
comment on column clients.apify_token_checked_at is
  'Cuándo se validó por última vez contra GET /v2/users/me de Apify.';

-- ── Verificación (opcional: correr después para confirmar) ──────────────────
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_name = 'clients' and column_name like 'apify_%'
-- order by column_name;
