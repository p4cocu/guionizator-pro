# Pendientes — mejoras con el método Andrea Estratega

Checklist acordado el 2026-10-02. Rama de trabajo: `feat/estrategia-contenido`.

## Hecho

- [x] `/estrategia`: cliente ideal + 5 pilares por marca, generador de ideas desde 5 fuentes, banco de ideas (migración `0017`)
- [x] Semilla con la estrategia de FLUIA (Freshman) y pacocuevas.ia (Sophomore), cargada en la base
- [x] **1. Ganchos de 3 capas** en el guion: texto en pantalla + visual del primer segundo + frase hablada, 3 opciones con checklist de 7 criterios (migración `0018`)
- [x] Cerebro corregido: el gancho abre declarando, sin preguntas débiles
- [x] **2. Revisor de ganchos**: en `/ganchos` y botón "Revisar" en cada gancho del guion, con versión mejorada
- [x] **3. Niveles de consciencia + propósito + formato** en `/estrategia`, etapa de la cuenta (Freshman/Sophomore/Junior/Senior), pilares etiquetados Problema / Solución única / Resultado, y **"Mi semana"** (3-5 piezas, una por nivel) con "Agendar en el calendario"

- [x] **Deploy** de la rama (2026-10-02), probado en el navegador: Mi semana, revisor de ganchos, 3 ganchos de 3 capas. De paso: el revisor inventaba estadísticas ("el 40% de…") en la versión mejorada — corregido en `HOOK_RULES_PROMPT`
- [x] **Test de estrategia** (migración `0019`): sección "Tu estrategia" en el portal (reemplaza directo, gratis) + "Hacer el test" en `/estrategia`
- [x] **5. Esqueleto visible al adaptar** (migración `0021`): paso previo en "Adaptar a mi marca" de `/competencia` con gancho, primer problema (segundo estimado en código), cómo retiene, cómo cierra y el esqueleto en piezas + "Tu interpretación"; viaja a la adaptación completa y a la ligera. Se guarda por post (lo reusa el punto 6)
- [x] **Deploy del punto 5** (2026-10-02), probado en el navegador: esqueleto, "Rehacer", reel sin transcripción y esqueleto + interpretación en el brief de la completa
- [x] **6. Multiplicar lo que funcionó** (migración `0022`): en `/guiones/[id]` de un guion publicado, panel "Rendimiento en Instagram" — se vincula a su post, guarda métricas + mediana de la cuenta (últimos 50 posts del último año) y el código decide si funcionó (≥ 1.5× en vistas/alcance o en compartidos+guardados). "✦ Multiplicar" saca el esqueleto de la pieza y propone 3 variaciones (otra línea narrativa / otro gancho / otro formato) con gancho de 3 capas; "Desarrollar" abre `/guiones/nuevo`. En Hechos: badge 🔥, métricas, "Actualizar métricas" y filtro "Solo lo que funcionó". Probado contra la API real (~13 s)
- [x] **4. Posts de autoridad** (migración `0020`): nicho por cuenta en Competencia, tema por post en `classifyPost`, fuentes "Post de investigación" (números calculados en código, mínimo 10 reels) y "Contracorriente" en `/estrategia`, filtro de cifras inventadas (`maskInventedNumbers`)
- [x] **7. Gancho visual con Gemini** (migración `0023`): botón "👁 Gancho visual" en cada reel de `/competencia` (3 / 5 / 10 s, default 5) y bloque opcional en la anatomía de Adaptar que viaja a las dos adaptaciones. Gemini 3.8 Flash mira solo el inicio (`endOffset` + más fps): 3 capas, dónde vive, cámara, sin audio, 7 criterios y la jugada. Probado contra la API con 3 reels (~6-7 s inline, ~41 s por Files API). `GEMINI_API_KEY` cargada en Vercel. Probado en el navegador (modal + bloque en Adaptar)
- [x] **"Mi semana" de 7 e `IDEAS_COUNT` 6** (2026-10-02, tras la mudanza): 7 piezas ~25-28 s, 6 ideas ~20-22 s medidos contra la API con FLUIA y pacocuevas.ia; `maxTokens` 5000, `maxDuration` 120. Probado en el navegador: 7 tarjetas lun→dom y "Agendar" inserta las 7. De paso: aviso de largo del texto en pantalla medido en código en toda tarjeta de gancho, y regla de tuteo/plazos reforzada en el prompt
- [x] **Mudanza a Vercel** (2026-10-02): proyecto `guionizator-pro` (pdx1), 3 crons en `app/api/cron/*` con `CRON_SECRET`, scrape con `after()` (31 s medido), CNAME de cPanel → Vercel, SSL, variables cargadas. Probado con curl y en el navegador (Mi semana 18.3 s, scrape real, crons a mano). Detalle en CLAUDE.md → "Mudanza a Vercel"

## Siguiente

