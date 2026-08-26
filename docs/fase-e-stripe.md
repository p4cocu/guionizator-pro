# Fase E — Cobro con Stripe

> Plan aprobado 2026-08-24. Migración `0013_stripe_billing.sql`.
> **Estado 2026-08-26: migración aplicada y P1–P10 corridos completos contra la
> cuenta LIVE** (se decidió no usar sandbox). Ver "Lo que salió de las pruebas".
> Falta el rollout de producción: registrar el webhook live, cargar las 6
> variables en Netlify y quitar exenciones marca por marca.

Hasta Fase D el portal se prendía con un switch manual y el cobro era un acuerdo
por fuera. Fase E lo convierte en un producto que se paga solo.

## Decisiones tomadas (no re-abrir)

| Decisión | Elegido | Por qué |
|---|---|---|
| Unidad de cobro | **Por marca**, no por persona | Adentro pueden entrar 2, 3 o 5 miembros sin costo extra. El cupo es de la marca y se comparte |
| Precio | **$300 MXN/mes**, único | Un solo Price. Las excepciones se hacen con cupones desde el dashboard, sin tocar código |
| Qué incluye | Portal + **40 generaciones** + **40 transcripciones** por ciclo | Un solo número que explicarle al cliente |
| Recargas | **$100/20** y **$200/50**, pago único, **no vencen** | El cupo del plan se pierde al cerrar el ciclo; lo comprado no. Es lo que se espera y evita el reclamo de "compré el 28 y lo perdí el 30" |
| Quién paga | `billing_contact_user_id` en la suscripción | **No** se agregó un rol a `client_members`: tocar ese CHECK arrastra `roles.ts`, la UI de miembros y las policies de `scripts` |
| Métodos | **Solo tarjeta** | Único método con cobro recurrente automático. OXXO/SPEI exigirían manejar el pago asíncrono |
| Prueba gratis | **No** | Quien llega ya fue invitado por Paco; no necesita probar a ciegas |
| CFDI | **No por ahora** | Stripe manda su recibo. Si un cliente pide factura, se hace por fuera |
| Autoservicio | **Stripe Customer Portal completo** (incluye cancelar) | Esconder el botón de cancelar retiene poco y se lee como mala fe; el soporte de "se me venció la tarjeta" cuesta más |
| Impago | `past_due` → **5 días de gracia** con aviso → corte | Corte automático pero no el mismo día |
| Marcas de hoy | **Todas exentas** por backfill | Es lo que hace que el rollout no le corte el acceso a nadie |

## Cuánto cuesta de verdad cada crédito

Cuatro acciones del portal escriben una fila en `ai_usage_log` (la lista vive en
`lib/billing/plan.ts` → `AI_CREDIT_ACTIONS`):

| Acción | `endpoint` | Modelo | Costo de API aprox. |
|---|---|---|---|
| Generar un guion | `portal:guion` | Sonnet 4.6 (reel) / Haiku (carrusel) | ~$1.00 MXN |
| Adaptar un post a mi marca | `portal:adapt-competitor` | Sonnet 4.6 | ~$1.40 MXN |
| Generar portadas | `portal:cover` | Haiku 4.5 | ~$0.10 MXN |
| Copy Expert | `portal:copy` | Haiku 4.5 | ~$0.10 MXN |

**Gratis**: guardar, editar, copiar, descargar, comentar, aprobar, papelera,
estrella y ver cualquier sección. Los pasos intermedios del modo "completo" (Big
Idea, estructuras) no descuentan, pero exigen cupo: con 0 el flujo ni arranca.

Una pieza terminada ≈ 3 créditos (guion + portadas + copy), 4 con una
regeneración. 40 créditos ≈ 10 piezas/mes ≈ **$60 MXN de API**, contra $286
netos después de la comisión de Stripe MX (3.6% + $3).

---

## Modelo de datos (`0013_stripe_billing.sql`)

Tres tablas nuevas, todas con **RLS activa y ninguna policy** +
`revoke all … from anon, authenticated` — mismo patrón que `client_secrets`
(`0006`) y `portal_profiles` (`0012`). Se leen y escriben solo con service role
desde `lib/billing/*`, y como el service role saltea la RLS, **toda** consulta
filtra la pertenencia a mano.

**`client_subscriptions`** (PK `client_id`). Estado de Stripe, ciclo de
facturación, saldo de recargas, exención y contacto de facturación.

**`credit_purchases`**. Una fila por recarga pagada; su
`stripe_checkout_session_id` unique es la idempotencia de la acreditación.

