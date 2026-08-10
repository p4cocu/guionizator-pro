-- 0005 — Estado del auto-refresh del token de Instagram
--
-- Qué cambia: agrega a `instagram_accounts` dos columnas de diagnóstico que
-- escribe el cron `refresh-instagram-tokens-scheduled`:
--   - last_refresh_attempt_at: cuándo corrió el último intento (haya salido
--     bien o mal). Sirve para saber si el cron está vivo.
--   - last_refresh_error: mensaje del último intento fallido, NULL si el
--     último intento salió bien. Sin esto, un cron que falla (token ya
--     vencido, permiso revocado en Meta) falla en silencio — exactamente el
--     problema que el cron viene a resolver.
--
-- Por qué: el long-lived token caduca a los ~60 días; hasta ahora se renovaba
-- con el botón manual "Renovar token" del perfil de cliente.
--
-- Código que depende de ella:
--   - netlify/functions/refresh-instagram-tokens-scheduled.ts (escribe ambas)
--   - app/(app)/clientes/[id]/page.tsx + InstagramSection.tsx (las muestran)
--   - app/(app)/instagram/actions.ts → refreshInstagramToken (limpia el error
--     cuando el refresh manual sale bien)
--
-- Sin CHECK constraint. Idempotente.

alter table public.instagram_accounts
  add column if not exists last_refresh_attempt_at timestamptz,
  add column if not exists last_refresh_error text;

comment on column public.instagram_accounts.last_refresh_attempt_at is
  'Último intento de refresh automático del token (cron diario), exitoso o no.';
comment on column public.instagram_accounts.last_refresh_error is
  'Mensaje del último intento fallido de refresh; NULL si el último salió bien.';
