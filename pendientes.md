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
- [x] **4. Posts de autoridad** (migración `0020`): nicho por cuenta en Competencia, tema por post en `classifyPost`, fuentes "Post de investigación" (números calculados en código, mínimo 10 reels) y "Contracorriente" en `/estrategia`, filtro de cifras inventadas (`maskInventedNumbers`)

## Siguiente

- [ ] **Datos para posts de investigación**: hoy hay 4 posts clasificados en toda la base. Ponerle nicho a las cuentas y transcribir + clasificar al menos 10 reels por nicho (Whisper cuesta por video). Probar el post de investigación de punta a punta contra la API cuando haya datos
- [ ] Generador de ideas: el modelo a veces inventa CASOS sin número ("esta clínica dejó de contestar y se llenó la agenda"); `maskInventedNumbers` no lo atrapa

- [ ] Revisor de ganchos: la versión mejorada a veces trae texto en pantalla de < 8 palabras (el modelo cuenta mal). Medirla en código igual que el original y avisarlo en la tarjeta

- [ ] **5. Esqueleto visible al adaptar** desde Competencia: gancho, en qué segundo cae el primer problema, cómo retiene, cómo cierra + campo "tu interpretación" antes de reescribir
- [ ] **6. Multiplicar lo que funcionó (circuito cerrado)**: métricas reales de cada pieza → detectar las que funcionaron → 3 variaciones. Se implementa sí o sí
- [ ] **Mudanza a Vercel** (decidido 2026-10-02, justo ANTES del punto 7; Paco ya tiene Vercel Pro). Motivo: el límite de ~26s de las Functions de Netlify (Gemini sobre video lo va a rozar; también "Mi semana" de 7 y Sonnet en rutas síncronas). A rehacer: 3 crons diarios → Vercel Cron, `scrape-competencia-background` (Background Function de 15 min) → función con `maxDuration` alto o cola, DNS de `guionizator.pacocuevasia.com`, webhook de Stripe, redirect de Instagram, URLs de Supabase Auth, env vars, y las reglas de deploy de CLAUDE.md + memoria. Medir antes con un deploy de preview (región de la función junto a Supabase us-west-2)
- [ ] **7. Análisis de gancho visual con Gemini** (solo estudio, solo los videos que Paco elija). **Solo el gancho, nunca el reel completo**: recortar con `start_offset`/`end_offset` a los primeros 3-6 s (máx 10 s en casos raros), con más cuadros por segundo. Evalúa texto en pantalla, qué se ve en el primer segundo, dónde vive el gancho (texto/visual/verbal), cámara fija, si se entiende sin audio. Video desde `competitor_posts.video_url` (link firmado de Apify; si murió, `fetchFreshVideoUrl`). `GEMINI_API_KEY` ya está como placeholder en `.env.local` — Paco la crea en Google AI Studio
- [ ] **Portal**: llevar al cliente solo lo que no abruma (ver propuesta en la conversación del 2026-10-02): "Tu estrategia" + test, revisor de ganchos, ganchos de 3 capas en sus guiones, "Ideas para mi semana"
- [ ] **App Review de Meta** (al terminar esta etapa del proyecto, para vender la app): verificación del negocio + acceso avanzado a los permisos de Instagram, para que cada cliente conecte su cuenta con un clic. Hoy Instagram está EN PAUSA en el portal
- [ ] "Mi semana" de 7 piezas: hoy topado en 5 por el límite de Netlify (~26s). Para 7 hay que partir en dos llamadas o mover a background function
- [ ] Precio: **$300 MXN/mes para todos** (decisión 2026-10-02) — revisar textos de venta/landing que digan otra cosa
- [ ] "Mi semana" más rápida (hoy Haiku 4.5, ~18s para 5): opciones sin implementar — recortar la salida, mostrar las ideas mientras se generan (streaming), o una llamada corta que arma el arco de la semana + una llamada en paralelo por día
- [ ] **Al final — Auditoría de lo que sobra**: al terminar todo lo anterior, revisar qué secciones quedaron obsoletas (candidatos ya vistos: "Sugerir del baúl" vs ganchos de 3 capas, categorías viejas del baúl como "pregunta impactante", Tendencias vs fuente de noticias de /estrategia, Prompts, Instagram en pausa)

## Después (no prioritario)

- [ ] **Ideas y recordatorios de la semana por WhatsApp** (sinergia con FLUIA). Quizá nunca; quizá sí
- [ ] **Modo agencia / marca blanca** del portal para que agencias lo revendan. Cuando haya al menos 10 clientes en la plataforma