**`stripe_events`**. Un `evt_...` por evento procesado. El webhook inserta con
`on conflict do nothing` antes de tocar nada.

Más `ai_usage_log.paid_with` (`plan` | `credit`) y dos funciones.

### Por qué `exempt` es columna y no un `status`

`status` espeja **literalmente** lo que dice Stripe y lo escribe solo el webhook.
Si la exención viviera ahí, un `customer.subscription.updated` que llegara tarde
—y los webhooks **no llegan en orden**— podría pisarla y cortarle el acceso a una
marca propia. Separadas, ningún evento de Stripe puede tocar una decisión de
negocio.

### Por qué el saldo es un contador y no un cálculo

El cupo del plan se reinicia cada ciclo y se pierde; las recargas no vencen.
Derivar "cuántos créditos comprados quedan" exigiría recorrer todos los ciclos
cerrados sumando excedentes. `credit_balance` es el saldo real, y `paid_with`
deja el rastro de por qué bajó.

### Por qué hay dos funciones en la base

- **`apply_credit_purchase`** — acreditar son dos escrituras (la fila de la
  compra y el saldo). Por separado desde TypeScript hay un hueco real: si la
  primera entra y la segunda falla, el reintento de Stripe choca con el unique,
  se lee como "ya acreditado", y el cliente pagó por créditos que nunca recibió.
  Adentro de una función van en la misma transacción.
- **`consume_client_credit`** — PostgREST no acepta expresiones de columna
  (`credit_balance = credit_balance - 1`) en un `update`. Leer, restar en JS y
  escribir sería una condición de carrera con dinero adentro. El
  `and credit_balance > 0` hace que el saldo nunca quede negativo.

⚠️ Las dos llevan `revoke all … from public, anon, authenticated`. PostgREST
expone las funciones de `public`: sin ese revoke, un miembro con su JWT podría
llamar a `apply_credit_purchase` y regalarse créditos. **El revoke es la parte
que sostiene la seguridad.**

---

## El ciclo reemplaza al mes calendario

Hasta Fase D los dos medidores cortaban el día 1 a las 00:00 UTC. Con Stripe eso
deja de tener sentido: si un cliente paga el día 20, su cupo tiene que
reiniciarse el 20 — si no, alguien que se suscribe el 28 tiene tres días de cupo
por su primer mes completo.

`lib/portal/usage.ts` y `lib/competencia/transcriptionUsage.ts` reciben ahora el
inicio del ciclo (`client_subscriptions.current_period_start`). Cuando no hay
suscripción —una marca exenta, o antes de pagar— **caen al mes calendario UTC de
siempre**, que es exactamente el comportamiento anterior. Por eso nada se rompe
entre la migración y el encendido.

⚠️ **Cambia el significado de `clients.ai_generation_limit` y
`clients.transcription_limit`**: antes `null` = sin tope; ahora `null` = el tope
del plan (40 y 40). Para una marca `exempt` sigue queriendo decir sin tope, y por
eso el backfill de la migración importa tanto.

### Plan y recargas

```
usadoEnCiclo < tope   → gasta plan    (paid_with = 'plan')
usadoEnCiclo >= tope  → gasta recarga (paid_with = 'credit')
sin tope ni saldo     → bloqueado
```

Se mantiene la asimetría de Fase D: **chequear antes** de llamar a la API
(pasarse no gasta tokens) y **descontar después** de que respondió (un error de
la API no le cuesta el cupo). Las dos pestañas en paralelo siguen pudiendo
colarse por una, pero el peor caso mejoró: el `where credit_balance > 0` hace
que el saldo nunca quede negativo — como máximo se regala una generación, que ya
se pagó a Anthropic igual.

---

## Rutas

| Ruta | Se autentica por | `PUBLIC_PATHS` |
|---|---|---|
| `POST /api/stripe/webhook` | **firma de Stripe** | **SÍ** ⚠️ |
| `POST /api/billing/checkout` | sesión | no |
| `POST /api/billing/credits` | sesión | no |
| `POST /api/billing/portal` | sesión | no |
| `/portal/suscripcion/[clientId]` | sesión | no |
| `/portal/[clientId]/facturacion` | sesión | no |

⚠️ **El webhook va en `PUBLIC_PATHS`.** Stripe lo llama server-to-server, sin
cookies. Sin eso el middleware lo redirige (307) a `/login` antes de que corra su
código: Stripe lo cuenta como entrega fallida, reintenta unas horas y se rinde.
El síntoma es una suscripción que se cobra y nunca se activa, **sin un solo error
en los logs**. Es la tercera vez que este repo se cruza con esta trampa (Portadas
y el scraper de Competencia fueron las otras dos).

