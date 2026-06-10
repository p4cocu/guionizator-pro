# Flux en FAL.ai: Guía de Investigación Profunda para Generación de Imágenes Profesionales

> [!NOTE]
> **Base de Conocimiento Deep Research — Junio 2026**
> Investigación exhaustiva sobre los modelos Flux (Dev, Pro, Schnell) disponibles en FAL.ai. Cubre arquitectura, ingeniería de prompts, LoRAs, parámetros de API, técnicas de consistencia visual y costos reales por imagen.

---

## Tabla de Contenidos

1. [Arquitectura y Ecosistema Flux](#1-arquitectura-y-ecosistema-flux)
2. [Comparativa: Flux Dev vs Pro vs Schnell](#2-comparativa-flux-dev-vs-pro-vs-schnell)
3. [Ingeniería de Prompts Óptima para Flux](#3-ingeniería-de-prompts-óptima-para-flux)
4. [LoRAs en FAL.ai: Consistencia de Personajes y Estilos](#4-loras-en-falai-consistencia-de-personajes-y-estilos)
5. [Parámetros de API en FAL.ai](#5-parámetros-de-api-en-falai)
6. [Técnica de "Style Lock" para Series Coherentes](#6-técnica-de-style-lock-para-series-coherentes)
7. [Mejores Prácticas por Nicho Visual](#7-mejores-prácticas-por-nicho-visual)
8. [Image-to-Image y Style Reference vía API](#8-image-to-image-y-style-reference-vía-api)
9. [Comparativa Real de Costos por Imagen](#9-comparativa-real-de-costos-por-imagen)
10. [Endpoints de Referencia Rápida](#10-endpoints-de-referencia-rápida)

---

## 1. Arquitectura y Ecosistema Flux

### ¿Qué es Flux?

Flux es una familia de modelos de generación de imágenes desarrollada por **Black Forest Labs** (fundada por ex-investigadores de Stability AI, incluyendo a Robin Rombach, co-autor de Stable Diffusion). Su arquitectura se basa en **Flow Matching** (no difusión tradicional) combinado con **Diffusion Transformers (DiT)** de 12 mil millones de parámetros.

### Diferencias Arquitectónicas Clave

| Característica | Flux | Stable Diffusion (SDXL) | Midjourney |
|:---|:---|:---|:---|
| **Arquitectura base** | Flow Matching + Diffusion Transformer (12B parámetros) | U-Net + VAE | Propietaria (cerrada) |
| **Text encoder** | T5-XXL + CLIP (dual-encoder) | CLIP-G/L | Propietario |
| **Entrenamiento** | Flow Matching con rectified flows | DDPM/DDIM con noise schedules | No documentado |
| **Negative prompts** | ❌ NO soportados | ✅ Fundamentales | ❌ No (usa parámetros --no) |
| **Síntaxis de peso** | ❌ No soportada `(word:1.2)` | ✅ Soportada | ✅ Soportada `::2` |
| **Adherencia al texto** | ⭐⭐⭐⭐⭐ Excelente | ⭐⭐⭐ Media | ⭐⭐⭐⭐ Alta |
| **Renderizado de texto** | ⭐⭐⭐⭐⭐ Superior | ⭐⭐ Pobre | ⭐⭐⭐ Media |

### Por qué T5-XXL cambia todo

El encoder T5 (Text-to-Text Transfer Transformer) fue entrenado en textos humanos reales y comprende **instrucciones en prosa natural**, no listas de keywords como CLIP. Esto significa:

- Flux interpreta "una mujer con actitud segura mirando directamente a la cámara" como una instrucción coherente
- SD/MJ requieren keywords como `confident, direct gaze, eye contact, intense`
- Flux entiende relaciones complejas y contextos narrativos
- El orden de las palabras importa mucho más en Flux que en SD

### Variantes de Flux en el Ecosistema FAL.ai

```
Familia Flux.1 (Black Forest Labs)
├── Flux.1 [schnell]     → Ultra-rápido, Apache 2.0, 1-4 steps
├── Flux.1 [dev]         → Alta calidad, non-commercial, 20-50 steps
├── Flux.1 [pro]         → API comercial, máxima calidad
├── Flux 1.1 [pro]       → Pro mejorado, mejor fotorrealismo
├── Flux 1.1 [pro] Ultra → Flagship, hasta 4MP, $0.06/imagen
└── Flux [Redux]         → Especializado en image-to-image

Variantes Específicas FAL.ai
├── fal-ai/flux/dev              → Dev estándar
├── fal-ai/flux/schnell          → Schnell estándar
├── fal-ai/flux-pro              → Pro comercial
├── fal-ai/flux-pro/v1.1-ultra   → Pro Ultra (hasta 4MP)
├── fal-ai/flux-lora             → Dev con soporte LoRA
├── fal-ai/flux/dev/image-to-image → i2i con Dev
└── fal-ai/flux-lora-fast-training → Entrenador de LoRAs
```

---

## 2. Comparativa: Flux Dev vs Pro vs Schnell

### Tabla Maestra de Comparación

| Dimensión | Flux.1 Schnell | Flux.1 Dev | Flux.1 Pro | Flux 1.1 Pro Ultra |
|:---|:---|:---|:---|:---|
| **Calidad de imagen** | ⭐⭐⭐ (~75% del Pro) | ⭐⭐⭐⭐ (~90-95% del Pro) | ⭐⭐⭐⭐⭐ Flagship | ⭐⭐⭐⭐⭐+ Mejor que Pro |
| **Velocidad** | ⚡⚡⚡ Más rápido (< 2 seg) | ⚡⚡ Moderado (5-15 seg) | ⚡ Más lento (10-30 seg) | ⚡ Lento (15-40 seg) |
| **Inference steps óptimos** | 1-4 steps | 20-50 steps | Variable (optimizado internamente) | Variable (optimizado) |
| **Guidance scale recomendado** | 1-4 | 2-5 (default: 3.5) | 2-5 | 2-4 |
| **Licencia** | Apache 2.0 (uso libre) | Non-commercial (libre para dev) | API-only (comercial) | API-only (comercial) |
| **LoRA support** | ✅ (via fal-ai/flux-lora con schnell base) | ✅ Nativo | ❌ Limitado | ❌ Limitado |
| **Image-to-image** | ✅ | ✅ | ❌ (via Redux) | ❌ (via Redux) |
| **Resolución máxima nativa** | 1024×1024 | 1024×1024 | 1024×1024 | 2048×2048 (4MP) |
| **Caso de uso principal** | Prototipado rápido, storyboarding | Producción y desarrollo de apps | Trabajo comercial premium | Producción de máxima calidad |
| **Costo base (1MP / 1024×1024)** | ~$0.003 | ~$0.025 | — | $0.06/imagen flat |

### Análisis de Calidad por Dimensión

#### Fotorrealismo y Piel Humana
- **Pro/Ultra**: Manejan texturas de piel con SSS (subsurface scattering) implícito, detalle de poros, micro-expresiones
- **Dev**: ~90% del fotorrealismo de Pro; excelente para producción estándar
- **Schnell**: Suficiente para bocetos y concept; notar simplificación en detalles finos de piel

#### Adherencia al Prompt
- **Pro**: Precisión >95% en instrucciones complejas con múltiples elementos
- **Dev**: ~90% adherencia; puede perder detalles muy específicos en prompts largos
- **Schnell**: ~75-80%; simplifica instrucciones complejas

#### Tipografía y Texto en Imagen
- **Todos los modelos Flux**: Superiores a SD y MJ para texto legible dentro de imágenes
- Pro Ultra: Mejor para texto con fuentes específicas y logos simples
- Nota: Mantener texto entre 1-4 palabras para mejores resultados en todos los modelos

#### Composición y Coherencia Espacial
- **Pro/Ultra**: Composiciones más sofisticadas con regla de tercios implícita
- **Dev**: Composiciones sólidas, compatible con ControlNet para control preciso
- **Schnell**: Composiciones funcionales; puede presentar inconsistencias en escenas complejas

### Cuándo Elegir Cada Modelo

**Elige Schnell cuando:**
- Necesitas iteración rápida (< 2 segundos por imagen)
- Estás en fase de prototipado de prompts
- Generas volúmenes altos con presupuesto limitado (storyboards, variaciones)
- Tu caso de uso tolera calidad 75-80%

**Elige Dev cuando:**
- Desarrollas aplicaciones o workflows con alto volumen
- Necesitas LoRAs para consistencia de personajes
- Quieres el mejor balance calidad/costo en producción
- Trabajas localmente (ComfyUI, A1111, workflows propios)
- Tu presupuesto permite ~$0.025/MP pero no Pro

**Elige Pro / Pro Ultra cuando:**
- Trabajo comercial de entregables finales
- Necesitas la máxima adherencia al prompt
- Fotografía de producto, publicidad de lujo, editorial
- El costo no es factor decisivo vs. calidad máxima
- Requieres resoluciones 2K+ (Ultra)

---

## 3. Ingeniería de Prompts Óptima para Flux

### La Diferencia Fundamental: Prosa vs. Keywords

#### ❌ El error clásico (mentalidad SD/MJ)
```text
beautiful woman, confident, direct gaze, studio, professional, 8k, masterpiece, 
high quality, detailed, bokeh, f1.8, 85mm, perfect face, no blur
```
*Este prompt tiene sintaxis de Stable Diffusion. En Flux produce resultados mediocres porque:*
- El T5 encoder interpreta comas como pausas, no como separadores de keywords
- "masterpiece, 8k, high quality" son vacías para un modelo que entiende lenguaje natural
- "no blur" puede ser ignorado (usa framing positivo: "sharp focus")

#### ✅ La estructura óptima para Flux (lenguaje natural descriptivo)
```text
A confident 32-year-old female founder with dark hair, wearing a tailored charcoal 
blazer, making direct and warm eye contact with the camera, seated in a minimalist 
executive office with soft morning window light. Shot on 85mm lens at f/1.8, 
shallow depth of field with warm bokeh, professional color grading in the style 
of Arri Alexa.
```

### Estructura Jerárquica de Prompt para Flux

```
[SUJETO PRINCIPAL - FRONT-LOADED]
↓
[DESCRIPCIÓN FÍSICA + VESTIMENTA]
↓  
[ACCIÓN / POSE / EXPRESIÓN]
↓
[ENTORNO + ILUMINACIÓN]
↓
[ESPECIFICACIONES TÉCNICAS DE CÁMARA]
↓
[ESTILO / REFERENCIA VISUAL]
```

### Reglas de Peso de Tokens en Flux

A diferencia de SD (donde puedes usar `(palabra:1.5)` para dar peso), Flux pondera tokens basándose en:

1. **Posición**: Cuanto más al inicio del prompt, mayor peso implícito
2. **Especificidad**: Términos técnicos específicos (`85mm prime lens`) > términos genéricos (`good camera`)
3. **Frecuencia de descripción**: Repetir un concepto de forma natural (no spam) refuerza la instrucción
4. **Claridad semántica**: El T5 entiende jerarquía semántica: "sujeto principal" > "elemento de fondo"

**Técnica de front-loading:**
```text
[Sujeto más importante] + [segundo elemento] + [fondo/ambiente] + [técnica]
```
```text
A sleek matte black ceramic coffee mug filled with steaming espresso, 
placed on weathered white marble, surrounded by scattered coffee beans, 
soft studio side lighting with warm shadows, commercial product photography 
aesthetic, ultra-sharp focus on the mug's texture.
```

### Comparativa de Sintaxis: Flux vs Midjourney vs Stable Diffusion

| Elemento | Flux | Midjourney | Stable Diffusion |
|:---|:---|:---|:---|
| **Estilo de escritura** | Prosa descriptiva natural | Conciso + parámetros (`--ar`, `--s`) | Lista de keywords separadas por comas |
| **Negative prompts** | No existe. Usar framing positivo | `--no [elemento]` | `negative_prompt: "blurry, bad..."` |
| **Pesos de tokens** | Posición en la oración | `palabra::2` | `(palabra:1.5)` |
| **Relación de aspecto** | Parámetro de API: `image_size` | `--ar 16:9` | `width`, `height` en config |
| **Estilo de referencia** | Describir con lenguaje fotográfico | `--sref [URL]` | `img2img` con IP-Adapter |
| **Calidad** | Incluir en descripción técnica ("ultra-sharp", "fine texture detail") | `--q 2` | `steps`, `cfg_scale` altos |
| **Longitud ideal** | 30-80 palabras | 10-40 palabras | 50-150 palabras (keyword spam) |
| **Texto en imagen** | `a sign that says "OPEN"` funciona | Limitado | Muy limitado |

### Tokens de Mayor Peso en Flux

Los siguientes términos tienen alto impacto semántico en el T5 de Flux porque mapean directamente a conceptos fotográficos bien representados en el dataset de entrenamiento:

#### Para Fotografía Profesional
```
Shot on [cámara específica]  →  "Shot on Hasselblad X2D", "Shot on Canon R5"
[X]mm prime lens             →  "85mm prime lens", "50mm lens"
f/[apertura]                 →  "f/1.4", "f/1.8", "f/2.8"
[estudio] lighting           →  "three-point studio lighting", "ring light"
color grading                →  "Arri Alexa color science", "Kodak Portra look"
```

#### Para Cinematografía
```
anamorphic lens flare        →  destellos horizontales cinematográficos
film grain                   →  grano orgánico de película
shallow depth of field       →  bokeh suave en fondo
cinematic color grading      →  paleta de cine con lift/gamma/gain
shot on 35mm film            →  textura analógica completa
```

#### Para Producto
```
commercial product photography  →  activación del "modo advertising"
hero shot                       →  composición frontal de producto
brushed aluminum / matte ceramic →  materiales con textura precisa
macro lens detail               →  enfoque ultra-cercano
studio sweep background         →  fondo de gradiente limpio
```

### Manejo de Texto Dentro de la Imagen

Flux es superior a todos los modelos en renderizado de texto. Protocolo:

```text
# Correcto
a street sign that says "BIENVENIDOS", bold red letters on white background

# Correcto (producto)
a coffee bag with the word "OBSIDIAN" printed in clean sans-serif on kraft paper

# Incorrecto (texto muy largo)
a billboard that says "¡GRAN OFERTA DEL 50% EN TODOS NUESTROS PRODUCTOS ESTE VERANO!"
```
**Regla**: Máximo 4 palabras de texto dentro de la imagen para fidelidad garantizada.

### Ejemplos de Prompts Listos para Usar

#### Retrato Ejecutivo (LinkedIn / Branding Personal)
```text
A confident 35-year-old male entrepreneur with clean-cut dark hair and subtle 
3-day stubble, wearing a fitted navy blue blazer over a white dress shirt with 
no tie, making warm and direct eye contact with the camera with a genuine 
professional smile. Seated at a glass desk in a modern, minimalist office with 
floor-to-ceiling windows overlooking a city skyline at dusk. Shot on 85mm prime 
lens at f/2.0, warm golden-teal color grade, soft rim lighting separating 
subject from background. Sharp focus on eyes.
```

#### Fotografía de Producto (E-commerce / Ads)
```text
A premium matte black glass perfume bottle with gold metallic cap, engraved 
with the word "NOIR", placed on a polished black obsidian stone surface. Scattered 
dried rose petals and small dried botanicals around the base. Three-point studio 
lighting with a subtle purple-teal color accent from the side. Shot from a 
45-degree angle with a macro lens, ultra-sharp product detail, commercial luxury 
advertising aesthetic, dark and mysterious atmosphere.
```

#### Fotografía Cinematográfica (Narrativa / Editorial)
```text
A lone figure in a long beige trench coat walking through an empty rain-soaked 
Parisian alleyway at 2am, cobblestones reflecting neon bar signs in red and 
yellow. Shot from behind at medium distance, 35mm anamorphic lens, heavy lens 
flare cutting across the frame, cinematic teal-orange color grade, film grain, 
Blade Runner 2049 aesthetic. Wide shot.
```

---

## 4. LoRAs en FAL.ai: Consistencia de Personajes y Estilos

### ¿Qué es un LoRA en Flux?

LoRA (Low-Rank Adaptation) es una técnica de fine-tuning que permite entrenar adaptaciones ligeras del modelo base con un dataset pequeño. En Flux, los LoRAs se integran en las capas del Diffusion Transformer para "memorizar" un personaje específico, un estilo visual o un producto.

**Ventajas sobre otras técnicas:**
- Sin LoRA: cada generación puede producir un personaje diferente aunque uses seed fijo
- Con LoRA: el personaje/estilo es consistente con ±95% de fidelidad entre generaciones
- Tamaño: un LoRA de Flux pesa típicamente 50-500 MB (vs. 7GB del modelo base)

### Workflow Completo: Desde Dataset hasta Producción

#### Paso 1: Preparación del Dataset

```
Dataset mínimo viable:        10-20 imágenes de alta calidad
Dataset recomendado:          25-50 imágenes
Dataset robusto (estilos):    50-200 imágenes
Dataset para marcas/IPs:      100-1,000 imágenes
```

**Requisitos de calidad:**
- Resolución mínima: 1024×1024 px
- Variedad de ángulos: frontal, 3/4, perfil (para personajes)
- Variedad de iluminación: studio, natural, interior
- Fondo limpio vs. fondos contextuales (50/50 para mejor generalización)
- **NO incluir**: imágenes borrosas, watermarks, múltiples personas en frame

**Captions por imagen:**
- Cada imagen necesita un caption descriptivo en lenguaje natural
- El caption debe incluir el `trigger_word` que activará el LoRA
- Ejemplo: `"TOK person, a confident young woman with auburn curly hair, wearing casual streetwear, smiling"`

#### Paso 2: Entrenamiento en FAL.ai

**Endpoint:** `fal-ai/flux-lora-fast-training`

```python
import fal_client

result = fal_client.subscribe(
    "fal-ai/flux-lora-fast-training",
    arguments={
        "images_data_url": "https://tu-storage.com/dataset.zip",
        "trigger_word": "TOK",           # Tu palabra de activación única
        "steps": 1000,                   # Pasos de entrenamiento (500-2000)
        "learning_rate": 4e-4,           # Tasa de aprendizaje recomendada
        "rank": 16,                      # Rank del LoRA (4-32; más alto = más fiel pero más pesado)
        "is_input_format_already_prepared": False  # FAL procesa el ZIP automáticamente
    },
    with_logs=True,
    on_queue_update=lambda update: print(f"Status: {update.status}")
)

lora_url = result["diffusers_lora_file"]["url"]
print(f"LoRA entrenado disponible en: {lora_url}")
```

**Parámetros de entrenamiento clave:**

| Parámetro | Rango | Recomendado | Efecto |
|:---|:---|:---|:---|
| `steps` | 200-4000 | 800-1500 | Más steps = mejor memorización pero riesgo de overfitting |
| `rank` | 4-64 | 16 | Mayor rank = más capacidad pero más peso del archivo |
| `learning_rate` | 1e-5 to 1e-3 | 4e-4 | Afecta velocidad de convergencia |
| `trigger_word` | Cualquier token único | `TOK`, `FRSN`, nombre inventado | Evitar palabras comunes del idioma |

#### Paso 3: Inferencia con LoRA

**Endpoint:** `fal-ai/flux-lora`

```python
import fal_client

result = fal_client.subscribe(
    "fal-ai/flux-lora",
    arguments={
        "prompt": "TOK person, wearing a red evening dress, standing on a rooftop in Tokyo at night, cinematic lighting",
        "loras": [
            {
                "path": "https://tu-storage.com/tu-lora.safetensors",
                "scale": 0.9   # Intensidad del LoRA: 0.7-1.0 recomendado
            }
        ],
        "num_inference_steps": 28,
        "guidance_scale": 3.5,
        "image_size": "portrait_4_3",
        "num_images": 1,
        "seed": 42  # Fijo para reproducibilidad
    }
)

print(result["images"][0]["url"])
```

**Parámetro `scale` del LoRA:**

| Valor `scale` | Efecto |
|:---|:---|
| 0.5-0.7 | LoRA como influencia suave; más libertad creativa del modelo base |
| 0.75-0.9 | Balance óptimo: fidelidad al personaje + flexibilidad de escena |
| 0.95-1.0 | Alta fidelidad al LoRA; riesgo de reducir variabilidad de fondo |
| > 1.0 | Sobre-saturación del LoRA; artefactos posibles |

### Estrategia: LoRA de Personaje vs. LoRA de Estilo

#### LoRA de Personaje (Character LoRA)
- **Objetivo**: Mantener identidad visual de una persona real, avatar o mascota
- **Dataset**: 30-50 fotos del personaje en diferentes ángulos, expresiones, vestuarios
- **Trigger word**: Token único (ej. `PERSON_01`, `MARCO_AVATAR`)
- **Uso en prompt**: `"PERSON_01, wearing X, doing Y, in Z environment"`

#### LoRA de Estilo Visual (Style LoRA)
- **Objetivo**: Capturar una estética específica (cyberpunk, anime, oil painting, brand aesthetic)
- **Dataset**: 50-200 imágenes del estilo deseado (no una persona específica)
- **Trigger word**: Descriptor del estilo (ej. `CYBERPK_STYLE`, `NEON_AESTHETIC`)
- **Uso en prompt**: `"[descripción de la imagen] in CYBERPK_STYLE"`

#### LoRA de Producto (Product LoRA)
- **Objetivo**: Insertar un producto real/marca en diferentes contextos sin distorsión
- **Dataset**: 15-30 fotos del producto en diferentes ángulos y fondos
- **Trigger word**: Nombre del producto (ej. `NIKE_SHOE_X`, `MYPERFUME_BOT`)
- **Uso en prompt**: `"MYPERFUME_BOT perfume bottle on a marble surface with roses"`

### Técnica Avanzada: Stack de Múltiples LoRAs

FAL.ai permite combinar múltiples LoRAs en una sola llamada:

```python
"loras": [
    {"path": "url_personaje_lora.safetensors", "scale": 0.85},
    {"path": "url_estilo_cinematico_lora.safetensors", "scale": 0.6},
    {"path": "url_iluminacion_lora.safetensors", "scale": 0.4}
]
```

**Regla del Stack:**
- Suma de todos los `scale` values: < 2.0 para evitar artefactos
- LoRA de personaje siempre con scale mayor que LoRAs de estilo
- Máximo recomendado: 3 LoRAs simultáneos

---

## 5. Parámetros de API en FAL.ai

### Arquitectura de una Llamada Completa

```python
import fal_client
import os

os.environ["FAL_KEY"] = "tu-api-key-aqui"

result = fal_client.subscribe(
    "fal-ai/flux/dev",           # Endpoint del modelo
    arguments={
        # ─── PARÁMETROS PRINCIPALES ─────────────────────────────────
        "prompt": "...",          # Requerido: el prompt en lenguaje natural
        "image_size": "landscape_16_9",  # Formato de salida
        "num_inference_steps": 28,       # Pasos de denoising
        "guidance_scale": 3.5,           # Adherencia al prompt (CFG)
        "num_images": 1,                 # Número de imágenes a generar
        "seed": 42,                      # Reproducibilidad (None = aleatorio)
        
        # ─── PARÁMETROS AVANZADOS ────────────────────────────────────
        "enable_safety_checker": True,   # Filtro de contenido
        "output_format": "jpeg",         # "jpeg" o "png"
        "sync_mode": False               # True = espera respuesta directa (max ~30s)
    },
    with_logs=True,
    on_queue_update=lambda update: print(f"Queue status: {update.status}")
)

images = result["images"]
for i, img in enumerate(images):
    print(f"Imagen {i+1}: {img['url']} - Tamaño: {img['width']}x{img['height']}")
```

### Documentación Completa de Parámetros

#### `prompt` (string, REQUERIDO)
- Descripción en lenguaje natural de la imagen deseada
- Longitud óptima: 30-80 palabras
- No usar negative_prompt (no existe en Flux)
- Usar framing positivo: "sharp focus, clean background" en lugar de "no blur, no clutter"

#### `image_size` (string | object)
Formatos predefinidos disponibles:

| Preset | Resolución | Aspecto | Uso ideal |
|:---|:---|:---|:---|
| `square_hd` | 1024×1024 | 1:1 | Redes sociales, producto, avatar |
| `square` | 512×512 | 1:1 | Prototipado rápido y barato |
| `portrait_4_3` | 768×1024 | 3:4 | Retrato clásico, Pinterest |
| `portrait_16_9` | 576×1024 | 9:16 | TikTok Ads, Reels, Stories |
| `landscape_4_3` | 1024×768 | 4:3 | Blog post, presentación |
| `landscape_16_9` | 1024×576 | 16:9 | YouTube thumbnail, banner web |

**Custom size:**
```python
"image_size": {"width": 1344, "height": 768}  # 16:9 HD custom
"image_size": {"width": 832, "height": 1216}   # Portrait magazine
```

**Nota Pro Ultra**: Soporta hasta 2048×2048 px (4 megapixels)

#### `num_inference_steps` (integer)

| Modelo | Mínimo | Óptimo | Máximo útil | Default API |
|:---|:---|:---|:---|:---|
| Schnell | 1 | 2-4 | 8 (rend. decreciente) | 4 |
| Dev | 15 | 25-35 | 50 | 28 |
| Pro | N/A (interno) | N/A | N/A | Optimizado automáticamente |

**Relación steps-calidad en Dev:**
- 15 steps: Resultados aceptables para iteración
- 28 steps: Balance óptimo calidad/velocidad (recomendado)
- 40-50 steps: Máxima calidad, +20-40% tiempo, mejoras marginales en prompts simples; notables en prompts complejos

#### `guidance_scale` (float)

**El parámetro más crítico y mal configurado en Flux:**

| Rango | Efecto | Cuándo usar |
|:---|:---|:---|
| 1.0 - 2.0 | Muy libre, interpretativo, artístico | Arte abstracto, exploración |
| 2.5 - 3.5 | **Balance óptimo** para Flux | Fotografía profesional, producto |
| 3.5 - 5.0 | Alta adherencia al prompt | Prompts técnicos muy específicos |
| > 5.0 | ⚠️ Artefactos, colores saturados, "quemado" | Evitar |
| > 7.0 | 🚫 Imagen destruida, contrastes extremos | NUNCA usar |

**Diferencia crítica con SD**: En SD el cfg ideal es 7-12. En Flux esos mismos valores destruyen la imagen.

**Default recomendado:** 3.5 para Dev/Pro; 2.0 para Schnell

#### `seed` (integer | null)

```python
# Generación aleatoria (exploración)
"seed": None

# Reproducible exacto (producción)
"seed": 1234567890

# Técnica de "seed walking" (variaciones controladas)
seeds_a_probar = [42, 43, 44, 100, 200, 12345]
```

**Comportamiento del seed en Flux:**
- Mismo seed + mismo prompt + mismos params = imagen 100% idéntica
- Mismo seed + prompt ligeramente modificado = variación controlada del layout base
- Seed reuse es la base de la técnica "Style Lock" (ver Sección 6)

#### `num_images` (integer)

| Modelo | Rango | Default | Coste |
|:---|:---|:---|:---|
| Schnell | 1-4 | 1 | Se multiplica proporcionalmente |
| Dev | 1-4 | 1 | Se multiplica proporcionalmente |
| Pro | 1-1 | 1 | Un solo request = una imagen |

**Recomendación**: Generar 4 imágenes en un solo request es ~igual de rápido que 4 requests individuales pero más eficiente en latencia de red.

### Parámetros Adicionales por Endpoint

#### Específicos de `fal-ai/flux-lora`
```python
"loras": [{"path": "url", "scale": 0.85}],    # Lista de LoRAs a aplicar
```

#### Específicos de `fal-ai/flux/dev/image-to-image`
```python
"image_url": "https://url-imagen-fuente.jpg",  # Imagen de referencia (pública)
"strength": 0.85,                              # 0.01-1.0 (default: 0.85)
```

#### Específicos de `fal-ai/flux-pro/v1.1-ultra`
```python
"aspect_ratio": "16:9",   # String en lugar de image_size object
"raw": True,              # Desactiva post-procesado → look más fotográfico
"safety_tolerance": "2",  # 1-6 (6 = más permisivo)
```

### Manejo de Colas y Respuestas Asíncronas

Para generaciones largas (Pro, 50 steps Dev) usar el patrón asíncrono:

```python
import fal_client
import time

# Submit sin esperar
handle = fal_client.submit(
    "fal-ai/flux-pro/v1.1-ultra",
    arguments={
        "prompt": "Tu prompt aquí",
        "aspect_ratio": "1:1"
    }
)

request_id = handle.request_id
print(f"Request ID: {request_id}")

# Polling manual (o usar webhook)
while True:
    status = fal_client.status("fal-ai/flux-pro/v1.1-ultra", request_id)
    if status.status == "COMPLETED":
        result = fal_client.result("fal-ai/flux-pro/v1.1-ultra", request_id)
        print(result["images"][0]["url"])
        break
    elif status.status == "FAILED":
        print("Error:", status.error)
        break
    time.sleep(2)
```

---

## 6. Técnica de "Style Lock" para Series Coherentes

### Concepto

El "Style Lock" es una combinación de técnicas para mantener coherencia visual en una serie de imágenes (campañas publicitarias, series de contenido, storyboards). No existe como parámetro único — es una metodología compuesta.

### Los 4 Pilares del Style Lock

```
1. SEED FIJO          → Bloquea la latente base (estructura compositiva)
2. PROMPT TEMPLATE    → Mantiene el "ADN visual" constante entre imágenes
3. PARÁMETROS FIJOS   → Mismo guidance_scale, steps, image_size siempre
4. LoRA (opcional)    → Ancla el personaje/estilo independientemente del prompt
```

### Implementación Práctica: Style Lock para Campaña Publicitaria

#### Arquitectura del Prompt Template

```python
# El "DNA" del estilo (no cambia entre imágenes)
STYLE_DNA = """
Shot on 85mm prime lens at f/2.0, three-point studio lighting with warm key light 
and cool fill, shallow depth of field with creamy bokeh, Kodak Portra 400 color 
grade, film grain texture, professional commercial photography aesthetic.
"""

# El sujeto (cambia entre imágenes)
SUBJECT_VARIANT_1 = "A confident 28-year-old woman with red curly hair, wearing a beige linen blazer, holding a ceramic coffee mug with both hands, warm genuine smile"
SUBJECT_VARIANT_2 = "The same woman, now outdoors in a sunny park, wearing a white summer dress, reading a book under a tree"
SUBJECT_VARIANT_3 = "The same woman, in a modern home kitchen, preparing breakfast, casual weekend style"

# Construcción del prompt completo
def build_locked_prompt(subject_description: str, style_dna: str) -> str:
    return f"{subject_description}, {style_dna}"
```

#### Script Completo de Style Lock

```python
import fal_client
import json

# ─── CONFIGURACIÓN DE STYLE LOCK ─────────────────────────────────────────────
STYLE_CONFIG = {
    "seed": 87654321,              # NUNCA cambiar este valor en la serie
    "guidance_scale": 3.5,         # NUNCA cambiar
    "num_inference_steps": 28,     # NUNCA cambiar
    "image_size": "portrait_4_3",  # NUNCA cambiar
    "loras": [
        {"path": "https://tu-storage.com/character_lora.safetensors", "scale": 0.88}
    ]
}

STYLE_DNA = """
Shot on 85mm prime lens at f/2.0, soft three-point studio lighting, 
warm golden-teal color grade, Kodak Portra 400 film aesthetic, 
shallow depth of field, clean professional background.
"""

# ─── VARIANTES DE LA SERIE ───────────────────────────────────────────────────
SERIES_PROMPTS = [
    "TOK woman, smiling warmly at the camera, wearing a tailored beige blazer",
    "TOK woman, looking thoughtfully to the side, working on a laptop in a coffee shop",
    "TOK woman, laughing naturally, standing in a minimalist studio space",
    "TOK woman, celebrating with arms raised, energetic and joyful expression",
]

# ─── GENERACIÓN DE LA SERIE ──────────────────────────────────────────────────
def generate_series(prompts: list, style_dna: str, style_config: dict):
    results = []
    
    for i, subject_prompt in enumerate(prompts):
        full_prompt = f"{subject_prompt}, {style_dna.strip()}"
        
        print(f"\n[{i+1}/{len(prompts)}] Generando: {subject_prompt[:60]}...")
        
        result = fal_client.subscribe(
            "fal-ai/flux-lora",
            arguments={
                "prompt": full_prompt,
                **style_config  # Todos los parámetros de style lock
            }
        )
        
        image_url = result["images"][0]["url"]
        results.append({
            "index": i + 1,
            "prompt_variant": subject_prompt,
            "image_url": image_url,
            "seed_used": style_config["seed"]
        })
        
        print(f"  ✓ URL: {image_url}")
    
    # Guardar manifest de la serie
    with open("series_manifest.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n✅ Serie completa. {len(results)} imágenes generadas.")
    return results

generate_series(SERIES_PROMPTS, STYLE_DNA, STYLE_CONFIG)
```

### Variaciones Controladas: El "Seed Walk"

Para explorar variaciones de un mismo concepto manteniendo el estilo:

```python
BASE_SEED = 12345

# Seeds relacionados para variaciones controladas
# Los seeds adyacentes suelen producir variaciones similares en layout
seed_variants = {
    "principal": BASE_SEED,
    "variante_a": BASE_SEED + 1,   # Cambio mínimo
    "variante_b": BASE_SEED + 10,  # Cambio moderado
    "variante_c": BASE_SEED + 100, # Cambio notable pero relacionado
}

# NOTA: Esto es heurístico, no garantizado. El "seed walk" requiere
# experimentación manual para encontrar seeds que produzcan 
# variaciones deseadas de un concepto base.
```

### Style Lock con ControlNet (Dev + FAL.ai)

Para máxima consistencia de composición:

```python
# Usando un "pose image" como referencia estructural
result = fal_client.subscribe(
    "fal-ai/flux-lora",
    arguments={
        "prompt": "TOK woman, [descripción], [style_dna]",
        "loras": [{"path": "character_lora_url", "scale": 0.88}],
        "controlnets": [
            {
                "path": "fal-ai/controlnet-union",
                "image_url": "url_de_imagen_de_pose",
                "conditioning_scale": 0.7,
                "type": "pose"   # depth, canny, pose
            }
        ],
        "seed": 87654321,
        "guidance_scale": 3.5
    }
)
```

---

## 7. Mejores Prácticas por Nicho Visual

### 7.1 Fotografía Realista de Retrato

**Objetivo**: Imitar fotografía editorial o comercial de retrato humano profesional

**Parámetros recomendados:**
```python
{
    "model": "fal-ai/flux-pro/v1.1-ultra",  # Pro Ultra para máximo detalle de piel
    "guidance_scale": 3.0,
    "num_inference_steps": 35,
    "image_size": "portrait_4_3",
    "seed": [seed_fijo]
}
```

**Template de prompt:**
```text
[edad + etnia + género] person with [descripción física específica: cabello, ojos, 
textura de piel], [vestimenta y accesorios], [expresión y postura], [entorno y 
contexto], Shot on [cámara específica], [focal length]mm lens at [apertura], 
[descripción de iluminación], [referencia de color grade], photorealistic, 
natural skin pores and texture detail.
```

**Ejemplo completo:**
```text
A 38-year-old Hispanic woman with wavy dark brown hair, warm olive skin with 
natural freckles, wearing a tailored cream-colored linen blazer and minimalist 
gold earrings, giving a confident and authentic smile, standing in a sunlit 
modern co-working space. Shot on Hasselblad X2D at 80mm, f/2.8 aperture, 
soft natural window light from camera left, warm neutral color grade, 
photorealistic skin texture with natural pores, professional editorial photography.
```

**Técnicas específicas para evitar el "look de IA":**
1. Especificar "natural skin pores and texture" evita la piel plástica
2. "Subtle asymmetry" o "slight imperfections" rompe la perfección artificial
3. Referencias de película real: "Kodak Portra 400 grain texture"
4. Luz práctica real: "practical lamp light from the right, catching the edge of the face"
5. Fondos con profundidad narrativa, no fondos neutros infinitos

### 7.2 Cinematografía y Narrativa Visual

**Objetivo**: Imágenes con el "look" de producciones cinematográficas reales

**Parámetros recomendados:**
```python
{
    "model": "fal-ai/flux/dev",  # Dev es suficiente para cinematografía
    "guidance_scale": 3.5,
    "num_inference_steps": 35,
    "image_size": "landscape_16_9",  # O custom 2.39:1 para scope anamórfico
    "image_size": {"width": 1344, "height": 576}  # Scope anamórfico 2.39:1
}
```

**Template de prompt cinematográfico:**
```text
[tipo de plano] of [sujeto/escena], [acción en tiempo presente], [entorno 
completo con atmósfera], [condición de luz específica], [tipo de lente: 
anamorphic/spherical + mm], [look de cámara: Arri/Red/35mm film], 
[color grade de referencia de película], [estado emocional de la escena].
```

**Vocabulario cinematográfico de alto impacto para Flux:**

| Término | Efecto en la imagen |
|:---|:---|
| `anamorphic lens flare` | Destellos horizontales azulados icónicos |
| `Arri Alexa color science` | Paleta de cine de Hollywood clásico |
| `shot on 35mm film, Kodak Vision3` | Grano orgánico, halos analógicos |
| `cinematic teal-orange color grade` | Look blockbuster reconocible |
| `depth of focus rack` | Sugerencia de desenfoque selectivo |
| `practical lighting only` | Luz ambiental de las fuentes reales en escena |
| `golden hour, magic hour` | Luz dorada de 20 minutos post-puesta de sol |
| `motivated lighting` | La luz proviene de fuentes visibles en la escena |
| `Dutch angle` | Cámara inclinada para tensión/desorientación |
| `tracking shot` | Sugiere movimiento de cámara |

**Ejemplo: Film Noir Moderno**
```text
Low-angle medium shot of a solitary detective in a rain-soaked trench coat 
standing under a flickering neon pharmacy sign at 3am, steam rising from 
sidewalk grates, city bokeh in background. Shot on 35mm anamorphic Panavision 
Primo, deep teal shadows with amber highlights, heavy film grain, 
classic noir motivated practical lighting, Blade Runner 2049 color aesthetic. 
Cinematic wide open aperture.
```

### 7.3 Publicidad de Producto (Product Advertising)

**Objetivo**: Imágenes de producto listas para ads, catálogos y e-commerce

**Parámetros recomendados:**
```python
{
    "model": "fal-ai/flux-pro/v1.1-ultra",  # Máximo detalle para producto
    "guidance_scale": 4.0,  # Mayor adherencia para exactitud del producto
    "num_inference_steps": 40,
    "image_size": "square_hd",  # 1:1 para e-commerce
    "seed": [fijo para consistencia de campaña]
}
```

**Las 3 Categorías de Publicidad de Producto:**

#### Categoría A: Hero Shot (Foco total en el producto)
```text
[Nombre y descripción exacta del producto] with [material/textura], 
placed on [superficie de apoyo], [elementos complementarios sutiles]. 
Three-point softbox studio lighting, [color accent de marca] rim light 
from behind. Shot from [ángulo: 45°/frontal/lateral] with [focal length]mm 
macro lens, ultra-sharp product focus, pin-sharp detail on [elemento clave], 
commercial advertising photography, pure [color] background sweep.
```

**Ejemplo Hero Shot:**
```text
A minimalist matte black aluminum water bottle with "AQUA" laser-engraved 
in sans-serif, placed upright on a polished charcoal concrete surface, 
two small water droplets on the upper body. Three-point softbox studio lighting, 
cold blue rim light from behind creating metallic edge highlights. 
Shot from 30-degree angle above with 100mm macro lens, ultra-sharp metal 
texture detail, commercial product photography, pure white gradient background. 
No reflections except intentional metallic surface.
```

#### Categoría B: Lifestyle Shot (Producto en contexto de uso)
```text
[Sujeto/usuario ideal] naturally using [producto] in [entorno aspiracional], 
[luz contextual real], [elementos de lifestyle complementarios]. 
[Focal length]mm lens, [apertura] for [bokeh/profundidad], 
[color grade de la marca], authentic candid moment, 
lifestyle advertising photography.
```

#### Categoría C: Flatlay / Still Life Editorial
```text
[Producto principal] arranged with [accesorios complementarios] and 
[elementos texturales: telas, flores, libros, etc.] on a [superficie], 
seen from directly above (bird's eye view). [Paleta de colores de marca]. 
Soft diffused overhead natural light, commercial flatlay photography, 
clean negative space, editorial composition with golden ratio placement.
```

**Trucos específicos para producto en Flux:**

1. **Materiales**: Ser hiperspecífico ("brushed 316L stainless steel" > "metal")
2. **Color Hex**: Flux entiende referencias hexadecimales ("muted sage green, #8FAF87")
3. **Superficie**: La superficie define el lujo percibido ("Calacatta marble" > "marble")
4. **Reflejos**: Especificar si quieres o no reflejos ("specular reflection on the glass cap")
5. **Escala**: Incluir objeto de referencia si es necesario ("the size of an iPhone")

---

## 8. Image-to-Image y Style Reference vía API

### Conceptos Clave

**Image-to-Image (i2i)**: Usar una imagen existente como base estructural y transformarla con un prompt nuevo. El parámetro `strength` controla qué tanto se transforma.

**Style Reference**: Usar una imagen existente como referencia de estilo/atmósfera sin copiarla literalmente (disponible en FLUX.2/Kontext; en FLUX.1 se simula con i2i + prompts descriptivos de estilo).

### Endpoint Principal: `fal-ai/flux/dev/image-to-image`

```python
import fal_client

result = fal_client.subscribe(
    "fal-ai/flux/dev/image-to-image",
    arguments={
        "image_url": "https://example.com/mi-imagen-fuente.jpg",
        "prompt": "Transform this into a dramatic noir scene with rain, teal shadows and amber highlights, cinematic 35mm film aesthetic",
        "strength": 0.75,          # 0.01-1.0 (default: 0.85)
        "num_inference_steps": 28,
        "guidance_scale": 3.5,
        "seed": 42,
        "image_size": "landscape_16_9"
    }
)

print(result["images"][0]["url"])
```

### Mapa Completo del Parámetro `strength`

| Valor `strength` | Comportamiento | Cuándo usar |
|:---|:---|:---|
| 0.1 - 0.3 | Cambios mínimos: solo color grade, textura, atmósfera | Ajustes sutiles de estilo |
| 0.4 - 0.5 | Mantiene composición y elementos principales, cambia estética | Re-styling de fotografías existentes |
| 0.6 - 0.75 | Reinterpretación significativa: mantiene el "mood" base | Sketches → fotorrealismo |
| **0.75 - 0.85** | **Balance óptimo**: libertad de creación + respeto a la estructura | **Uso general recomendado** |
| 0.85 - 0.95 | Alta creatividad; la imagen de entrada es solo una sugerencia | Transformaciones artísticas |
| 0.95 - 1.0 | Prácticamente texto→imagen con la resolución de la fuente como guía | Exploración radical |

### Casos de Uso: Image-to-Image en Producción

#### Caso 1: Transformar Sketch o Boceto en Foto Real
```python
result = fal_client.subscribe(
    "fal-ai/flux/dev/image-to-image",
    arguments={
        "image_url": "url_del_sketch.jpg",
        "prompt": "Photorealistic commercial product photography version of this design, studio lighting, white background, ultra-sharp focus",
        "strength": 0.85,  # Alta transformación, el sketch solo da la forma
        "guidance_scale": 4.0,  # Alta adherencia al prompt para fidelidad
        "num_inference_steps": 35
    }
)
```

#### Caso 2: Re-estilizar Fotografía Existente
```python
result = fal_client.subscribe(
    "fal-ai/flux/dev/image-to-image",
    arguments={
        "image_url": "url_foto_original.jpg",
        "prompt": "Same composition but in the style of Japanese film photography, Fujicolor Superia, muted greens and warm browns, slight overexposure, nostalgic 90s aesthetic",
        "strength": 0.45,  # Cambio de estilo sin alterar composición
        "guidance_scale": 3.0
    }
)
```

#### Caso 3: Product Mockup (Imagen de Producto → Contexto Lifestyle)
```python
result = fal_client.subscribe(
    "fal-ai/flux/dev/image-to-image",
    arguments={
        "image_url": "url_foto_de_producto_simple.jpg",
        "prompt": "The same product placed in an upscale lifestyle context: on a weathered oak breakfast table with morning sunlight, ceramic cup nearby, lifestyle photography, warm editorial aesthetic",
        "strength": 0.70,  # Mantiene el producto, cambia el entorno
        "guidance_scale": 3.5,
        "num_inference_steps": 30
    }
)
```

#### Caso 4: Style Reference (Emular Estética Sin Copiar)
```python
# Usar una imagen de referencia para extraer el estilo
# y aplicarlo a un contenido completamente diferente
result = fal_client.subscribe(
    "fal-ai/flux/dev/image-to-image",
    arguments={
        "image_url": "url_imagen_con_estetica_deseada.jpg",
        "prompt": "A product shot of a blue ceramic vase with the same lighting, color grade, and atmosphere as this reference image",
        "strength": 0.92,  # Alta transformación, solo toma el estilo de la referencia
        "guidance_scale": 3.5
    }
)
```

### Pasar Imagen como Base64 (Sin URL Pública)

```python
import base64
import fal_client

# Leer imagen local
with open("mi_imagen_local.jpg", "rb") as img_file:
    img_data = base64.b64encode(img_file.read()).decode("utf-8")
    
data_uri = f"data:image/jpeg;base64,{img_data}"

result = fal_client.subscribe(
    "fal-ai/flux/dev/image-to-image",
    arguments={
        "image_url": data_uri,
        "prompt": "Tu prompt aquí",
        "strength": 0.80
    }
)
```

### Flux Redux: Especialista en i2i y Variaciones

`fal-ai/flux/redux` (basado en Pro) está específicamente optimizado para:
- Crear variaciones de una imagen manteniendo el sujeto principal
- Style transfer de alta fidelidad
- Generación de múltiples ángulos de un mismo personaje/objeto

```python
result = fal_client.subscribe(
    "fal-ai/flux/redux",
    arguments={
        "image_url": "url_imagen_base.jpg",
        "prompt": "The same person from a different angle, slight smile, different background",
        "guidance_scale": 3.5,
        "num_images": 4  # Generar 4 variaciones a la vez
    }
)
```

---

## 9. Comparativa Real de Costos por Imagen

### Metodología de Cálculo

FAL.ai cobra por **megapixel (MP)** en Schnell y Dev, y por **imagen** en Pro Ultra.

```
1 megapixel = 1,000,000 pixels
1024 × 1024 = 1,048,576 pixels ≈ 1.05 MP
768 × 1024  =   786,432 pixels ≈ 0.79 MP
1024 × 576  =   589,824 pixels ≈ 0.59 MP
576 × 1024  =   589,824 pixels ≈ 0.59 MP
512 × 512   =   262,144 pixels ≈ 0.26 MP
```

### Tabla de Precios Base (Junio 2026)

| Modelo | Precio base | Unidad de cobro | Notas |
|:---|:---|:---|:---|
| **Flux.1 Schnell** | $0.003 / MP | Por megapixel | Apache 2.0, más barato del ecosistema |
| **Flux.1 Dev** | $0.025 / MP | Por megapixel | Non-commercial license |
| **Flux.1 Pro** | $0.05 / MP | Por megapixel | API commercial |
| **Flux 1.1 Pro Ultra** | $0.06 / imagen | Por imagen flat | Hasta 4MP por imagen |
| **Flux Redux (Pro)** | $0.05 / MP | Por megapixel | i2i especializado |

*Verificar precios actuales en: fal.ai/pricing — pueden variar*

### Costo Real por Resolución (Calculado)

#### Flux.1 Schnell ($0.003/MP)

| Resolución | Megapixeles | Costo/imagen | Costo 100 imgs | Costo 1,000 imgs |
|:---|:---|:---|:---|:---|
| 512×512 | 0.26 MP | **$0.00078** | $0.08 | $0.78 |
| 1024×576 (16:9) | 0.59 MP | **$0.00177** | $0.18 | $1.77 |
| 768×1024 (3:4) | 0.79 MP | **$0.00237** | $0.24 | $2.37 |
| 1024×1024 (1:1) | 1.05 MP | **$0.00315** | $0.32 | $3.15 |

#### Flux.1 Dev ($0.025/MP)

| Resolución | Megapixeles | Costo/imagen | Costo 100 imgs | Costo 1,000 imgs |
|:---|:---|:---|:---|:---|
| 512×512 | 0.26 MP | **$0.0065** | $0.65 | $6.50 |
| 1024×576 (16:9) | 0.59 MP | **$0.01475** | $1.48 | $14.75 |
| 768×1024 (3:4) | 0.79 MP | **$0.01975** | $1.98 | $19.75 |
| 1024×1024 (1:1) | 1.05 MP | **$0.02625** | $2.63 | $26.25 |

#### Flux 1.1 Pro Ultra ($0.06/imagen)

| Resolución | Megapixeles | Costo/imagen | Costo 100 imgs | Costo 1,000 imgs |
|:---|:---|:---|:---|:---|
| 1024×1024 (1:1) | 1.05 MP | **$0.06** | $6.00 | $60.00 |
| 1344×768 (16:9) | 1.03 MP | **$0.06** | $6.00 | $60.00 |
| 2048×2048 (1:1 Ultra) | 4.19 MP | **$0.06** | $6.00 | $60.00 |

*Pro Ultra es flat rate — la resolución no afecta el precio, lo cual lo hace muy rentable a resoluciones altas*

### Análisis de ROI: ¿Cuándo Cada Modelo Es Rentable?

#### Cuándo Schnell tiene sentido financiero
- Volumen alto: 10,000+ imágenes/mes → Schnell puede costar $30-315 vs $2,625+ en Dev
- Prototipado: Pruebas de prompt antes de producción final
- Contenido de red social masivo donde la velocidad > perfección
- Storyboards y previsualizaciones

#### Cuándo Dev es el punto óptimo
- Producción regular de 500-5,000 imágenes/mes
- Calidad suficiente para la mayoría de usos comerciales (90-95% de Pro)
- Necesitas LoRAs (Dev los soporta nativamen te)
- Presupuesto mensual: $50-500 USD

#### Cuándo Pro Ultra vale el costo
- Imágenes de producción final de alta resolución (lookbooks, catálogos, hero images)
- Cuando la diferencia de calidad es visible en el entregable
- Volúmenes bajos (10-100 imágenes/mes): $0.60-$6 USD
- Cuando se necesita 2K+ nativo sin upscaling

### Cálculo de Presupuesto Mensual por Caso de Uso

#### Content Creator (200 imágenes/mes, 1:1 1024px)
```
Schnell: 200 × $0.003 = $0.60/mes
Dev:     200 × $0.025 = $5.25/mes
Pro:     200 × $0.060 = $12.00/mes
```

#### Agencia de Marketing Digital (2,000 imágenes/mes, mix de resoluciones)
```
Schnell: 2,000 × $0.003 = $6.30/mes (estimado)
Dev:     2,000 × $0.025 = $52.50/mes (estimado)
Pro:     2,000 × $0.060 = $120.00/mes
```

#### E-commerce de Lujo (100 hero shots/mes, 2048px Ultra)
```
Pro Ultra: 100 × $0.06 = $6.00/mes
(vs. fotografía profesional real: $500-5,000/mes)
ROI enorme incluso al precio más alto
```

### Estrategia Híbrida Recomendada (Para Agencias/Creadores Profesionales)

```
Flujo de trabajo óptimo en costos:
1. Usar Schnell para prototipado de prompts (10-20 iteraciones por concepto)
2. Usar Dev para producción estándar (la mayoría del volumen)
3. Usar Pro Ultra solo para entregables finales y hero images

Resultado: ~85% ahorro vs. usar Pro Ultra en todo el flujo
```

---

## 10. Endpoints de Referencia Rápida

### Tabla Master de Endpoints FAL.ai para Flux

| Endpoint ID | Modelo Base | Uso | Soporta LoRA | Soporta i2i | Precio |
|:---|:---|:---|:---|:---|:---|
| `fal-ai/flux/schnell` | Flux.1 Schnell | Generación rápida | ❌ | ❌ | $0.003/MP |
| `fal-ai/flux/dev` | Flux.1 Dev | Generación estándar | ❌ | ❌ | $0.025/MP |
| `fal-ai/flux-lora` | Flux.1 Dev | LoRA inference | ✅ | ❌ | $0.025/MP |
| `fal-ai/flux/dev/image-to-image` | Flux.1 Dev | i2i y style transfer | ❌ | ✅ | $0.025/MP |
| `fal-ai/flux-pro` | Flux.1 Pro | Producción comercial | ❌ | ❌ | $0.05/MP |
| `fal-ai/flux-pro/v1.1-ultra` | Flux 1.1 Pro Ultra | Máxima calidad + 4MP | ❌ | ❌ | $0.06/img |
| `fal-ai/flux/redux` | Flux Redux | Variaciones + i2i Pro | ❌ | ✅ | $0.05/MP |
| `fal-ai/flux-lora-fast-training` | Flux.1 Dev | Entrenamiento LoRA | N/A | N/A | Por compute |

### Instalación del Cliente

```bash
pip install fal-client
```

```python
import os
os.environ["FAL_KEY"] = "tu-api-key-aqui"  # O usar .env

# Obtener API key en: https://fal.ai/dashboard/keys
```

### Quick Start: Generación Básica (3 Líneas)

```python
import fal_client
result = fal_client.run("fal-ai/flux/dev", arguments={"prompt": "A professional product shot of a ceramic coffee mug on white marble, studio lighting"})
print(result["images"][0]["url"])
```

### Quick Start: Generación con Todos los Parámetros

```python
import fal_client

result = fal_client.subscribe(
    "fal-ai/flux/dev",
    arguments={
        "prompt": "A confident 30-year-old woman with natural makeup, wearing a tailored linen blazer, making warm eye contact with the camera. Shot in a sunlit modern studio, 85mm lens at f/2.0, shallow depth of field, Kodak Portra color grade.",
        "image_size": "portrait_4_3",
        "num_inference_steps": 28,
        "guidance_scale": 3.5,
        "num_images": 4,
        "seed": 12345678,
        "enable_safety_checker": True,
        "output_format": "jpeg"
    },
    with_logs=True,
    on_queue_update=lambda u: print(f"Status: {u.status}")
)

for img in result["images"]:
    print(f"URL: {img['url']} | Size: {img['width']}x{img['height']}")
```

---

## Resumen Ejecutivo

### Reglas de Oro para Flux en FAL.ai

> **1. Escribe prosa, no keywords.** Flux entiende lenguaje humano. Describe la escena como se la describirías a un fotógrafo profesional.

> **2. Front-load el sujeto principal.** Lo primero en el prompt tiene mayor peso semántico. Siempre empieza con el elemento más importante.

> **3. Guidance scale bajo = mejores resultados.** 3.5 es el sweet spot. Arriba de 5 aparecen artefactos. Nunca uses valores > 7.

> **4. Nunca uses negative_prompt.** No existe. Reformula en positivo: "sharp focus" en vez de "no blur".

> **5. Dev con LoRA = mejor calidad/precio para producción.** El 90-95% de la calidad de Pro Ultra al 40% del costo.

> **6. Style Lock = seed fijo + prompt template + params fijos.** La fórmula para series coherentes.

> **7. Verifica precios antes de escalar.** Los precios en FAL.ai pueden actualizarse. Siempre consulta fal.ai/pricing para costos actuales.

### Árbol de Decisión: ¿Qué Modelo Usar?

```
¿Necesitas el resultado en < 3 segundos?
├── SÍ → Flux Schnell ($0.003/MP)
└── NO ↓

¿Necesitas LoRAs o customización?
├── SÍ → Flux Dev + fal-ai/flux-lora ($0.025/MP)
└── NO ↓

¿Es un entregable final de máxima calidad?
├── SÍ → ¿Necesitas > 1024px?
│   ├── SÍ → Flux 1.1 Pro Ultra ($0.06/img)
│   └── NO → Flux Pro ($0.05/MP)
└── NO → Flux Dev ($0.025/MP)
```

---

*Investigación generada el 2026-06-06. Los modelos y precios de FAL.ai pueden actualizarse. Verificar siempre en [fal.ai](https://fal.ai) antes de implementar en producción.*

#flux #fal-ai #generacion-imagenes #prompt-engineering #lora #api #fotografía-profesional
