# Investigación Deep: Todos los Modelos de Generación de Imagen en FAL.ai
## Matriz de Decisión Comparativa — Junio 2026

> **Objetivo:** Guía técnica exhaustiva para seleccionar el modelo correcto en FAL.ai según tipo de escena, calidad requerida y presupuesto. Basado en investigación live de endpoints, precios oficiales y benchmarks de la comunidad.

---

## Ecosistema FAL.ai — Contexto General

FAL.ai es una plataforma de inferencia de modelos generativos que alberga **más de 1,000 modelos** con una arquitectura API unificada. Características clave del ecosistema:

- **Modelo de cobro:** Prepago en créditos. Billing puede ser por imagen, por megapíxel, o por segundo de GPU según el modelo.
- **SDK unificado:** `fal-ai/client` (Python, JS/TS). La misma lógica de integración funciona para todos los modelos.
- **Sin costo fijo:** No hay suscripciones obligatorias para uso API. Solo pagas por lo que generates.
- **Compute vs Serverless:** FAL Serverless = pay-per-use estándar. FAL Compute = clusters dedicados con pricing por hora (para entrenamiento o volumen masivo).

---

## BLOQUE 1: FAMILIA FLUX (Black Forest Labs)

La familia más importante del ecosistema FAL.ai. Arquitectura basada en Flow Matching con encoder de texto T5 y transformador DiT. El estándar industrial en 2025-2026.

### 1.1 FLUX.1 Schnell

| Campo | Detalle |
|:------|:--------|
| **Nombre exacto** | FLUX.1 [schnell] |
| **ID de API** | `fal-ai/flux/schnell` |
| **Arquitectura** | Flow Matching + T5 encoder + DiT (12B params) — versión distilada |
| **Licencia** | Apache 2.0 (Open Weights) |

**Fortalezas:**
- ⚡ **La más rápida** de la familia: 1–4 inference steps. ~1-2 segundos en FAL
- Ideal para prototipado masivo, iteración rápida de conceptos
- Excelente relación calidad-velocidad para contenido digital general
- Muy buena para ilustraciones limpias y composiciones generales

**Debilidades:**
- Menos detalle fotorealista que Dev o Pro
- Textos dentro de imágenes son inconsistentes
- En escenas muy complejas produce artefactos sutiles
- No recomendada para fotografía de producto profesional

**Consistencia de personaje:** ⭐⭐⭐ (Baja sin LoRA). Solo con seed fijo mantiene cierta coherencia superficial.

**Costos:**
| Resolución | Costo aprox. |
|:-----------|:------------|
| 512×512 (0.26 MP) | ~$0.001 |
| 1024×1024 (1 MP) | ~$0.003 |
| 1024×1536 (1.57 MP) | ~$0.005 |

**Velocidad:** 1–3 segundos (resolución 1024×1024)

**Image-to-Image:** ✅ Disponible vía `fal-ai/flux/dev/image-to-image` (el mismo endpoint aplica con variante). Parámetro `strength` 0–1.

**Style Reference:** ⚠️ No nativo en Schnell. Requiere workflow con LoRA o ControlNet.

