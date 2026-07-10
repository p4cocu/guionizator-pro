# Pendientes — Guionizator Pro

## Auto-refresh del token de Instagram

El long-lived token de Instagram caduca a los ~60 días. Hoy se renueva con un
**botón manual** ("Renovar token" en el perfil del cliente) — si Paco no entra
a renovar, las cuentas dejan de traer métricas. Ver detalle en `CLAUDE.md` →
"Integración Instagram" → "⚠️ Pendiente de infraestructura".

Propuesta: Netlify Scheduled Function diaria que llame a `refreshInstagramToken`
para las cuentas cuyo `token_expires_at` esté dentro de los próximos ~7 días.
El patrón ya existe en el repo — copiar la estructura de
`netlify/functions/cleanup-competencia-scheduled.ts` (ver "Jobs programados"
en `CLAUDE.md`).

## ✅ Resuelto — Limpieza automática de posts viejos de Competencia

Implementado 2026-07-09 (opción B: independiente del scrape). Ver detalle en
`CLAUDE.md` → "Jobs programados (Netlify Scheduled Functions)".

- Umbral final: **40 días** desde `posted_at` (Paco ajustó de 60 a 40 al confirmar).
- `netlify/functions/cleanup-competencia-scheduled.ts` corre a diario (`@daily`
  en `netlify.toml`), borra en TODOS los owners/clientes, excluye favoritos.
- `lib/competencia/scrape.ts` (paso 5b) también se actualizó a 40 días para
  purgar de inmediato al cliente recién scrapeado.
