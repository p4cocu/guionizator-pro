# Pendientes — Guionizator Pro

## 🎯 Reportes para clientes externos (plan aprobado 2026-08-07)

Objetivo: que marcas de terceros usen la app con **su propia API key de Apify**
(cada quien paga su scraping) y que se pueda **descargar un reporte** con los
posts que Paco seleccione, para que el cliente vea qué contenido funciona y qué
debe grabar.

Decisiones tomadas al planear:

- **Acceso por fases.** Fase 1 = Paco administra los tokens y entrega el reporte.
  El portal con login para el cliente se difiere (ver Fase D).
- **Motor del reporte en TypeScript**, no Python. Netlify no tiene runtime de
  Python — por eso `app/api/transcribe-reel/route.ts` está capado a dev. Un
  reporte en Python solo se podría generar en la Mac de Paco.
- **Formatos: Excel (.xlsx) + PDF ejecutivo.** Sin Word → el PDF carga los
  guiones adaptados completos.
- **Transcripción sigue local** (Whisper en la Mac). El reporte reporta el estado
  "¿transcrito? sí/no"; migrar a una API en la nube queda para después.

### Fase A — API key de Apify por cliente  ✅ hecha (2026-08-07)

Columnas nuevas en `clients` (`apify_token_cipher`, `apify_token_last4`,
`apify_token_valid`, `apify_token_checked_at`), cifrado AES-256-GCM con
`SECRETS_KEY`, resolución por cliente con fallback al token global, y sección
"Apify" en el perfil del cliente. Ver `CLAUDE.md` → "Token de Apify por cliente".

Migración: `supabase/migrations/0001_apify_token_por_cliente.sql`.
Las de las fases B y C se escriben como `0002…` / `0003…` cuando se implementen
(el SQL de abajo es el borrador, no la migración final).

### Fase B — Vínculo confiable guion ↔ post

Hoy el guion adaptado se liga al post de competencia **solo por string**
(`scripts.source_post_permalink`, ver `AdaptarModal.tsx`). Para que el reporte
pueda decir "este post → este guion" sin adivinar:

```sql
alter table scripts add column source_post_id uuid
  references competitor_posts(id) on delete set null;
create index scripts_source_post_id_idx on scripts(source_post_id);
```

`on delete set null` porque el cron de 40 días borra posts; el guion sobrevive y
conserva el permalink. Hay que llenarlo en las **dos** rutas de `AdaptarModal`:
la "ligera" (guarda directo) y la "completa" (pasa por `/guiones/nuevo`, así que
el id viaja como query param).

### Fase C — Generación del reporte

Tabla `reports` (`owner_id`, `client_id`, `title`, `period_start/end`,
`snapshot jsonb`, `created_at`) con RLS owner-only. El `snapshot` **congela las
filas** al momento de generar: sin eso el reporte se vacía solo cuando el cron
de 40 días borra los posts. Sin Supabase Storage — se regenera idéntico desde
el snapshot, una pieza menos de infraestructura.

- Selección múltiple en `/competencia` (checkbox por tarjeta + barra
  "N seleccionados → Generar reporte").
- **Excel (`exceljs`), 3 hojas:**
  1. *Plan de grabación* — lo accionable: post, por qué funcionó, gancho, guion
     adaptado resumido, link, columna "Estado" editable.
  2. *Datos* — cuenta, fecha, tipo, link, likes, comentarios, vistas, followers,
     engagement rate, múltiplo vs. mediana de la cuenta, ¿transcrito?,
     transcripción, caption, gancho/estructura/pilar + nota de la IA.
  3. *Qué está funcionando* — agregado por gancho/estructura/pilar; sale de
     `getClassificationStats` (`competencia/actions.ts`).
- **PDF ejecutivo (`@react-pdf/renderer`)** — portada con marca, 1 página de
  hallazgos ("qué grabar esta semana y por qué") y los guiones adaptados
  completos con su link de referencia.
- Rutas `POST /api/reports`, `GET /api/reports/[id]/xlsx`, `GET /api/reports/[id]/pdf`
  — **con sesión de usuario, NO van a `PUBLIC_PATHS`**. Más una vista `/reportes`
  con el historial por cliente.

### Fase D — Portal de cliente (login propio)

Lo que hoy no existe: la app es de un solo usuario, todas las RLS son
`owner_id = auth.uid()`. Darle login a un externo hoy le mostraría todo (las
marcas de Paco, el cerebro, los guiones). Requiere `client_members`
(`user_id` + `client_id` + rol), RLS por membresía en **todas** las tablas,
sidebar restringido y que el cliente cargue su propio token de Apify.

⚠️ Al hacerlo, mover `apify_token_cipher` fuera de `clients` a una tabla sin
policy de `select`: hoy el dueño puede leer esa columna desde el browser con la
anon key (aceptable mientras el único usuario es Paco, no cuando entren
terceros).

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
