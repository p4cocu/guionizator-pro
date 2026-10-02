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
- [ ] **4. Posts de autoridad**: estructuras "contracorriente" e "investigación". La de investigación usa los datos de Competencia ("analicé N reels de clínicas dentales…")
- [ ] **5. Esqueleto visible al adaptar** desde Competencia: gancho, en qué segundo cae el primer problema, cómo retiene, cómo cierra + campo "tu interpretación" antes de reescribir
- [ ] **6. Multiplicar lo que funcionó**: desde una pieza del calendario con buenas métricas, 3 variaciones
- [ ] **7. Análisis de gancho visual con Gemini** (solo estudio, solo los videos que Paco elija): texto en pantalla, primer segundo, portador del gancho, cámara fija, se entiende sin audio. Requiere `GEMINI_API_KEY`
- [ ] **Portal**: llevar al cliente solo lo que no abruma (ver propuesta en la conversación del 2026-10-02): "Tu estrategia" + test, revisor de ganchos, ganchos de 3 capas en sus guiones, "Ideas para mi semana"
- [ ] **Instagram de los clientes**: decidir camino (App Review de Meta / testers / sin conexión). Hoy está EN PAUSA en el portal
- [ ] "Mi semana" de 7 piezas: hoy topado en 5 por el límite de Netlify (~26s). Para 7 hay que partir en dos llamadas o mover a background function
- [ ] Precio: **$300 MXN/mes para todos** (decisión 2026-10-02) — revisar textos de venta/landing que digan otra cosa
- [ ] **Diferenciadores vs Gaper** (app de Andrea): elegir cuáles construir (lista en la conversación del 2026-10-02)
- [ ] **Auditoría de lo que sobra**: al terminar todo lo anterior, revisar qué secciones quedaron obsoletas (candidatos ya vistos: "Sugerir del baúl" vs ganchos de 3 capas, categorías viejas del baúl como "pregunta impactante", Tendencias vs fuente de noticias de /estrategia, Prompts, Instagram en pausa)