- [ ] `/publicar` (Instagram Etapa B, stand-by): Vercel corta los cuerpos en 4.5 MB → si se retoma, subir directo a Supabase Storage con URL firmada
- [ ] **Datos para posts de investigación**: hoy hay 4 posts clasificados en toda la base. Ponerle nicho a las cuentas y transcribir + clasificar al menos 10 reels por nicho (Whisper cuesta por video). Probar el post de investigación de punta a punta contra la API cuando haya datos
- [ ] Generador de ideas: el modelo a veces inventa CASOS sin número ("esta clínica dejó de contestar y se llenó la agenda"); `maskInventedNumbers` no lo atrapa
- [ ] Generador de ideas (visto probando la semana de 7): sigue colando **plazos** ("en 2 días", "diagnóstico de 7 días", "en 3 minutos") y **casos con nombre** ("la clínica de Marina") pese a la regla. Y `maskInventedNumbers` deja pasar cifras que coinciden por casualidad con otro número del contexto ("50 veces" porque el avatar dice "5–50 personas"; "20 min" por el "20%" de un pilar)

- [x] Revisor de ganchos: la versión mejorada a veces trae texto en pantalla de < 8 palabras — resuelto con el aviso de largo medido en código de `Layers` (2026-10-02)

- [ ] Esqueleto: "Cómo retiene" a veces arrastra un dato del competidor ("30 segundos", una muletilla citada) pese a la regla. Las piezas y el gancho ya salen limpios. Probado con 3 reels el 2026-10-02
- [ ] **Umbral de "funcionó" editable** (hoy fijo en 1.5× en `WORKED_THRESHOLD`, `lib/multiply/metrics.ts`): poder cambiarlo desde el panel de Rendimiento o desde ajustes. Pedido de Paco 2026-10-02
- [ ] **Multiplicar posts de Instagram que no nacieron en la app** (decidido 2026-10-02: después): hoy solo se multiplica un guion publicado vinculado a su post. Para un post sin guion haría falta transcribirlo con Whisper (cuesta por video) desde `media_url`
- [ ] Rendimiento: un guion solo se vincula a posts de la cuenta de SU marca. Si un reel de FLUIA se publicó en @pacocuevas.ia, no se puede medir (caso visto con el de TIMKODA)
- [ ] **Portal**: llevar al cliente solo lo que no abruma (ver propuesta en la conversación del 2026-10-02): "Tu estrategia" + test, revisor de ganchos, ganchos de 3 capas en sus guiones, "Ideas para mi semana"
- [ ] **App Review de Meta** (al terminar esta etapa del proyecto, para vender la app): verificación del negocio + acceso avanzado a los permisos de Instagram, para que cada cliente conecte su cuenta con un clic. Hoy Instagram está EN PAUSA en el portal
- [ ] Precio: **$300 MXN/mes para todos** (decisión 2026-10-02) — revisar textos de venta/landing que digan otra cosa
- [ ] "Mi semana" más rápida (hoy Haiku 4.5, ~18s para 5): opciones sin implementar — recortar la salida, mostrar las ideas mientras se generan (streaming), o una llamada corta que arma el arco de la semana + una llamada en paralelo por día
- [ ] **Al final — Auditoría de lo que sobra**: al terminar todo lo anterior, revisar qué secciones quedaron obsoletas (candidatos ya vistos: "Sugerir del baúl" vs ganchos de 3 capas, categorías viejas del baúl como "pregunta impactante", Tendencias vs fuente de noticias de /estrategia, Prompts, Instagram en pausa)

## Pendientes de revisión de la mudanza a Vercel (al terminar todo)

Decidido 2026-10-02: se revisan al final, después de las implementaciones.

- [ ] **Stripe**: Developers → Webhooks → endpoint `https://guionizator.pacocuevasia.com/api/stripe/webhook` → "Resend" de un evento reciente. Tiene que dar **200**: es lo único que confirma que el `STRIPE_WEBHOOK_SECRET` cargado en Vercel es el correcto
- [ ] **Instagram**: conectar o renovar un token desde el perfil de un cliente
- [ ] **Contraseña**: "¿Olvidaste tu contraseña?" desde `/login` (llega el mail y `/nueva-contrasena` funciona)
- [ ] **Portal**: entrar con una cuenta de cliente
- [ ] Si todo pasa: **apagar Netlify** — borrar `netlify/functions`, `netlify.toml`, `@netlify/plugin-nextjs`, `/.netlify/functions` de `PUBLIC_PATHS`, la rama de `SCRAPE_FN_SECRET` en `startScrape`, y pausar el sitio de Netlify

## Después (no prioritario)

- [ ] **Ideas y recordatorios de la semana por WhatsApp** (sinergia con FLUIA). Quizá nunca; quizá sí
- [ ] **Modo agencia / marca blanca** del portal para que agencias lo revendan. Cuando haya al menos 10 clientes en la plataforma