**Aspect Ratios Soportados:** `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `21:9`, `9:21`, y dimensiones personalizadas.

---

### 1.2 FLUX.1 Dev

| Campo | Detalle |
|:------|:--------|
| **Nombre exacto** | FLUX.1 [dev] |
| **ID de API** | `fal-ai/flux/dev` |
| **Arquitectura** | Flow Matching + T5 encoder + DiT (12B params) — versión completa |
| **Licencia** | Open Weights (no comercial sin licencia) |

**Fortalezas:**
- 🏆 **El workhorse del ecosistema**: calidad 90-95% vs Pro a 30-40% del costo
- Soporte nativo de LoRA para consistencia de personaje
- Compatible con ControlNet (estructuras, poses, profundidad)
- Mejor manejo de composiciones complejas que Schnell
- Calidad fotorealista muy sólida en retratos, producto y arquitectura
- Excelente para pipelines de ComfyUI y workflows avanzados

**Debilidades:**
- Más lento que Schnell (20–50 steps necesarios)
- Textos dentro de imagen: bueno, no perfecto
- No soporta negative prompts (usar framing positivo)
- No soporta syntax de pesos `(palabra:1.2)` — es SDXL

**Consistencia de personaje:** ⭐⭐⭐⭐ (Alta con LoRA). Con `fal-ai/flux-lora` + trigger word = consistencia de personaje sólida entre generaciones.

**Costos:**
| Resolución | Costo aprox. |
|:-----------|:------------|
| 512×512 | ~$0.003 |
| 1024×1024 | ~$0.008–0.010 |
| 1024×1536 | ~$0.012–0.015 |

**Velocidad:** 5–15 segundos (20–50 steps, 1024×1024)

**Image-to-Image:** ✅ Endpoint dedicado: `fal-ai/flux/dev/image-to-image`. Parámetros: `image_url`, `strength` (default 0.85; >0.9 = alta creatividad, <0.5 = preserva estructura)

**Style Reference:** ✅ Con LoRA entrenado en el estilo de referencia.

**Aspect Ratios:** Igual que Schnell. Además soporta resoluciones altas personalizadas.

**Parámetros clave de API:**
```json
{
  "prompt": "...",
  "image_size": "landscape_4_3",
  "num_inference_steps": 28,
  "guidance_scale": 3.5,
  "num_images": 1,
  "seed": 42,
  "loras": [{"path": "url_del_lora", "scale": 0.8}]
}
```

---

### 1.3 FLUX Pro (v1, v1.1, v1.1-ultra)

| Campo | Detalle |
|:------|:--------|
| **Nombre exacto** | FLUX.1 [pro] / FLUX 1.1 [pro] / FLUX 1.1 [pro] ultra |
| **ID de API** | `fal-ai/flux-pro` / `fal-ai/flux-pro/v1.1` / `fal-ai/flux-pro/v1.1-ultra` |
| **Arquitectura** | Flow Matching DiT 12B (API-only, pesos cerrados) |
| **Licencia** | Propietaria / API comercial |

**Fortalezas del Ultra:**
- 🥇 **La máxima calidad de la familia Flux**: 4 megapíxeles nativos (2K) sin upscaling
- Modo **"Raw"**: simula fotografía analógica con alta naturalidad, grain y skin tones impresionantes
- Mejor manejo de iluminación compleja y microdetalles
- Benchmark Top 1–3 en Elo humano en la mayoría de evaluaciones 2025
- Generación en <10 segundos a 4MP
- Excelente para retrato editorial, cinematografía, y fotografía de producto luxury

**Debilidades:**
- El más caro de la familia
- API-only: sin acceso a pesos, sin LoRA
- Menos flexible para workflows de control (sin ControlNet)
- Textos dentro de imagen: bueno pero Recraft o Ideogram lo superan

**Consistencia de personaje:** ⭐⭐⭐ (Media). Sin LoRA, la consistencia entre generaciones es estadística, no garantizada. Mejor con seed fijo.

**Costos:**
| Versión | Resolución | Costo |
|:--------|:-----------|:------|
| v1 (Pro) | 1MP | ~$0.05/imagen |
| v1.1 (Pro) | 1MP | ~$0.05/imagen |
| v1.1-ultra | 4MP (2K) | **$0.06/imagen** |

**Velocidad:**
- Pro v1/v1.1: ~4–6 segundos
- Pro Ultra: ~8–10 segundos (a 4MP)

**Image-to-Image:** ⚠️ Limitado. El Ultra tiene modo `image_prompt_strength` para incorporar referencia visual.

**Style Reference:** ⚠️ Solo vía `image_prompt` (ControlNet-style influence). No LoRA.

**Aspect Ratios:** Todos los estándar + dimensiones personalizadas hasta 2K en Ultra.

---

### 1.4 FLUX.1 Kontext (Edición Contextual)

| Campo | Detalle |
|:------|:--------|
| **Nombre exacto** | FLUX.1 Kontext [pro/max/dev] |
| **ID de API** | `fal-ai/flux/kontext-pro` / `fal-ai/flux/kontext-max` / `fal-ai/flux/kontext-dev` |
| **Arquitectura** | Multimodal Flow Model — diseñado para edición in-context |
| **Licencia** | Kontext-Pro/Max: API comercial; Dev: Open |

**Fortalezas:**
- 🎯 **La mejor herramienta para EDICIÓN contextual de imágenes** en el ecosistema
- Preserva personajes, outfits y estilos visuales en escenas completamente distintas
- Permite: cambio de fondo, cambio de ropa, cambio de estilo artístico, edición de texto en imagen
- Soporte multimodal: texto + imagen de referencia como input
- **Consistencia de personaje clase A**: el mejor de FAL para mantener un personaje a través de escenas

**Debilidades:**
- No es un modelo de text-to-image puro; necesita imagen base para edición
- Más costoso que Dev para generación pura
- Kontext-dev puede tener mayor latencia

**Consistencia de personaje:** ⭐⭐⭐⭐⭐ (La más alta del ecosistema). Diseñado explícitamente para este caso de uso.

**Costos:** (aprox, verificar en fal.ai)
- Kontext-Pro: ~$0.04–0.06/imagen
- Kontext-Max: ~$0.06–0.08/imagen

**Velocidad:** 5–15 segundos según variante y complejidad de la edición.

**Image-to-Image:** ✅ **Es su función principal**. Input: `image_url` + prompt de edición.

**Style Reference:** ✅ Nativo y principal caso de uso.

---

### 1.5 FLUX con LoRA

| Campo | Detalle |
|:------|:--------|
| **ID Inferencia** | `fal-ai/flux-lora` |
| **ID Entrenamiento** | `fal-ai/flux-lora-fast-training` |

**Caso de uso:** Personaje consistente entre generaciones, style locking, brand character.

**Parámetros de entrenamiento:**
- Dataset mínimo: 10–15 imágenes de referencia
- Tiempo de entrenamiento: 10–30 minutos en FAL
- Trigger word: usar palabras únicas (ej. `TOK`, `SBJX`, nombre inventado)

**Costo de entrenamiento:** ~$1–3 por run de entrenamiento (varía según dataset y steps)

**Restricción crítica:** Trigger word debe ser inusual. No usar palabras comunes que interfieran con tokens del modelo base.

---

## BLOQUE 2: FAMILIA STABLE DIFFUSION

### 2.1 Stable Diffusion 3.5 Large

| Campo | Detalle |
|:------|:--------|
| **Nombre exacto** | Stable Diffusion 3.5 Large |
| **ID de API** | `fal-ai/stable-diffusion-v35-large` |
| **Arquitectura** | Multimodal Diffusion Transformer (MMDiT) — 8.1B parámetros |
| **Licencia** | Stability AI Community License (comercial <$1M revenue, luego enterprise) |

**Fortalezas:**
- 🧩 **Mejor adherencia a prompts complejos multi-elemento** de la familia SD
- Arquitectura MMDiT con QK-normalization = mayor estabilidad de entrenamiento
- Soporte de LoRA, ControlNet y fine-tuning personalizado
- Open weights: deployable en hardware propio
- Excelente para ilustraciones complejas con múltiples elementos
- Buena calidad en texto dentro de imagen (mejorado vs SD3)

**Debilidades:**
- Requiere más expertise técnico para resultados óptimos
- Más lento que variantes turbo
- Sin diseño nativo para vectores o design-first
- Photorealism inferior a Flux Pro o Imagen

**Consistencia de personaje:** ⭐⭐⭐⭐ (Alta con LoRA y ControlNet)

**Costos:**
| Resolución | Costo aprox. |
|:-----------|:------------|
| 1024×1024 | ~$0.007–0.012 |

**Velocidad:** 10–20 segundos (1024×1024, 30-50 steps)

**Image-to-Image:** ✅ Soporte nativo vía `strength` parameter.

**Style Reference:** ✅ Con IP-Adapter o LoRA de estilo.

---

### 2.2 Stable Diffusion 3.5 Large Turbo

| Campo | Detalle |
|:------|:--------|
| **ID de API** | `fal-ai/stable-diffusion-v35-large-turbo` |
| **Arquitectura** | SD 3.5 Large distilado con ADD (Adversarial Diffusion Distillation) |

**Fortalezas:**
- ⚡ 4 inference steps = muy rápido (~3–5 segundos)
- Misma calidad base que Large a una fracción del tiempo
- Ideal para pipelines de alto volumen donde SD3.5 es el modelo elegido

**Debilidades:**
- Pérdida de detalle finos vs el Large full
- Textos en imagen: más inconsistente
- Menos control en composiciones muy complejas

**Costos:** ~$0.004–0.007/imagen (resolución estándar)

**Velocidad:** 3–5 segundos

---

## BLOQUE 3: MODELOS ESPECIALIZADOS / PROPIETARIOS

### 3.1 Recraft V3 / V4

| Campo | Detalle |
|:------|:--------|
| **Nombre exacto** | Recraft V3 / Recraft V4 / Recraft V4 Pro |
| **ID de API** | `fal-ai/recraft-v3` / `fal-ai/recraft-v4` |
| **Arquitectura** | Propietaria — Design-first multimodal |
| **Licencia** | Comercial (API) |

**Fortalezas:**
- 🎨 **MEJOR MODELO PARA DISEÑO Y BRAND ASSETS**
- Único con output vectorial nativo (SVG) además de raster
- Control preciso de posicionamiento de texto, manejo de texto largo
- Consistencia de estilo entre assets sin reentrenamiento
- Excelente para logos, UI/UX assets, infografías, sistemas de diseño
- Recraft V4 Pro: hasta resolución 2K+ para assets de impresión

**Debilidades:**
- No diseñado para fotografía hiperrealista de personas
- Curva de aprendizaje en su suite de herramientas de diseño
- Puede ser más lento en escenas fotográficas complejas
- Menos expressivo para arte generativo libre

**Consistencia de personaje:** ⭐⭐⭐⭐ (Alta para brand characters estilizados, no para humanos fotorealistas)

**Costos:**
| Versión | Costo |
|:--------|:------|
| V3 | ~$0.022/imagen |
| V4 | ~$0.04/imagen |
| V4 Pro (2K+) | ~$0.06–0.08/imagen |

**Velocidad:** 5–15 segundos según complejidad y resolución.

**Image-to-Image:** ✅ Con `strength` parameter.

**Style Reference:** ✅ Sistema de estilos propietario. Además acepta imagen de referencia de estilo.

**Aspect Ratios:** `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `2:1`, `1:2` + dimensiones custom (ej. `1024x1024`, `2048x2048`).

