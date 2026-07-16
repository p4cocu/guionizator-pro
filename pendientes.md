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

## Reintento automático si falla el parseo del guion de producción

Un día Paco apretó "Generar guión de producción" y salió el error **"Error al
parsear respuesta de IA"**. Volvió a apretar el mismo botón en el mismo guion
y esa vez sí funcionó.

**Qué pasa en criollo:** cuando la IA arma el guion de producción, le pedimos
que responda en un formato de datos muy estricto (JSON) para poder mostrarlo
en pantalla. Casi siempre lo hace bien, pero de vez en cuando "ensucia" un
poco la respuesta (agrega alguna palabra de más, corta el texto antes de
terminar, etc.) y ahí la app no logra leerlo — no es que se haya roto nada,
es más como un tropezón puntual de la IA. Por eso reintentar manualmente
resuelve el 99% de los casos.

**Propuesta:** que la app reintente sola una vez (sin que Paco tenga que
volver a apretar el botón) si la primera respuesta no se puede leer. Cambio
chico y de bajo riesgo — vive en
`app/api/ai/production-blocks/route.ts` (mismo patrón se repite en varios
endpoints de `app/api/ai/`, ej. `script/route.ts`, `structures/route.ts`,
`inline-edit/route.ts`, etc., así que si se hace, conviene aplicarlo parejo).

## ✅ Resuelto — Limpieza automática de posts viejos de Competencia

Implementado 2026-07-09 (opción B: independiente del scrape). Ver detalle en
`CLAUDE.md` → "Jobs programados (Netlify Scheduled Functions)".

- Umbral final: **40 días** desde `posted_at` (Paco ajustó de 60 a 40 al confirmar).
- `netlify/functions/cleanup-competencia-scheduled.ts` corre a diario (`@daily`
  en `netlify.toml`), borra en TODOS los owners/clientes, excluye favoritos.
- `lib/competencia/scrape.ts` (paso 5b) también se actualizó a 40 días para
  purgar de inmediato al cliente recién scrapeado.
