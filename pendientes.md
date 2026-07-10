# Pendientes — Guionizator Pro

## ✅ Resuelto — Limpieza automática de posts viejos de Competencia

Implementado 2026-07-09 (opción B: independiente del scrape). Ver detalle en
`CLAUDE.md` → "Jobs programados (Netlify Scheduled Functions)".

- Umbral final: **40 días** desde `posted_at` (Paco ajustó de 60 a 40 al confirmar).
- `netlify/functions/cleanup-competencia-scheduled.ts` corre a diario (`@daily`
  en `netlify.toml`), borra en TODOS los owners/clientes, excluye favoritos.
- `lib/competencia/scrape.ts` (paso 5b) también se actualizó a 40 días para
  purgar de inmediato al cliente recién scrapeado.
