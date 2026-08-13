-- ============================================================================
-- 0007 — Baja de las columnas de Apify en `clients`
-- ============================================================================
-- Qué hace:
--   Borra `clients.apify_token_cipher`, `apify_token_last4`, `apify_token_valid`
--   y `apify_token_checked_at`. Su nuevo lugar es `client_secrets` (migración
--   0006), que no tiene grants para el browser.
--
-- Por qué está separada de 0006:
--   El deploy es manual. Entre correr la migración y `netlify deploy --prod`,
--   la app publicada sigue leyendo las columnas viejas: si 0006 las borrara,
--   el perfil del cliente y el scraping tirarían error en ese rato. 0006 copia
--   los datos y deja las columnas; 0007 las saca cuando ya no las usa nadie.
--
-- ⚠️ ORDEN — correr SOLO después de:
--   1. Aplicar 0006.
--   2. Verificar que los tokens se copiaron:
--        select c.nombre, s.apify_token_last4, s.apify_token_valid
--        from clients c left join client_secrets s on s.client_id = c.id
--        order by c.nombre;
--   3. `netlify build && netlify deploy --prod` con el código que lee
--      `client_secrets`.
--   4. Probar en producción el perfil de un cliente con token: "Verificar token"
--      debe seguir funcionando.
--   Recién ahí, esto. Es el punto sin retorno de la etapa 1: después de correrlo,
--   volver al código viejo deja el scraping sin token.
--
-- Código que depende de esta migración:
--   lib/competencia/apifyToken.ts, app/(app)/clientes/actions.ts,
--   app/(app)/clientes/[id]/page.tsx — todos ya leen `client_secrets`.
-- ============================================================================

-- Red de seguridad: si algún token quedó sin copiar, la migración se planta acá
-- en vez de borrarlo.
do $$
declare
  faltantes int;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients'
      and column_name = 'apify_token_cipher'
  ) then
    select count(*) into faltantes
    from clients c
    left join client_secrets s on s.client_id = c.id
    where c.apify_token_cipher is not null
      and (s.apify_token_cipher is null or s.apify_token_cipher <> c.apify_token_cipher);

    if faltantes > 0 then
      raise exception
        'Hay % cliente(s) cuyo token de Apify no está copiado en client_secrets. Corré 0006 primero y volvé a intentar.',
        faltantes;
    end if;
  end if;
end $$;

alter table clients
  drop column if exists apify_token_cipher,
  drop column if exists apify_token_last4,
  drop column if exists apify_token_valid,
  drop column if exists apify_token_checked_at;

-- ── Verificación ────────────────────────────────────────────────────────────
-- Debe devolver 0 filas:
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'clients'
--   and column_name like 'apify_%';
--
-- Y los tokens siguen ahí:
-- select client_id, apify_token_last4, apify_token_valid from client_secrets;
-- ============================================================================