---

### 3.2 Ideogram V2 / V3

| Campo | Detalle |
|:------|:--------|
| **Nombre exacto** | Ideogram V2 / Ideogram V3 / Ideogram V3 Turbo |
| **ID de API** | `fal-ai/ideogram/v2` / `fal-ai/ideogram/v3` |
| **Arquitectura** | Propietaria — Typography-first multimodal |
| **Licencia** | Comercial (API) |

**Fortalezas:**
- 📝 **MEJOR MODELO PARA TEXTO DENTRO DE IMAGEN** del ecosistema
- Tipografía legible, integrada y estilizada de forma natural en imágenes
- Excelente para: posters, banners, logos, carátulas, mockups con texto
- Muy intuitivo para contenido de marketing con copy visible
- Calidad fotorealista sólida (no la mejor, pero sí muy buena)
- Modos: `TURBO` (veloz), `BALANCED`, `QUALITY`

**Debilidades:**
- Bias artístico que puede interferir en fotografía puramente hiperrealista
- Algunas funciones avanzadas detrás de suscripción
- Sin output vectorial
- Menos flexible que Flux para pipelines técnicos

**Consistencia de personaje:** ⭐⭐⭐ (Media). Funcional con Character Remix pero no al nivel de Kontext o LoRA.

**Costos:**
| Modo | Costo aprox. |
|:-----|:------------|
| V2 Turbo | ~$0.02/imagen |
| V3 Balanced | ~$0.04/imagen |
| V3 Quality | ~$0.06/imagen |