### Dos trampas del SDK de Stripe v22 (API `2026-07-29.dahlia`)

Las dos están encapsuladas en `lib/billing/stripe.ts` para que ningún handler
tenga que acordarse:

1. **`subscription.current_period_start/end` ya no existe.** El ciclo vive en
   cada item: `subscription.items.data[i].current_period_*`
   (`readSubscriptionPeriod`).
2. **`invoice.subscription` ya no existe.** La referencia está en
   `invoice.parent.subscription_details.subscription`
   (`subscriptionIdFromInvoice`).

### El webhook

Tres reglas que lo hacen correcto:

1. **Cuerpo crudo** (`await req.text()`). Con `req.json()` la firma no valida
   nunca: el JSON re-serializado no es byte por byte el que Stripe firmó.
2. **Idempotencia** vía `stripe_events`. Stripe reintenta todo lo que no responda
   2xx y puede repetir un evento aunque le hayas respondido bien.
3. **Sin orden garantizado.** `invoice.paid` puede llegar antes que
   `checkout.session.completed`. Ningún handler lee el estado anterior para
   decidir el siguiente: todos son escrituras planas. Por eso el `client_id`
   viaja también en `subscription_data.metadata` — un
   `customer.subscription.created` puede llegar cuando la fila todavía no tiene
   el `stripe_subscription_id`.

⚠️ **Los créditos de una recarga salen del `price_id` que Stripe cobró**
(`creditsForPriceId`), leído de los line items — nunca de nada que haya mandado
el browser. Si el número viniera del body, cualquiera compraría el paquete de 20
y reclamaría 5000.

---

## Alta: solo el primero paga

**No hay lógica de "¿es el primer miembro?"** — hay una sola pregunta: ¿esta
marca está pagada?

1. Invitación → crear cuenta → `acceptInviteAction` → vuelve a `/`.
2. `resolveLandingPath` manda a `/portal` → `[clientId]/page.tsx`.
3. `requirePortalClient` consulta `getBillingState`:
   - **activa o exenta** → entra directo, gratis. Es el 2º, 3º, 5º miembro.
   - **sin pagar** → `redirect("/portal/suscripcion/[clientId]")`.
4. El que paga queda como `billing_contact_user_id` (lo fija el webhook con el
   `user_id` del metadata).

Si el segundo miembro llega antes de que el primero pague, ve la pantalla de
pago — y está bien, porque la marca no está activa. Si paga él, él queda de
contacto.

Único caso de doble cobro posible: dos miembros pagando a la vez crean dos
suscripciones para el mismo customer. Se resuelve cancelando una desde el
dashboard; se prefiere eso a un lock que podría dejar a una marca sin poder pagar
si se traba.

---

## Dónde corta el impago

`lib/billing/access.ts` → `getBillingState()`, cacheado por request con `cache()`
de React (se consulta en cada request del portal).

| Estado | Entra | Aviso |
|---|---|---|
| `exempt` | sí | — |
| `active` | sí | — |
| `grace` (dentro de los 5 días) | sí | barra roja arriba de cada pantalla |
| `unpaid` / `canceled` / `none` | no | pantalla de pago |

El corte se calcula **en lectura** (`now >= grace_until`), **no hay cron**: nada
que se pueda atascar y dejar entrando gratis, ni que corte de más si corre dos
veces. `grace_until` lo escribe el webhook al **primer** `invoice.payment_failed`
— Stripe reintenta el cobro varios días y manda un evento por intento; si cada
uno reiniciara el reloj, la marca no se cortaría nunca.

Se aplica en tres lugares:

- **`requirePortalClient`** — cubre todas las páginas y server actions del
  portal de una sola vez (todas pasan por ahí).
- **`requireGenerationAccess`** — las rutas y actions de IA son endpoints
  públicos: que la UI no dibuje el botón no impide invocarlas con curl.
- **`loadReportForUser`** — sin esto, apagar el acceso escondería la pantalla
  pero el link directo al `.xlsx` seguiría sirviendo. Mismo agujero que ya se
  tapó en la etapa 4 con el flag `reportes`.

⚠️ **Dos excepciones deliberadas:**

1. **El dueño no se corta.** Al revés que los flags de sección (que cortan a
   Paco a propósito dentro de `/portal`, para poder probar los switches): si el
   impago lo cortara a él, no podría revisar la marca de un cliente moroso justo
   cuando más falta hace.
