# Pendientes — mejoras con el método Andrea Estratega

Checklist acordado el 2026-10-02. Rama de trabajo: `feat/estrategia-contenido`.

## Hecho

- [x] `/estrategia`: cliente ideal + 5 pilares por marca, generador de ideas desde 5 fuentes, banco de ideas (migración `0017`)
- [x] Semilla con la estrategia de FLUIA (Freshman) y pacocuevas.ia (Sophomore), cargada en la base
- [x] **1. Ganchos de 3 capas** en el guion: texto en pantalla + visual del primer segundo + frase hablada, 3 opciones con checklist de 7 criterios (migración `0018`)
- [x] Cerebro corregido: el gancho abre declarando, sin preguntas débiles
- [x] **2. Revisor de ganchos**: en `/ganchos` y botón "Revisar" en cada gancho del guion, con versión mejorada
- [x] **3. Niveles de consciencia + propósito + formato** en `/estrategia`, etapa de la cuenta (Freshman/Sophomore/Junior/Senior), pilares etiquetados Problema / Solución única / Resultado, y **"Mi semana"** (3-5 piezas, una por nivel) con "Agendar en el calendario"

## Siguiente

- [ ] **Deploy** de la rama (migraciones 0017 y 0018 ya aplicadas en Supabase)
- [ ] **Test de estrategia para clientes**: cuestionario que llena cliente ideal, pilares (con etiqueta de Andrea) y determina la etapa de la cuenta. Vive en el portal.
- [ ] **4. Posts de autoridad**: estructuras "contracorriente" e "investigación". La de investigación usa los datos de Competencia ("analicé N reels de clínicas dentales…"). Para que la afirmación sea verdad hay que saber de qué trata cada post: (a) **nicho de la cuenta** — etiqueta en `competitors` ("dentistas", "creadores de IA"); con eso "analicé 80 reels de cuentas de dentistas" es cierto aunque cada reel hable de otra cosa, y el hallazgo es de PATRONES (ganchos, formatos, estructuras), no de tema; (b) **tema del post** — `classifyPost` suma un `topic` corto a partir de la transcripción (misma llamada, sin costo extra); para una afirmación por tema ("analicé 25 reels sobre recordatorios de citas") se filtra por tema y se muestra cuántos hay. Si hay pocos (< 10), la pantalla lo dice y no se arma el post
- [ ] **5. Esqueleto visible al adaptar** desde Competencia: gancho, en qué segundo cae el primer problema, cómo retiene, cómo cierra + campo "tu interpretación" antes de reescribir
- [ ] **6. Multiplicar lo que funcionó (circuito cerrado)**: métricas reales de cada pieza → detectar las que funcionaron → 3 variaciones. Se implementa sí o sí
- [ ] **7. Análisis de gancho visual con Gemini** (solo estudio, solo los videos que Paco elija). **Solo el gancho, nunca el reel completo**: recortar con `start_offset`/`end_offset` a los primeros 3-6 s (máx 10 s en casos raros), con más cuadros por segundo. Evalúa texto en pantalla, qué se ve en el primer segundo, dónde vive el gancho (texto/visual/verbal), cámara fija, si se entiende sin audio. Video desde `competitor_posts.video_url` (link firmado de Apify; si murió, `fetchFreshVideoUrl`). `GEMINI_API_KEY` ya está como placeholder en `.env.local` — Paco la crea en Google AI Studio
- [ ] **Portal**: llevar al cliente solo lo que no abruma (ver propuesta en la conversación del 2026-10-02): "Tu estrategia" + test, revisor de ganchos, ganchos de 3 capas en sus guiones, "Ideas para mi semana"
- [ ] **App Review de Meta** (al terminar esta etapa del proyecto, para vender la app): verificación del negocio + acceso avanzado a los permisos de Instagram, para que cada cliente conecte su cuenta con un clic. Hoy Instagram está EN PAUSA en el portal
- [ ] "Mi semana" de 7 piezas: hoy topado en 5 por el límite de Netlify (~26s). Para 7 hay que partir en dos llamadas o mover a background function
- [ ] Precio: **$300 MXN/mes para todos** (decisión 2026-10-02) — revisar textos de venta/landing que digan otra cosa
- [ ] "Mi semana" más rápida (hoy Haiku 4.5, ~18s para 5): opciones sin implementar — recortar la salida, mostrar las ideas mientras se generan (streaming), o una llamada corta que arma el arco de la semana + una llamada en paralelo por día

## Después (no prioritario)

- [ ] **Ideas y recordatorios de la semana por WhatsApp** (sinergia con FLUIA). Quizá nunca; quizá sí
- [ ] **Modo agencia / marca blanca** del portal para que agencias lo revendan. Cuando haya al menos 10 clientes en la plataforma
- [ ] **Auditoría de lo que sobra**: al terminar todo lo anterior, revisar qué secciones quedaron obsoletas (candidatos ya vistos: "Sugerir del baúl" vs ganchos de 3 capas, categorías viejas del baúl como "pregunta impactante", Tendencias vs fuente de noticias de /estrategia, Prompts, Instagram en pausa)