**Velocidad:**
- Turbo: 2–4 segundos
- Balanced: 5–8 segundos
- Quality: 10–20 segundos

**Image-to-Image:** ✅ Funciones Remix, Edit (inpainting), Character Remix.

**Style Reference:** ✅ `style_reference_images` parameter. También soporta modos de estilo predefinidos.

**Aspect Ratios:** `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `16:10`, y más.

---

### 3.3 Google Nano Banana 2 (Gemini Flash Image)

| Campo | Detalle |
|:------|:--------|
| **Nombre exacto** | Nano Banana 2 / Gemini 3.1 Flash Image |
| **ID de API** | `fal-ai/nano-banana-2` (verificar en fal.ai) |
| **Arquitectura** | Propietaria Google — Gemini multimodal con Flash inference |
| **Licencia** | Comercial (API via FAL) |

**Fortalezas:**
- 🔍 **Razonamiento espacial superior**: el modelo "piensa" la composición antes de renderizar
- Alta fidelidad + velocidad optimizada: 5–10 segundos
- Rendering preciso de texto dentro de imagen
- Consistencia de personajes entre imágenes
- Soporte multimodal: texto, imagen, y video como input
- Edición contextual: cambio de pose, eliminación de objetos, fondo
- Colores vibrantes y composiciones equilibradas

**Debilidades:**
- Menos customizable que modelos open-weights
- Sin acceso a LoRA o fine-tuning
- Fotorrealismo muy bueno pero diferente "feel" que Flux Pro Ultra

**Consistencia de personaje:** ⭐⭐⭐⭐ (Alta). Capacidades nativas de consistency entre generaciones.

**Costos:**
- ~$0.05–0.10/imagen (pricing varía; verificar en fal.ai)
- Nano Banana Pro: ~$0.12–0.15/imagen

**Velocidad:** 5–10 segundos

**Image-to-Image:** ✅ Soportado con imagen de referencia.

**Style Reference:** ✅ Nativo vía referencia visual en el input multimodal.

**Aspect Ratios:** Estándar completo. Múltiples presets.

---

### 3.4 Ideogram + Google Imagen 3 / Imagen 4

| Campo | Detalle |
|:------|:--------|
| **Nombre exacto** | Google Imagen 3 / Imagen 4 |
| **ID de API** | Verificar en fal.ai — `fal-ai/imagen3` o similar |
| **Arquitectura** | Propietaria Google — Cascaded Diffusion + T5 multimodal |
| **Licencia** | Comercial (API) |

**Fortalezas:**
- 📸 **Máximo fotorrealismo de Google**: "calidad primero"
- Captura de texturas finas, iluminación equilibrada, proporciones naturales
- Skin tones y detalles faciales de clase mundial
- Excelente para fotografía comercial de producto y lifestyle
- Imagen 4: calidad cinematográfica, el flagship de Google

**Debilidades:**
- Más lento que Nano Banana
- Mayor costo que Nano Banana
- Menos capacidades de edición multimodal vs Nano Banana

**Consistencia de personaje:** ⭐⭐⭐ (Media sin herramientas específicas)

**Costos:** ~$0.10–0.20/imagen (Imagen 4 en el rango más alto)

**Velocidad:** 10–20 segundos

---

### 3.5 Playground v2.5

| Campo | Detalle |
|:------|:--------|
| **Nombre exacto** | Playground v2.5 |
| **ID de API** | `fal-ai/playground-v25` |
| **Arquitectura** | SDXL-based con mejoras estéticas propietarias |
| **Licencia** | Open (con restricciones en algunas versiones) |

**Fortalezas:**
- 🎨 Alta calidad estética para arte general y lifestyle
- Paletas de color armoniosas y composiciones equilibradas
- Bueno para arte conceptual, fashion, portadas
- Costo competitivo

**Debilidades:**
- Arquitectura SDXL: menos potente que Flux para texto e hyper-realismo
- Menos soporte comunitario que Flux en 2025+
- No diseñado para diseño de producto técnico

**Consistencia de personaje:** ⭐⭐⭐ (Media con LoRA SDXL)

**Costos:** ~$0.005–0.010/imagen

**Velocidad:** 5–10 segundos

---

### 3.6 Kolors (Kuaishou)

| Campo | Detalle |
|:------|:--------|
| **Nombre exacto** | Kolors |
| **ID de API** | `fal-ai/kolors` |
| **Arquitectura** | Latent Diffusion con mejoras en skin y lighting propietarias |
| **Licencia** | Open Weights |

**Fortalezas:**
- 👤 **Destacado en skin textures y retratos fotorealistas**
- Iluminación natural excepcional
- Muy bueno para moda (Fashion/Virtual Try-On)
- Compatible con Virtual Try-On endpoint en FAL
- Prompt en inglés y chino (bilingual)
- Tonos de piel asiáticos especialmente bien representados

**Debilidades:**
- Menos versátil en estilos no-fotográficos
- Menor comunidad vs Flux para plugins/extensions
- Texto dentro de imagen: básico

**Consistencia de personaje:** ⭐⭐⭐⭐ (Alta para retratos y moda)

**Costos:** ~$0.005–0.012/imagen

**Velocidad:** 5–12 segundos

---

### 3.7 Aura Flow

| Campo | Detalle |
|:------|:--------|
| **Nombre exacto** | AuraFlow |
| **ID de API** | `fal-ai/aura-flow` |
| **Arquitectura** | Flow Matching — desarrollado por FAL.ai internamente |
| **Licencia** | Apache 2.0 |

**Fortalezas:**
- 🧠 **La mejor adherencia semántica a prompts complejos** de modelos open-source en FAL
- Arquitectura Flow-based con fuerte coherencia conceptual
- Excelente para composiciones multi-elemento intrincadas
- Open source: customizable y deployable en hardware propio
- Sin restricciones de licencia comercial

**Debilidades:**
- Fotorrealismo inferior a Flux Pro o Imagen
- Velocidad más lenta que Schnell o Turbo
- Menos soporte de LoRA que Flux

**Consistencia de personaje:** ⭐⭐⭐ (Media)

**Costos:** ~$0.005–0.012/imagen

**Velocidad:** 8–15 segundos

---

### 3.8 Seedream 4.5 / 5.0 (ByteDance)

| Campo | Detalle |
|:------|:--------|
| **Nombre exacto** | Seedream 4.5 / Seedream 5.0 Lite |
| **ID de API** | `fal-ai/seedream-4` o similar (verificar en fal.ai) |
| **Arquitectura** | Propietaria ByteDance — bilingual multimodal |
| **Licencia** | Comercial API |

**Fortalezas:**
- 📊 **Ranking Top 5** en benchmarks de calidad 2026 (pixazo.ai, melies.co)
- Resolución nativa 2K+ en v4+
- Tipografía excelente (comparable a Ideogram)
- Bilingual: inglés y chino nativo
- 4–8x más rápido que modelos estándar de su generación (optimización ByteDance)
- Calidad estética muy alta para marketing y commercial design

**Debilidades:**
- Sin acceso a pesos para fine-tuning
- Ecosistema de plugins menor
- Disponibilidad puede variar en FAL según región

**Consistencia de personaje:** ⭐⭐⭐ (Media-Alta)

**Costos:** ~$0.03/imagen

**Velocidad:** 3–8 segundos (optimizado)

---

### 3.9 Hyper SDXL / Fast SDXL

| Campo | Detalle |
|:------|:--------|
| **Nombre exacto** | Hyper SDXL / Fast SDXL |
| **ID de API** | `fal-ai/hyper-sdxl` / `fal-ai/fast-sdxl` |
| **Arquitectura** | SDXL distilado con técnicas de aceleración |
| **Licencia** | Apache 2.0 / Open |

**Fortalezas:**
- ⚡ Velocidad extrema: 1–4 steps, 1–3 segundos
- Muy económico para alto volumen
- Buena calidad para su velocidad
- Útil para thumbnails, variaciones rápidas, previews

**Debilidades:**
- Calidad inferior a Flux Schnell en la mayoría de métricas
- Arquitectura SDXL = limitaciones vs DiT moderno
- No recomendado para entregables finales de cliente

**Consistencia de personaje:** ⭐⭐ (Baja)

**Costos:** ~$0.003–0.006/imagen

**Velocidad:** 1–3 segundos

---

## BLOQUE 4: GPT IMAGE (OpenAI vía FAL)

### 4.1 GPT Image 1 / GPT Image 2

| Campo | Detalle |
|:------|:--------|
| **Nombre exacto** | GPT Image 1 / GPT Image 2 |
| **ID de API** | `fal-ai/gpt-image-1` o via OpenAI API (accesible en FAL) |
| **Arquitectura** | Propietaria OpenAI — Large multimodal + diffusion |
| **Licencia** | Comercial (API) |

**Fortalezas:**
- 📝 **Instrucción-following superior**: entiende prompts complejos en lenguaje natural mejor que casi cualquier modelo
- Texto dentro de imagen "pixel-perfect": el mejor junto a Ideogram
- Calidad fotográfica de studio quality muy sólida
- Excelente para fotografía de producto con instrucciones muy específicas
- Muy bueno para mockups con texto, posters, assets de marketing complejos

**Debilidades:**
- El más costoso del ecosistema
- Sin acceso a pesos, sin LoRA, sin fine-tuning
- Menos "artístico" en el sentido libre/generativo
- Moderación de contenido más estricta

**Consistencia de personaje:** ⭐⭐⭐ (Media). No diseñado para consistency de personaje entre sesiones.

**Costos:**
| Calidad | Resolución | Costo |
|:--------|:-----------|:------|
| Baja | 1024×1024 | ~$0.011 |
| Media | 1024×1024 | ~$0.042 |
| Alta | 1024×1024 | ~$0.167 |
| Alta | 1792×1024 | ~$0.211 |

**GPT Image 1 Mini:**
- Low: ~$0.005/imagen
- High: ~$0.052/imagen

**Velocidad:** 8–20 segundos según calidad

**Image-to-Image:** ✅ Edición e inpainting nativos.

**Style Reference:** ✅ Acepta imágenes de referencia en el prompt multimodal.

---

## BLOQUE 5: MODELOS DE NICHO Y ESPECIALIZADOS

### 5.1 OmniGen v1

| Campo | Detalle |
|:------|:--------|
| **ID de API** | `fal-ai/omnigen-v1` |
| **Arquitectura** | Unified generation model — multimodal |

**Caso de uso:** Generación unificada con instrucciones complejas de edición. Permite combinar múltiples imágenes de referencia en una sola generación.

**Fortalezas:** Muy flexible para compositing y tareas de síntesis multi-referencia.
**Debilidades:** No optimizado para fotorrealismo puro.

---

### 5.2 Stable Cascade

| Campo | Detalle |
|:------|:--------|
| **ID de API** | `fal-ai/stable-cascade` |
| **Arquitectura** | Würstchen architecture (eficiencia en espacio latente) |

**Fortalezas:** Muy eficiente en uso de memoria, buena calidad para su costo.
**Debilidades:** Menos calidad que SD 3.5 en tareas complejas.

---

## TABLA COMPARATIVA FINAL: SCORES POR CATEGORÍA

> Scoring 1–10. 10 = máximo. Para **Costo**: 10 = más económico. Para **Velocidad**: 10 = más rápido.

| Modelo | ID de API | Arquitectura | Realismo | Cinematografía | 3D/Ilustración | Producto | Personaje | Costo (10=barato) | Velocidad (10=rápido) | TOTAL |
|:-------|:----------|:-------------|:---------|:---------------|:---------------|:---------|:----------|:-----------------|:---------------------|:------|
| **Flux Schnell** | `fal-ai/flux/schnell` | Flow Match DiT | 7 | 6 | 7 | 6 | 3 | 9 | 10 | **48** |
| **Flux Dev** | `fal-ai/flux/dev` | Flow Match DiT | 8 | 8 | 8 | 8 | 7 | 8 | 7 | **60** |
| **Flux Pro Ultra** | `fal-ai/flux-pro/v1.1-ultra` | Flow Match DiT (closed) | 9 | 9 | 7 | 9 | 5 | 5 | 6 | **59** |
| **Flux Kontext** | `fal-ai/flux/kontext-pro` | Multimodal Flow | 8 | 8 | 7 | 8 | 10 | 5 | 7 | **63** |
| **SD 3.5 Large** | `fal-ai/stable-diffusion-v35-large` | MMDiT 8.1B | 7 | 7 | 9 | 7 | 7 | 8 | 5 | **60** |
| **SD 3.5 Turbo** | `fal-ai/stable-diffusion-v35-large-turbo` | MMDiT distilado | 6 | 6 | 8 | 6 | 5 | 9 | 9 | **58** |
| **Recraft V4** | `fal-ai/recraft-v4` | Propietaria design | 6 | 6 | 10 | 9 | 7 | 6 | 6 | **63** |
| **Ideogram V3** | `fal-ai/ideogram/v3` | Propietaria typo | 7 | 7 | 8 | 8 | 5 | 6 | 7 | **55** |
| **Nano Banana 2** | `fal-ai/nano-banana-2` | Gemini Flash | 8 | 8 | 7 | 8 | 8 | 5 | 8 | **62** |
| **Imagen 4** | `fal-ai/imagen4` | Google Cascaded | 10 | 9 | 6 | 9 | 5 | 3 | 4 | **55** |
| **GPT Image 1** | `fal-ai/gpt-image-1` | OpenAI Propietaria | 9 | 8 | 6 | 10 | 4 | 1 | 4 | **52** |
| **Playground v2.5** | `fal-ai/playground-v25` | SDXL mejorado | 6 | 7 | 8 | 6 | 5 | 9 | 7 | **55** |
| **Kolors** | `fal-ai/kolors` | Latent Diffusion | 8 | 6 | 5 | 7 | 7 | 9 | 7 | **55** |
| **Aura Flow** | `fal-ai/aura-flow` | Flow Matching FAL | 6 | 6 | 7 | 6 | 5 | 9 | 5 | **49** |
| **Seedream 4.5** | `fal-ai/seedream-4` | ByteDance prop. | 8 | 7 | 7 | 8 | 6 | 8 | 8 | **60** |
| **Hyper SDXL** | `fal-ai/hyper-sdxl` | SDXL distilado | 5 | 4 | 6 | 5 | 3 | 10 | 10 | **47** |

---

## GUÍA DE SELECCIÓN RÁPIDA: ¿Qué modelo usar según el caso?

### 🖼️ Por tipo de escena:

| Tipo de Imagen | Modelo Recomendado | Alternativa |
|:---------------|:-------------------|:-----------|
| **Fotografía hiperrealista de personas** | Flux Pro Ultra (raw mode) | Imagen 4, Kolors |
| **Fotografía de producto para e-commerce** | GPT Image 1 (high) | Flux Pro Ultra, Recraft V4 |
| **Cinematografía / editorial** | Flux Pro Ultra | Flux Dev + LoRA |
| **Texto dentro de imagen (posters, ads)** | Ideogram V3 | GPT Image 1, Seedream 4.5 |
| **Logos / vectores / brand assets** | Recraft V4 | Ideogram V3 |
| **3D / Ilustración / concept art** | SD 3.5 Large | Recraft V4, Flux Dev |
| **Personaje consistente entre escenas** | Flux Kontext | Flux Dev + LoRA |
| **Prototipado masivo / iteración rápida** | Flux Schnell | Hyper SDXL, SD 3.5 Turbo |
| **Arte fashion / skin textures** | Kolors | Flux Pro Ultra |
| **Prompts complejos multi-elemento** | SD 3.5 Large | Aura Flow, Nano Banana 2 |
| **Edición contextual de imagen existente** | Flux Kontext | GPT Image 1 (edit), Ideogram Remix |
| **Alto volumen con presupuesto ajustado** | Flux Schnell | SD 3.5 Turbo, Kolors |

---

## ÁRBOL DE DECISIÓN

```
¿Cuál es tu prioridad principal?
│
├── CALIDAD MÁXIMA (sin importar costo)
│   ├── Fotorrealismo → Flux Pro Ultra / Imagen 4
│   ├── Producto e-commerce → GPT Image 1 (High)
│   └── Editorial/Arte → Flux Pro Ultra (raw mode)
│
├── EQUILIBRIO CALIDAD-COSTO
│   ├── Generación general → Flux Dev
│   ├── Con personaje consistente → Flux Dev + LoRA
│   ├── Texto en imagen → Ideogram V3 Balanced
│   └── Design/branding → Recraft V4
│
├── VELOCIDAD Y COSTO BAJO
│   ├── Prototipado → Flux Schnell
│   ├── Alto volumen → Flux Schnell / SD 3.5 Turbo
│   └── Máxima velocidad posible → Hyper SDXL
│
└── CASO ESPECIAL
    ├── Edición de imagen existente → Flux Kontext Pro
    ├── Vectores/SVG → Recraft V4
    ├── Texto perfecto en imagen → Ideogram V3 / GPT Image 1
    ├── Skin tones / moda → Kolors
    └── Prompts en chino → Seedream 4.5