2. **`/portal/[id]/facturacion` se saltea el candado** (`skipBillingGate`). Si el
   impago también cerrara esa pantalla, el cliente suspendido no tendría desde
   dónde actualizar su tarjeta: quedaría encerrado afuera.

**Facturación no es un slug de `features.ts`** a propósito: agregarlo obligaría a
tocar el `clients_enabled_features_check` y no aporta nada — no es algo que Paco
quiera prender o apagar por marca. Se muestra siempre, y solo al contacto de
facturación (o al dueño).

---

## Variables de entorno

```bash
STRIPE_SECRET_KEY=            # sk_test_… en local, sk_live_… en Netlify
STRIPE_WEBHOOK_SECRET=        # whsec_… — DISTINTO en local y en producción
STRIPE_PRICE_SUBSCRIPTION=    # price_… $300 MXN/mes
STRIPE_PRICE_CREDITS_20=      # price_… $100 MXN, 20 créditos
STRIPE_PRICE_CREDITS_50=      # price_… $200 MXN, 50 créditos
BILLING_ENFORCED=false        # `true` enciende el corte por impago
```

**No hace falta publishable key ni Stripe.js**: se usa Checkout hospedado, o sea
que el servidor crea la sesión y redirige a `checkout.stripe.com`. Ningún dato de
tarjeta pasa por esta app y no hay ningún `NEXT_PUBLIC_` de Stripe.

⚠️ Los `price_...` de test y de live son objetos distintos. Cargar uno de test en
producción **no da error**: cobra $0 y confunde durante semanas.

---

