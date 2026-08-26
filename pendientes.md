# Pendientes — Guionizator Pro

## 🔧 La pared de pago anuncia el cupo del PLAN, no el de la marca (Fase E)

Detectado 2026-08-25 probando P1 con la marca `PRUEBA STRIPE`.

`/portal/suscripcion/[clientId]` dibuja el plan con las constantes de
`lib/billing/plan.ts` (`PLAN_AI_CREDITS` = 40 y `PLAN_TRANSCRIPTIONS` = 40),
sin mirar el override de esa marca. La marca de prueba tenía
`ai_generation_limit = 1` y la pantalla igual prometía *"40 generaciones con IA
por mes"*.

**Hoy no afecta a nadie**: los overrides son una herramienta interna de Paco y
un cliente real no tiene ninguno, así que el número que ve es el correcto. Pero
el día que se le ponga un tope distinto a alguien —por soporte, por un acuerdo
especial— la pantalla de venta le va a prometer algo que la app después no le
da.

Además lista las transcripciones aunque la marca no tenga `competencia`
prendida, que es la única sección desde donde se transcribe.

Qué habría que decidir cuando se toque:

- ¿La pantalla muestra lo que esa marca va a recibir de verdad
  (`effectiveLimit(client.aiGenerationLimit, false, PLAN_AI_CREDITS)`), o
  siempre lo del plan porque es una página de venta?
- Si muestra lo real, esconder la línea de transcripciones cuando la marca no
  tiene `competencia` habilitada.

Archivo: `app/(portal)/portal/suscripcion/[clientId]/page.tsx`.


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

### Fase B — Vínculo confiable guion ↔ post  ✅ hecha (2026-08-07)

`scripts.source_post_id` como FK real a `competitor_posts` (`on delete set null`,
porque el cron de 40 días borra posts y el guion debe sobrevivir conservando
`source_post_permalink`). Se llena en las dos rutas de `AdaptarModal` — la
"ligera" guarda directo, la "completa" manda el id como query param a
`/guiones/nuevo` — y `saveScriptVersion` la arrastra entre versiones para que
editar un guion adaptado no lo desconecte del post.

Migración: `supabase/migrations/0002_scripts_source_post_id.sql`, que además
**hace backfill** de los guiones adaptados viejos cruzando por permalink
(acotado por `owner_id` + `client_id`). Los posts ya purgados por el cron no se
pueden recuperar: esos guiones quedan con `source_post_id` en NULL.

### Fase C — Generación del reporte  ✅ hecha (2026-08-07)

Implementada según el diseño de abajo. Migración `0004_reports.sql`. Detalle en
`CLAUDE.md` → "Reportes de competencia". Pendientes conocidos, ninguno bloqueante:
el PDF usa Helvetica (no Space Grotesk) y la transcripción sigue siendo local, así
que el reporte marca "¿Transcrito? No" en lo que no se procesó a mano.

<details><summary>Diseño original</summary>



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

</details>

### Fase D — Portal de cliente (login propio)

📄 **Plan detallado y aprobado (2026-08-12): [`docs/fase-d-portal-cliente.md`](docs/fase-d-portal-cliente.md)**
— modelo de datos, RLS por membresía, secciones configurables por cliente
(`enabled_features`), generación con IA como add-on de pago, invitaciones por
email y orden de implementación en 6 etapas. Lo de abajo es el esbozo original.

Lo que hoy no existe: la app es de un solo usuario, todas las RLS son
`owner_id = auth.uid()`. Darle login a un externo hoy le mostraría todo (las
marcas de Paco, el cerebro, los guiones). Requiere `client_members`
(`user_id` + `client_id` + rol), RLS por membresía en **todas** las tablas,
sidebar restringido y que el cliente cargue su propio token de Apify.

⚠️ Al hacerlo, mover `apify_token_cipher` fuera de `clients` a una tabla sin
policy de `select`: hoy el dueño puede leer esa columna desde el browser con la
anon key (aceptable mientras el único usuario es Paco, no cuando entren
terceros).

## ✅ Resuelto — Reintento automático si falla el parseo de la IA

Implementado 2026-08-12. Ver detalle en `CLAUDE.md` → "Respuestas JSON de la IA".

El síntoma era: Paco apretaba "Generar guión de producción", salía **"Error al
parsear respuesta de IA"**, volvía a apretar el mismo botón y funcionaba. La IA
"ensuciaba" la respuesta (una palabra de más, un fence raro, el texto cortado) y
la app no la sabía leer — un tropezón puntual, no un bug.

Ahora la app hace sola lo que Paco hacía a mano:

- `lib/ai/json.ts` — parseo tolerante (`extractJson`) + **un reintento
  automático** avisándole a la IA qué falló. Si la respuesta se cortó por
  longitud, el reintento sube `max_tokens`.
- Aplicado parejo a los **16 endpoints de `app/api/ai/`**, más
  `app/api/publish/copy`, `lib/resources/classify.ts` y las server actions de
  Ganchos, Tendencias y Competencia (esta última tenía su propio reintento a
  ciegas; ahora usa el compartido, que además le dice al modelo qué corregir).
- Los mensajes de error que ve el usuario no cambiaron: solo aparecen si los
  **dos** intentos fallan.

## ✅ Resuelto — Auto-refresh del token de Instagram

Implementado 2026-08-10. El token long-lived (~60 días) ya no depende de que
Paco entre a apretar "Renovar token". Ver detalle en `CLAUDE.md` → "Jobs
programados".

- `netlify/functions/refresh-instagram-tokens-scheduled.ts` corre a diario
  (`@daily` en `netlify.toml`): renueva las cuentas que vencen dentro de 7 días,
  en todos los owners. Salta las renovadas hace menos de 24h (Instagram las
  rechaza).
- Si falla una cuenta, el resto sigue: el error queda en
  `instagram_accounts.last_refresh_error` y se muestra en el perfil del cliente.
  Migración `0005_instagram_refresh_estado.sql`.
- El botón manual sigue funcionando y limpia el error registrado.

## ✅ Resuelto — Limpieza automática de posts viejos de Competencia

Implementado 2026-07-09 (opción B: independiente del scrape). Ver detalle en
`CLAUDE.md` → "Jobs programados (Netlify Scheduled Functions)".

- Umbral final: **40 días** desde `posted_at` (Paco ajustó de 60 a 40 al confirmar).
- `netlify/functions/cleanup-competencia-scheduled.ts` corre a diario (`@daily`
  en `netlify.toml`), borra en TODOS los owners/clientes, excluye favoritos.
- `lib/competencia/scrape.ts` (paso 5b) también se actualizó a 40 días para
  purgar de inmediato al cliente recién scrapeado.