```

---

## TABLA DE COSTOS REALES POR RESOLUCIÓN

| Modelo | 512×512 | 1024×1024 | 1024×1536 | 2048×2048 (2K) |
|:-------|:--------|:----------|:----------|:---------------|
| Flux Schnell | ~$0.001 | ~$0.003 | ~$0.005 | ~$0.012 |
| Flux Dev | ~$0.003 | ~$0.008 | ~$0.012 | ~$0.030 |
| Flux Pro v1.1 | — | ~$0.050 | ~$0.050 | — |
| Flux Pro Ultra | — | — | — | **$0.060** (4MP) |
| Flux Kontext Pro | — | ~$0.040-0.060 | — | — |
| SD 3.5 Large | ~$0.003 | ~$0.010 | ~$0.015 | ~$0.040 |
| SD 3.5 Turbo | ~$0.002 | ~$0.005 | ~$0.008 | ~$0.020 |
| Recraft V4 | — | ~$0.040 | — | ~$0.060 |
| Ideogram V3 | — | ~$0.040 | — | — |
| Nano Banana 2 | — | ~$0.050-0.100 | — | — |
| Imagen 4 | — | ~$0.100-0.200 | — | — |
| GPT Image 1 Low | — | ~$0.011 | — | — |
| GPT Image 1 High | — | **$0.167** | — | **$0.211** (HD) |
| Kolors | ~$0.002 | ~$0.008 | ~$0.012 | — |
| Playground v2.5 | ~$0.002 | ~$0.007 | — | — |
| Seedream 4.5 | — | ~$0.030 | — | ~$0.060 |
| Hyper SDXL | ~$0.001 | ~$0.004 | — | — |

> ⚠️ **Todos los precios son aproximados.** Siempre verificar en [fal.ai/pricing](https://fal.ai/pricing) antes de producción. Los precios se actualizan frecuentemente.

---

## TABLA DE SOPORTE DE CARACTERÍSTICAS API

| Modelo | Img-to-Img | Style Reference | LoRA Custom | ControlNet | Negative Prompt | Texto en Imagen |
|:-------|:----------:|:---------------:|:-----------:|:----------:|:---------------:|:---------------:|
| Flux Schnell | ⚠️ Limitado | ❌ | ✅ | ✅ | ❌ | ⭐⭐ |
| Flux Dev | ✅ | ✅ (LoRA) | ✅ | ✅ | ❌ | ⭐⭐⭐ |
| Flux Pro Ultra | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ⭐⭐⭐ |
| Flux Kontext | ✅ Principal | ✅ Principal | ✅ | ⚠️ | ❌ | ⭐⭐⭐ |
| SD 3.5 Large | ✅ | ✅ | ✅ | ✅ | ✅ | ⭐⭐⭐ |
| SD 3.5 Turbo | ✅ | ✅ | ✅ | ✅ | ✅ | ⭐⭐ |
| Recraft V4 | ✅ | ✅ Nativo | ❌ | ❌ | ✅ | ⭐⭐⭐⭐ |
| Ideogram V3 | ✅ Remix | ✅ style_ref | ❌ | ❌ | ✅ | ⭐⭐⭐⭐⭐ |
| Nano Banana 2 | ✅ | ✅ | ❌ | ❌ | ✅ | ⭐⭐⭐⭐ |
| Imagen 4 | ✅ | ✅ | ❌ | ❌ | ✅ | ⭐⭐⭐ |
| GPT Image 1 | ✅ Nativo | ✅ Multimodal | ❌ | ❌ | ❌ | ⭐⭐⭐⭐⭐ |
| Kolors | ✅ | ✅ | ✅ | ✅ | ✅ | ⭐⭐ |
| Playground v2.5 | ✅ | ✅ | ✅ | ✅ | ✅ | ⭐⭐ |
| Seedream 4.5 | ✅ | ✅ | ❌ | ❌ | ✅ | ⭐⭐⭐⭐ |

---

## RESUMEN EJECUTIVO: TOP PICKS POR ROL

### 🏆 Si solo puedes elegir un modelo general:
**→ Flux Dev** (`fal-ai/flux/dev`) — Mejor balance calidad/costo/flexibilidad del ecosistema.

### 🎯 Si necesitas la máxima calidad sin restricción de costo:
**→ Flux Pro Ultra** (`fal-ai/flux-pro/v1.1-ultra`) en modo Raw para fotografía. Imagen 4 para máximo realismo Google-quality.

### 💰 Si tienes presupuesto muy ajustado y necesitas escala:
**→ Flux Schnell** (`fal-ai/flux/schnell`) — A $0.003/imagen con calidad muy decente.

### 🎨 Si necesitas texto perfecto en imagen:
**→ Ideogram V3** (`fal-ai/ideogram/v3`) o GPT Image 1 para máxima perfección de texto.

### 🏢 Si necesitas brand assets y diseño escalable:
**→ Recraft V4** (`fal-ai/recraft-v4`) — Único con SVG nativo.

### 👤 Si necesitas un personaje consistente en múltiples escenas:
**→ Flux Kontext Pro** (`fal-ai/flux/kontext-pro`) o Flux Dev + LoRA entrenado.

### 📸 Si necesitas fotografía de producto para e-commerce premium:
**→ GPT Image 1 (High quality)** para instrucción precisa. Flux Pro Ultra para estética luxury.

---

## RESTRICCIONES Y TRAMPAS CONOCIDAS (Memoria de Aprendizaje)

1. **Flux NO soporta negative prompts** — Usar framing positivo en su lugar.
2. **Flux NO soporta syntax de peso** `(palabra:1.2)` — Eso es SDXL, no Flux.
3. **Guidance scale alto = artefactos en Flux**: Mantener 2.5–5 (Dev), 1–4 (Schnell).
4. **LoRA trigger word debe ser ÚNICA**: No usar palabras comunes del vocabulario del modelo.
5. **Image-to-image strength >0.9** = alta creatividad, pierde estructura original.
6. **Precios se actualizan frecuentemente**: Siempre verificar en fal.ai/pricing antes de presupuestar.
7. **Flux Ultra cobra por imagen** ($0.06), no por megapíxel — diferente a Dev/Schnell.
8. **GPT Image 1 High** puede ser el costo más alto del ecosistema por imagen: $0.167 en 1024×1024.
9. **Seedream puede tener disponibilidad variable** según región en FAL.
10. **Recraft V4 ignora parámetro `size`** si se provee `aspect_ratio`: elegir uno u otro.
11. **SD 3.5 requiere licencia enterprise** para empresas con >$1M revenue anual.
12. **Flux Dev requiere mínimo 20 steps** para calidad aceptable; Schnell OK con 1–4 steps.

---

*Investigación realizada: Junio 2026 | Fuentes: fal.ai/pricing, fal.ai/models, docs.fal.ai, bfl.ai, benchmarks comunitarios Pixazo/Melies/Artificial Analysis*

*⚠️ Esta información puede desactualizarse. FAL.ai actualiza modelos y precios regularmente. Siempre contrastar contra fuentes oficiales.*