## Cómo se prueba en modo test

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook   # imprime el whsec_
```

Tarjetas: `4242…4242` cobra bien · `4000 0000 0000 0341` falla al renovar ·
`4000 0000 0000 9995` fondos insuficientes.

| # | Qué | Qué tiene que pasar |
|---|---|---|
| 1 | Aceptar invitación a una marca sin pagar | Sale la pantalla de pago → Checkout → vuelve `active`, con `billing_contact_user_id` en ese usuario |
| 2 | Invitar a un segundo mail a la misma marca | Entra directo, **sin** Checkout |
| 3 | Override del tope en 2, generar 3 veces | La tercera corta **sin llamar a la API** |
| 4 | Comprar $100/20 | `credit_balance` = 20 → generar → 19, y la fila queda `paid_with = 'credit'` |
| 5 | `stripe events resend evt_…` de esa compra | **No** se acreditan 20 otra vez |
| 6 | `stripe trigger invoice.payment_failed` | `past_due` + `grace_until` a 5 días → el portal entra **con banner** |
| 7 | Adelantar `grace_until` a mano en SQL | Ahora manda a la pantalla de pago |
| 8 | `/api/reports/<id>/xlsx` con esa marca cortada | 404 |
| 9 | Cancelar desde el Customer Portal | `customer.subscription.deleted` → `canceled` → corte |
| 10 | `stripe trigger` de cada evento del switch | Ninguno responde 500 |

⚠️ El Customer Portal hay que habilitarlo una vez en el dashboard
(Settings → Billing → Customer portal), por separado en test y en live, o
`/api/billing/portal` falla con "No configuration provided".

---

## Lo que salió de las pruebas (2026-08-26, cuenta LIVE)

Se corrieron P1–P10 con dinero real ($300 de suscripción + $100 de recarga,
los dos reembolsados) sobre una marca desechable "PRUEBA STRIPE" con
`ai_generation_limit = 1` para llegar rápido al tope. Las otras marcas quedaron
`exempt` todo el tiempo y no se tocaron.

**Lo que funcionó a la primera:** el alta y el `billing_contact_user_id`; el
segundo miembro entrando gratis a la marca ya pagada; el corte del tope sin
llamar a la API; la acreditación de la recarga sacando los créditos del
`price_id` cobrado; el reparto plan → recarga con su `paid_with`; los tres
puntos de corte por impago (incluido el 404 del `.xlsx` por link directo);
la excepción de `/facturacion`; y el dueño sin cortarse.

**La idempotencia se probó por sus DOS candados**, no solo por el primero:

1. `stripe events resend evt_… --live` → el guard de `stripe_events` responde
   `duplicate:true` y no toca nada.
2. Un evento **con un `evt_` nuevo** cargando la MISMA checkout session (forjado
   y firmado con el `whsec_` local) → pasa el candado 1, corre el handler
   entero, y **el `unique` sobre `stripe_checkout_session_id` dentro de
   `apply_credit_purchase` evita el doble crédito**. Es el candado que importa:
   sin él, la acreditación dependería solo del log de eventos.

También se verificó en la base que ni `anon` ni `authenticated` pueden ejecutar
`apply_credit_purchase` ni `consume_client_credit`. **Ese `REVOKE` es lo que
sostiene la seguridad** — sin él, cualquiera con un JWT se regala créditos.

### Tres bugs que solo aparecen probando

Los tres estaban en el mismo punto ciego: la migración a Fase E tocó `/generar`
y Competencia, y se salteó la rama de **herramientas del guion** — en la UI y en
el servidor.

| Bug | Síntoma | Arreglo |
|---|---|---|
| La UI de `/generar` y `ScriptToolsPanel` bloqueaba con `remaining <= 0` sin mirar el saldo | Un cliente que acaba de pagar $100 se queda con el botón muerto | `blocked = planAgotado && creditBalance <= 0`, igual que el servidor |
| `page.tsx` pasaba `client.aiGenerationLimit` crudo como tope de la UI | Una marca sin override anunciaría "ilimitadas" mientras el servidor corta a las 40 | Pasar el tope **efectivo** de `getGenerationState` |
| Portadas y Copy Expert cerraban con `logAiGeneration` pelado | Pasado el cupo del ciclo salían **gratis** y `paid_with` mentía | Cerrar con `settleGeneration` |
| `syncSubscription` leía solo `subscription.cancel_at_period_end` | El cliente cancela y la app dice "Activa" durante todo el ciclo | `readCancelAtPeriodEnd` (OR con `cancel_at`) |

### Detalles del Customer Portal que conviene saber

- Cancela **al final del ciclo** por defecto. Para ver el camino de
  `customer.subscription.deleted` hay que cancelar **"Immediately"** desde el
  dashboard (la lista de Customers solo ofrece "Delete customer"; hay que entrar
  a la suscripción).
- El diálogo de cancelar ofrece reembolso: **"Last payment"** (completo) o
  **prorrateado**. Los eventos de refund y credit note caen en el `default` del
  switch del webhook — se registran y no hacen nada. Ninguno da 500.
- **La comisión de Stripe MX no vuelve en un reembolso** (~3.6% + $3). Es el
  costo de haber probado en live en vez de sandbox.

## Orden de encendido

La regla que gobierna todo: **la exención primero, el corte al final.**

| # | Qué | Riesgo | Verificación |
|---|---|---|---|
| **1** | Correr `0013` en Supabase. **Antes de cualquier deploy.** El código publicado no conoce estas tablas | **Cero** | `select count(*) from client_subscriptions where exempt` = número de marcas |
| **2** | Deploy del código de Fase E con `BILLING_ENFORCED=false` y sin claves de Stripe en producción. Todo exento ⇒ nada cambia para nadie | Bajo | El panel de cada marca muestra "Interna / cortesía"; los contadores dan los mismos números |
| **3** | Stripe en **modo test**, en local: productos, precios, `stripe listen`, y los 10 pasos de arriba | Bajo | Los 10 pasos, completos |
| **4** | Prender `BILLING_ENFORCED=true` **solo en local** y repetir los pasos 6, 7 y 8 | Bajo | El corte funciona y `/facturacion` sigue abierta |
| **5** | Claves **live** en Netlify: productos y precios en el dashboard live, endpoint del webhook registrado, Customer Portal habilitado. Quitarle la exención a **una sola marca de prueba tuya**, con tarjeta real | Medio — primer dinero real | Cobro de $300, recibo de Stripe, y cancelar desde el Customer Portal |
| **6** | `BILLING_ENFORCED=true` en producción y quitar la exención **una marca por vez**, avisándole antes a cada cliente. Las marcas propias quedan exentas para siempre | Controlado | Cada marca pasa por Checkout antes de que le toque el corte |

Las etapas 1 a 4 son invisibles para los clientes actuales. La única con dinero
real es la 5, y toca una sola marca propia.

---

## Cabos sueltos

- **Sin CFDI.** Si un cliente lo pide, hoy se hace por fuera. Integrarlo sería
  Facturama o similar (Stripe no timbra) más los campos fiscales en el Checkout.
- **`stripe_events` crece para siempre.** Son unas pocas miles de filas al año;
  si algún día molesta, se vacía el `payload` con un update — no lo lee ningún
  código.
- **Sin OXXO ni SPEI.** Sumarlos exige manejar
  `checkout.session.async_payment_succeeded` y estados de pago pendiente.
- **Emails.** Sigue pendiente desde la etapa 3: el link de invitación se copia a
  mano. Stripe sí manda sus propios recibos.
