---
tags: [gpt-image-1, chatgpt-images, openai, prompt-engineering, image-generation, ai-art, brand-content, social-media]
created: 2026-06-06
version: 1.0
topic: GPT-Image-1 (ChatGPT Images 2) — Guia de Referencia Tecnica Definitiva
---

# ChatGPT Images 2 (GPT-Image-1): Guia de Referencia Tecnica para Creadores y Marcas

> [!NOTE]
> **Base de Conocimiento para Creadores de Contenido y Directores de Arte**
> Esta guia cubre en profundidad el motor GPT-Image-1 de OpenAI: sus capacidades unicas, la estructura optima de prompts en lenguaje natural, parametros de API, y una biblioteca de prompts comentados para contenido de marca y social media. Disenada para creadores latinoamericanos que buscan dominar este modelo frente a la competencia.

---

## Tabla de Contenidos

1. [Arquitectura y Capacidades Unicas](#1-arquitectura-y-capacidades-unicas)
2. [Estructura Optima de Prompts](#2-estructura-optima-de-prompts)
3. [Contexto Narrativo para Storyboards](#3-contexto-narrativo-para-storyboards)
4. [Imagenes de Referencia para Consistencia](#4-imagenes-de-referencia-para-consistencia)
5. [Parametros de API — Referencia Tecnica Completa](#5-parametros-de-api--referencia-tecnica-completa)
6. [Casos de Uso: Donde Supera y Donde Falla](#6-casos-de-uso-donde-supera-y-donde-falla)
7. [Mejores Practicas por Direccion Visual](#7-mejores-practicas-por-direccion-visual)
8. [Biblioteca de 10 Prompts Comentados](#8-biblioteca-de-10-prompts-comentados)

---

## 1. Arquitectura y Capacidades Unicas

### 1.1 Que es GPT-Image-1?

**GPT-Image-1** (comercializado como 'ChatGPT Images 2') es el primer modelo de generacion de imagenes verdaderamente nativo y multimodal de OpenAI. Lanzado en 2025, representa un salto arquitectonico radical respecto a DALL-E 3: mientras que DALL-E era un modelo de difusion conectado externamente al LLM de GPT, GPT-Image-1 es un **modelo autoregresivo unificado** que trata la generacion de imagenes como una extension del mismo proceso de prediccion de tokens de lenguaje.

**Linea de tiempo evolutiva de OpenAI en generacion de imagenes:**

| Modelo | Anio | Arquitectura | Caracteristica Principal |
| :--- | :--- | :--- | :--- |
| DALL-E 2 | 2022 | Difusion (CLIP) | Primera generacion viable, consistencia limitada |
| DALL-E 3 | 2023 | Difusion mejorada + GPT-4 | Mejor adherencia al prompt, ChatGPT integrado |
| GPT-Image-1 | 2025 | Autoregresivo multimodal | Instrucciones complejas, texto nativo, edicion |
| GPT-Image-2 | 2026 | Autoregresivo + reasoning | Alta fidelidad, 4K, multi-turno, modelo actual flagship |

> [!IMPORTANT]
> **Nota de contexto temporal:** GPT-Image-2 es el modelo actual de OpenAI (2026). GPT-Image-1 es su predecesor directo. Esta guia cubre GPT-Image-1 en profundidad porque sus principios de prompting son fundamentalmente los mismos para GPT-Image-2, y muchos usuarios aun trabajan con el o lo referencian en tutoriales activos. DALL-E 2 y DALL-E 3 fueron retirados de la API de OpenAI en mayo de 2026.

---

### 1.2 Diferencias Tecnicas Clave vs. DALL-E 3

La diferencia mas importante no es visual, sino **arquitectonica**: GPT-Image-1 es el primero en existir dentro del mismo espacio latente del lenguaje, no como un modulo externo.

| Dimension | DALL-E 3 | GPT-Image-1 |
| :--- | :--- | :--- |
| **Arquitectura** | Difusion + GPT-4 como traductor de prompts | Autoregresivo nativo multimodal |
| **Instrucciones complejas** | Buena, pero con limites en multi-condicion | Excelente — interpreta oraciones complejas como lo hace con texto |
| **Texto en imagen** | Problematico, frecuentes errores tipograficos | Sobresaliente — texto legible, bien kerneado, con multiples fuentes |
| **Edicion inpainting** | Basica con endpoint separado | Nativa e integrada en el flujo conversacional |
| **Consistencia narrativa** | Limitada — cada imagen es aislada | Alta — puede mantener coherencia visual entre iteraciones |
| **Comprension de contexto** | El LLM parafrasea el prompt antes de enviarlo a difusion | El modelo razona directamente sobre el prompt sin capa intermedia |
| **Imagenes de referencia** | Limitadas como guia de estilo | Soportadas como ancla de identidad visual |

---

### 1.3 Las 5 Capacidades Unicas de GPT-Image-1

#### Capacidad 1: Seguimiento de Instrucciones Complejas (Complex Instruction Following)

GPT-Image-1 es actualmente el **modelo mas capaz en seguimiento literal de instrucciones** de todos los generadores de imagenes disponibles. Puede interpretar condiciones multiples, restricciones simultaneas, y especificaciones de posicion/composicion con una precision que ningun modelo de difusion puede igualar.

**Ejemplo de instruccion compleja que GPT-Image-1 maneja correctamente:**

> *"Muestra una mesa de madera roble natural con tres productos de skincare alineados de izquierda a derecha: un serum azul translucido en vidrio, una crema blanca en tarro de vidrio con tapa dorada, y una mascarilla en tubo rosa. La iluminacion viene del lado izquierdo, calida y suave. El fondo es blanco puro. Deja espacio en la parte superior derecha para superponer texto."*

Un modelo de difusion como Stable Diffusion o Flux necesitaria multiples intentos para respetar el orden, la posicion de la luz, y el espacio para texto simultaneamente. GPT-Image-1 lo interpreta como una oracion natural y lo ejecuta con alta fidelidad.

**Por que logra esto?** Su arquitectura autoregresiva le permite 'razonar' sobre la instruccion antes de generar, de la misma manera que un LLM descompone una tarea compleja en pasos.

---

#### Capacidad 2: Texto en Imagen (Tipografia Integrada)

Esta es la ventaja mas visible y decisiva de GPT-Image-1 sobre cualquier competidor. Puede generar:

- **Palabras y frases legibles** en cualquier posicion de la imagen
- **Multiples tamanios y pesos tipograficos** en la misma imagen
- **Texto curvado, rotado, o en perspectiva**
- **Logotipos basados en texto** con consistencia alta
- **Titulos de portada, carteles, etiquetas de producto** con texto correcto
- **UI/UX mockups** con etiquetas, botones, y contenido de texto realista
- **Infografias** con datos textuales legibles

**Regla de oro para texto en imagen:**
Encierra el texto deseado entre comillas dentro del prompt. Ejemplo:

```
Disenia el cartel de un evento de marketing con el titulo "FLUIA SUMMIT 2025"
en tipografia sans-serif negrita, un subtitulo mas pequenio "El futuro de la IA
para negocios" y la fecha "15 de noviembre" en la esquina inferior derecha.
```

**Comparativa directa: Texto en imagen**

| Modelo | Legibilidad | Errores tipograficos | Texto multiple |
| :--- | :--- | :--- | :--- |
| **GPT-Image-1** | Excelente (5/5) | Raro (< 5% de veces) | Si, nativo |
| Ideogram v2 | Muy bueno (4/5) | Ocasional | Si, especializado |
| Flux.1 Pro | Bueno (3/5) | Frecuente en oraciones | Parcial |
| Midjourney v7 | Regular (2/5) | Muy frecuente | Limitado |
| Stable Diffusion 3.5 | Regular (2/5) | Muy frecuente | Limitado |

---

#### Capacidad 3: Edicion Inpainting y Outpainting Nativa

GPT-Image-1 soporta edicion no destructiva de imagenes mediante el endpoint `images/edits`:

- **Inpainting:** Repintar una zona especifica de una imagen existente usando una mascara PNG
- **Outpainting:** Extender los bordes de una imagen para ampliar el encuadre
- **Edicion conversacional:** Via la API de Responses, editar iterativamente en lenguaje natural sin mascaras manuales

**Flujo de inpainting basico:**
1. Imagen original (PNG, RGBA)
2. Mascara (PNG con transparencia en zonas a editar, blanco en zonas a preservar)
3. Prompt describiendo que debe aparecer en la zona enmascarada
4. Call al endpoint `POST /v1/images/edits`

**Casos de uso ideales para inpainting:**
- Cambiar el fondo de una foto de producto manteniendo el producto intacto
- Corregir elementos especificos (un letrero con texto erroneo)
- Anadir/quitar personas en una escena
- Adaptar imagenes a diferentes aspectos de ratio para distintas plataformas

---

#### Capacidad 4: Comprension de Contexto Narrativo

GPT-Image-1 puede mantener **coherencia narrativa** entre multiples imagenes de una secuencia, siempre que el contexto se proporcione adecuadamente en cada prompt. Esta capacidad lo hace superior para storyboards y series de contenido (ver Seccion 3).

---

#### Capacidad 5: Uso de Imagenes de Referencia

A traves de la API, GPT-Image-1 puede recibir imagenes como entrada para:
- Mantener la identidad de un personaje o producto
- Transferir estilos visuales de referencia
- Hacer variaciones coherentes de una imagen base

Ver Seccion 4 para el flujo tecnico completo.

---

### 1.4 Limitaciones Documentadas

**Lo que GPT-Image-1 NO hace bien:**

1. **Fotorrealismo de piel ultra-detallado:** La textura organica de piel humana, poros visibles, y cabello fino son mas creibles en Flux.1 y Stable Diffusion 3.5.
2. **Consistencia hiper-precisa de personajes:** Midjourney tiene `--cref` (Character Reference) que ancla identidad fisica de manera mas robusta. GPT-Image-1 no tiene un equivalente nativo.
3. **Renders 3D de ingenieria:** Para renders arquitectonicos o de producto con precision fisica (reflexiones, refracciones), V-Ray, OctaneRender o Blender son superiores.
4. **Estilos artisticos ultraespecificos:** Imitar fielmente el estilo de un artista o movimiento pictorico especifico es mas potente en Midjourney.
5. **Escenas con muchas personas en accion:** Grupos grandes con anatomia correcta en poses dinamicas aun producen artefactos.
6. **Inpainting en areas muy pequenias:** Mascaras de menos del 5% del area total pueden generar resultados inconsistentes.

---

## 2. Estructura Optima de Prompts

### 2.1 El Principio Fundamental: Lenguaje Natural vs. Token Soup

**La diferencia mas critica entre GPT-Image-1 y modelos de difusion es como procesa el prompt:**

| Modelo | Como procesa el prompt | Estilo optimo de prompt |
| :--- | :--- | :--- |
| Midjourney | Lista de tokens con pesos implicitos | `beautiful woman, golden hour, cinematic, 85mm, f/1.4, bokeh --ar 9:16` |
| Stable Diffusion | Embeddings de tokens, keyword soup | `(hyperrealistic:1.4), (photorealistic:1.2), woman, golden hour...` |
| Flux.1 | Intermedio — acepta bien prosa y tokens | Mixto — prosa descriptiva con terminos tecnicos |
| **GPT-Image-1** | **Comprension semantica completa de oraciones** | **Parrafos descriptivos en lenguaje natural** |

**Prompt estilo difusion (suboptimo para GPT-Image-1):**
```
beautiful latina entrepreneur, office background, natural light, 85mm, bokeh,
professional, confident, warm tones, high quality, 4k
```

**Prompt estilo lenguaje natural (optimo para GPT-Image-1):**
```
Una fotografia profesional de una empresaria latina de unos 32 anios,
con expresion de confianza y una sonrisa calida. Esta sentada en una oficina
ejecutiva moderna con luz natural suave que entra por ventanas a su izquierda.
El fondo esta ligeramente desenfocado mostrando un espacio de trabajo minimalista.
La imagen tiene tonos calidos y una estetica editorial de negocios premium.
```

---

### 2.2 Anatomia del Prompt Perfecto para GPT-Image-1

El prompt optimo se construye con 5 elementos en lenguaje natural:

```
[TIPO DE IMAGEN] + [SUJETO DETALLADO] + [ACCION/POSE] + [ENTORNO/LUZ] + [ESTETICA/TONO]
```

#### Elemento 1: Tipo de Imagen (Medium)

Inicia el prompt declarando explicitamente que tipo de imagen quieres.

| Declaracion de tipo | Efecto en el modelo |
| :--- | :--- |
| `Una fotografia profesional de...` | Activa registro fotorrealista con profundidad de campo |
| `Una ilustracion 3D al estilo Pixar de...` | Activa estetica de animacion con volumenes suaves |
| `Un render comercial de producto de...` | Activa fondo neutro, iluminacion de estudio, foco preciso |
| `Un diseno grafico flat de...` | Activa estetica vectorial, colores planos, limpieza |
| `Una imagen cinematografica de...` | Activa paleta de cine, grano, composicion dramatica |
| `Un cartel con el texto "..."` | Activa generacion de texto tipografico legible |
| `Un mockup de interfaz de usuario que muestra...` | Activa representacion de pantallas y UI |

#### Elemento 2: Sujeto Detallado

Describe el sujeto con especificidad: edad aproximada, rasgos, vestimenta, expresion.

**Formula:** `[persona/objeto] + [descriptores fisicos clave] + [vestimenta/apariencia] + [expresion emocional]`

```
una mujer latina de aproximadamente 28 anios, piel morena clara, cabello oscuro
liso recogido, con blazer beige y camisa blanca, transmitiendo calma y autoridad
```

#### Elemento 3: Accion y Pose

```
esta mirando directamente a la camara con una sonrisa suave,
con las manos apoyadas sobre un escritorio de madera, en plano medio
```

#### Elemento 4: Entorno e Iluminacion

```
el entorno es una oficina minimalista nordica con plantas de interior,
iluminada por luz natural suave que entra desde la izquierda a traves de
una ventana grande, creando sombras suaves y un ambiente calido
```

#### Elemento 5: Estetica y Tono

```
la imagen tiene una estetica editorial premium, paleta de tonos calidos
tierra y beige, fotorrealista con la calidad de una campana de marca
de lujo accesible
```

---

### 2.3 Nivel de Detalle: Cuando Mas es Mas y Cuando Menos es Mas

**Agrega mas detalle cuando:**
- Necesitas una composicion especifica con multiples elementos posicionados
- El texto en imagen debe ser exacto
- El estilo visual necesita referenciar algo muy especifico
- Estas editando una imagen existente (inpainting)

**Usa prompts mas cortos cuando:**
- Quieres que el modelo sorprenda con creatividad
- El concepto es simple y no tiene restricciones de composicion
- Estas en fase de exploracion de estilos

**Regla practica:** Para contenido de marca y social media profesional, entre 3 y 6 oraciones descriptivas es el rango optimo.

---

### 2.4 Como Manejar Elementos No Deseados (Sin Negative Prompts)

GPT-Image-1 **no tiene campo de negative prompt nativo**. Para controlar elementos no deseados, usa lenguaje negativo dentro del prompt positivo:

| Elemento a evitar | Como decirlo en el prompt |
| :--- | :--- |
| Fondo desordenado | `fondo limpio y minimalista, sin objetos que distraigan` |
| Texto en la imagen | `imagen completamente limpia, sin texto ni watermarks` |
| Luz dura/sombras fuertes | `iluminacion suave y difusa, sin sombras duras` |
| Apariencia artificial | `aspecto fotorrealista y autentico, no generado por computadora` |
| Marcas visibles | `sin logos, marcas ni elementos corporativos identificables` |
| Anatomia rota | `anatomia perfectamente correcta, manos y dedos bien formados` |
| Colores saturados en exceso | `paleta de colores naturales y moderados, sin saturacion excesiva` |

---

### 2.5 Comparativa: Prompts DALL-E 3 vs. GPT-Image-1

| Aspecto | DALL-E 3 | GPT-Image-1 |
| :--- | :--- | :--- |
| **Longitud optima** | 1-2 oraciones (el LLM amplia automaticamente) | 3-6 oraciones de detalle directo |
| **Sintaxis** | Natural pero el modelo reescribe el prompt | Natural y respetado tal como se escribe |
| **Parametros tecnicos** | Se mencionan en el prompt como texto | Se mencionan en el prompt O en parametros API |
| **Texto en imagen** | Usar comillas, puede fallar | Usar comillas, funciona consistentemente |
| **Creatividad del modelo** | Alta — el LLM aniade detalles creativos | Moderada — respeta mas literalmente el prompt |

---

## 3. Contexto Narrativo para Storyboards

### 3.1 Por Que GPT-Image-1 es Superior para Storyboarding

Los modelos de difusion (Midjourney, Stable Diffusion, Flux) generan cada imagen de forma completamente independiente. Para storyboards, esto significa que el personaje puede cambiar radicalmente entre frames si no se ancla manualmente.

GPT-Image-1 tiene ventajas unicas para secuencias narrativas:

1. **Comprende la logica de la narrativa** — puede interpretar "en la siguiente escena" o "despues de que el personaje llega al trabajo"
2. **Acepta contexto de escenas anteriores como texto** para mantener coherencia
3. **Via la API de Responses,** puede hacer edicion multi-turno conversacional, manteniendo el contexto de la sesion
4. **Su comprension de texto le permite procesar briefs narrativos complejos** (documentos completos de guion)

---

### 3.2 Tecnica 1: El Brief Maestro de Personaje

Antes de generar cualquier escena, crea un "Character Bible" en texto y usalo como preambulo en cada prompt de storyboard:

```
PERSONAJE: Marco, emprendedor latinoamericano de 35 anios. Fisico: piel
morena, cabello negro corto con algo de sal y pimienta en las sienes,
complexion atletica, aproximadamente 1.80m. Vestimenta caracteristica:
siempre usa una camisa de lino azul marino sin corbata, pantalon gris
marengo, y zapatos oxford marron claro. Expresion predominante: seria
pero accesible, con una sonrisa media que transmite confianza.

ESCENA 1: [descripcion de la primera escena]
```

---

### 3.3 Tecnica 2: Estructura de Prompt para Secuencias

Para cada frame del storyboard, usa esta estructura:

```
[BRIEF MAESTRO DEL PERSONAJE] + [CONTEXTO DE LA ESCENA] + [ACCION ESPECIFICA] +
[ANGULO DE CAMARA] + [ESTADO EMOCIONAL EN ESTE MOMENTO DE LA HISTORIA]
```

**Ejemplo aplicado — Storyboard publicitario de 3 frames para una app de finanzas:**

**Frame 1 (El Dolor):**
```
Marco, 35 anios, camisa azul marino, cabello negro con canas en sienes,
complexion atletica. ESCENA: Esta sentado en su escritorio a las 11pm,
con la cabeza apoyada en una mano mirando una laptop que muestra graficas
rojas descendentes. La habitacion esta iluminada solo por la pantalla.
Expresion de agotamiento y preocupacion. Plano medio, lente de 50mm,
fotografia realista de alta calidad.
```

**Frame 2 (El Descubrimiento):**
```
Marco, 35 anios, camisa azul marino, cabello negro con canas en sienes,
complexion atletica. ESCENA: Al dia siguiente, en una cafeteria iluminada
con luz natural de maniana. Marco descubre una app en su smartphone con
ojos abiertos de sorpresa y una sonrisa que empieza a formarse. La pantalla
del telefono refleja suavemente en su cara. Plano americano, lente de
50mm, estetica de fotografia de estilo de vida premium.
```

**Frame 3 (La Solucion):**
```
Marco, 35 anios, camisa azul marino, cabello negro con canas en sienes,
complexion atletica. ESCENA: Tres semanas despues, en una terraza soleada
con vista a la ciudad. Marco con los brazos abiertos en postura de
celebracion mirando el horizonte, sonrisa amplia, postura relajada y
victoriosa. Luz de tarde dorada. Plano general, estetica de fotografia
editorial aspiracional de marca premium.
```

---

### 3.4 Tecnica 3: Camara como Narrativa

| Momento narrativo | Angulo recomendado | Como escribirlo en el prompt |
| :--- | :--- | :--- |
| Presentar personaje principal | Plano medio frontal | `plano medio, a la altura de los ojos del personaje` |
| Mostrar problema/dolor | Primer plano | `primer plano en el rostro con expresion preocupada` |
| Accion dinamica | Angulo bajo (contra-picado) | `tomado desde abajo en ligero contrapicado, transmitiendo energia` |
| Revelacion o descubrimiento | Plano medio sobre el hombro | `toma sobre el hombro derecho del personaje, viendo lo que el ve` |
| Climax emocional | Primer plano de ojos | `primer plano en los ojos del personaje, capturando la emocion` |
| Epilogo / Resolucion | Plano general | `plano general mostrando al personaje en contexto amplio y victorioso` |

---

### 3.5 Casos de Uso para Storyboards con GPT-Image-1

| Tipo de Storyboard | Descripcion | Por que GPT-Image-1 |
| :--- | :--- | :--- |
| **Publicidad narrativa** | Serie de 3-6 imagenes que cuentan la historia del cliente | Comprende el arco emocional descrito en texto |
| **Explainer visual** | Pasos de un proceso o tutorial visual | Puede representar interfaces, pantallas y texto legible |
| **Serie de contenido para redes** | Carrusel de Instagram con historia conectada | Mantiene estilo visual consistente con Brief Maestro |
| **Campanas de email** | Header + seccion visual coherente | Reproduce elementos de marca con texto preciso |
| **Pitch deck visual** | Slides con ilustraciones narrativas | Genera mockups y graficos con texto correcto |

---

## 4. Imagenes de Referencia para Consistencia

### 4.1 Como Funciona la Referencia de Imagen en la API

GPT-Image-1 acepta imagenes como entrada a traves de dos mecanismos:

**Mecanismo A: Endpoint de Edicion (`images/edits`)**
- Ideal para: Modificar una imagen existente manteniendo su esencia
- Input: Imagen original + mascara opcional + prompt de edicion
- Use case: Cambiar el fondo de una foto de producto, corregir elementos

**Mecanismo B: API de Responses (multi-turno)**
- Ideal para: Flujos conversacionales donde se itera sobre imagenes
- Input: File ID de la imagen + mensaje de texto
- Use case: "Basandote en esta imagen del personaje, genera la siguiente escena donde..."
- Ventaja: Mantiene el contexto de la imagen en toda la sesion

---

### 4.2 Tecnica de Character Sheet para Consistencia

**Paso 1: Generar el Character Sheet**
```
Crea un character sheet de diseno de personaje para animacion que muestre
a "Maria", una mujer latina de 38 anios, cabello ondulado oscuro hasta los
hombros con mechon rojo, piel morena media, ojos marrones, complexion
atletica media. Muestramela en 4 vistas: frontal, perfil derecho, tres
cuartos, y espalda. Viste: jeans azul oscuro, sueter verde esmeralda,
zapatillas blancas. Estilo de ilustracion limpio, fondo blanco.
```

**Paso 2: Usar el Character Sheet como referencia**
```python
from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-image-1",
    input=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": "URL_DEL_CHARACTER_SHEET"}
                },
                {
                    "type": "text",
                    "text": "Usando el personaje Maria de esta hoja de referencia, genera una imagen donde ella esta sentada en una cafeteria moderna. Mantén su apariencia: cabello ondulado oscuro con mechon rojo, sueter verde esmeralda, piel morena media. Fotografia estilo lifestyle, luz natural calida."
                }
            ]
        }
    ]
)
```

---

### 4.3 Consistencia de Producto para E-commerce y Branding

**Paso 1: Foto maestra del producto**
- Fotografia real del producto o render inicial aprobado
- Alta resolucion, fondo blanco, iluminacion neutral

**Paso 2: Variaciones contextuales con referencia**
```
Basandote en el producto de la imagen adjunta (botella de vidrio ambar con
tapa dorada y etiqueta blanca con tipografia serif), genera una fotografia
de estilo de vida donde la botella esta sobre una repisa de marmol blanco
en un banio lujoso con plantas, luz natural de ventana lateral.
Mantén exactamente la forma, color y diseno de la botella como en la referencia.
```

**Paso 3: Batch de assets con variaciones**
- Version de estudio (fondo blanco, e-commerce)
- Version lifestyle (en contexto de uso)
- Version social media (formato vertical, ambiente)
- Version editorial (composicion artistica premium)

---

### 4.4 Limitaciones vs. Midjourney con --cref

| Caracteristica | GPT-Image-1 (referencia de imagen) | Midjourney (--cref) |
| :--- | :--- | :--- |
| **Anclaje de rostro** | Bueno, especialmente con prompt detallado | Excelente — muy preciso en rasgos faciales |
| **Consistencia de vestimenta** | Moderado — describe en prompt para reforzar | Bueno — captura detalles de ropa de la ref |
| **Tipo de acceso** | API programatica, File ID | Comando de chat |
| **Multi-personaje** | Mas dificil, requiere character sheets por personaje | --cref por personaje en escena |
| **Integracion flujo de trabajo** | Muy alta — integrable en pipelines automatizados | Manual, via ChatGPT/MJ interface |

**Veredicto:** Para consistencia de producto (no personas), GPT-Image-1 es igual o mejor que Midjourney. Para consistencia de personaje humano con rasgos faciales muy especificos, Midjourney --cref sigue siendo mas preciso.

---

## 5. Parametros de API — Referencia Tecnica Completa

### 5.1 Endpoints Disponibles

```
POST /v1/images/generations  -> Generar imagen desde prompt
POST /v1/images/edits        -> Editar imagen existente (inpainting/variaciones)
POST /v1/responses           -> Flujo multi-turno conversacional con imagenes
```

---

### 5.2 Parametro: `model`

```json
"model": "gpt-image-1"
```

| Valor | Descripcion | Cuando usar |
| :--- | :--- | :--- |
| `gpt-image-1` | Modelo estable de referencia (esta guia) | Produccion estable, costos predecibles |
| `gpt-image-2` | Flagship actual (2026) — mayor fidelidad y 4K | Maxima calidad, storyboards avanzados |
| `gpt-image-1-mini` | Version reducida, mayor velocidad y menor costo | Iteracion rapida, prototipos, alta demanda |

---

### 5.3 Parametro: `quality`

```json
"quality": "high"
```

| Valor | Calidad visual | Velocidad | Costo relativo | Cuando usar |
| :--- | :--- | :--- | :--- | :--- |
| `low` | Basica — apta para wireframes o bocetos | Mas rapida | Bajo | Iteracion rapida, prueba de conceptos |
| `medium` | Buena — apta para uso interno y drafts | Media | Medio | Aprobaciones internas, variaciones |
| `high` | Excelente — calidad de produccion | Mas lenta | Alto | Entregables finales, campanas, publicacion |

> [!TIP]
> Para estilos minimalistas o flat design, `quality: "medium"` puede producir resultados mas limpios que `quality: "high"` porque el modelo no sobre-trabaja los detalles. Usa `high` para fotografia realista y 3D.

---

### 5.4 Parametro: `size`

```json
"size": "1024x1024"
```

| Valor | Formato | Ratio | Uso ideal |
| :--- | :--- | :--- | :--- |
| `1024x1024` | Cuadrado | 1:1 | Instagram feed, carruseles, thumbnails |
| `1024x1536` | Vertical | 2:3 | Stories, TikTok, Reels, Pinterest |
| `1536x1024` | Horizontal | 3:2 | YouTube thumbnails, banners web, LinkedIn |

> [!IMPORTANT]
> GPT-Image-1 NO soporta resoluciones arbitrarias. GPT-Image-2 si puede generar hasta 4K con multiples de 16px. Para aspectos no disponibles como 4:5 o 16:9, menciona la composicion en el prompt: 'Centra la composicion con margen libre en los costados para formato 16:9'.

---

### 5.5 Parametro: `style`

```json
"style": "vivid"
```

> [!NOTE]
> El parametro `style` fue introducido en DALL-E 3. En GPT-Image-1, el control de estilo mediante el prompt en lenguaje natural es mas efectivo que este parametro.

| Valor | Efecto | Cuando usar |
| :--- | :--- | :--- |
| `vivid` | Colores mas saturados, contraste elevado, dramatico | Contenido de impacto visual, social media, ads de conversion |
| `natural` | Colores mas neutrales, apariencia fotografica organica | Fotografia de lifestyle, contenido autentico UGC, retratos |

---

### 5.6 Parametro: `n`

```json
"n": 1
```

| Valor | Comportamiento | Consideracion de costo |
| :--- | :--- | :--- |
| `1` | Una imagen | Costo base |
| `2-4` | Multiples variaciones simultaneas | Costo x n imagenes |

> [!CAUTION]
> El costo escala linealmente con `n`. `n=4` con `quality="high"` cuesta 4x mas que `n=1`. Usa `n>1` solo cuando necesitas variaciones simultaneas para A/B testing.

---

### 5.7 Parametro: `response_format`

```json
"response_format": "url"
```

| Valor | Descripcion | Cuando usar |
| :--- | :--- | :--- |
| `url` | Devuelve una URL temporal de la imagen | Previsualizacion rapida, testing |
| `b64_json` | Devuelve la imagen codificada en Base64 | Almacenamiento permanente, pipelines de produccion |

> [!WARNING]
> Las URLs devueltas con `response_format: "url"` tienen **vida util limitada** (tipicamente 1 hora antes de expirar). Para almacenamiento permanente en produccion, siempre usa `response_format: "b64_json"` y guarda el archivo localmente o en un bucket de almacenamiento.

---

### 5.8 Parametros Adicionales

#### `background`
```json
"background": "transparent"
```
| Valor | Efecto |
| :--- | :--- |
| `opaque` | Fondo solido (default) |
| `transparent` | Fondo transparente (PNG con canal alfa) |
| `auto` | El modelo decide segun el prompt |

#### `moderation`
```json
"moderation": "auto"
```
| Valor | Efecto |
| :--- | :--- |
| `auto` | Filtros de contenido estandar de OpenAI (default) |
| `low` | Filtros menos restrictivos — solo para cuentas verificadas |

#### `user`
```json
"user": "user_id_12345"
```
Un identificador unico de tu usuario para tracking de uso. OpenAI recomienda siempre incluirlo en produccion.

---

### 5.9 Ejemplo Completo de Llamada a la API

```python
from openai import OpenAI
import base64

client = OpenAI(api_key="tu_api_key")

response = client.images.generate(
    model="gpt-image-1",
    prompt=(
        "Una fotografia de producto premium de un suero facial en frasco "
        "de vidrio ambar con cuentagotas de madera, colocado sobre marmol blanco "
        "veteado con petalos de rosa. Iluminacion suave difusa desde arriba, "
        "fondo blanco limpio. Estetica de marca de skincare de lujo. Sin texto."
    ),
    quality="high",
    size="1024x1024",
    style="natural",
    n=1,
    response_format="b64_json",
    user="cliente_marca_001"
)

image_data = base64.b64decode(response.data[0].b64_json)
with open("producto_skincare.png", "wb") as f:
    f.write(image_data)

print("Imagen generada y guardada exitosamente.")
```

---

### 5.10 Costos de Referencia

| Calidad | Costo aproximado por imagen | Contexto |
| :--- | :--- | :--- |
| `low` | $0.01 - $0.02 / imagen | Exploracion y borradores |
| `medium` | $0.04 - $0.06 / imagen | Punto optimo costo-calidad |
| `high` | $0.10 - $0.20 / imagen | Calidad de publicacion |

> [!NOTE]
> Los precios exactos actualizados deben consultarse en `openai.com/api/pricing`. El pricing cambia con la evolucion del modelo.

---

## 6. Casos de Uso: Donde Supera y Donde Falla

### 6.1 Donde GPT-Image-1 es Imbatible

| Caso de Uso | Por que GPT-Image-1 gana | Prompt clave |
| :--- | :--- | :--- |
| **Carteles con texto legible** | Texto correcto en 95%+ de generaciones | `"Incluye el texto [TEXTO] en tipografia [ESTILO]"` |
| **Mockups de UI/UX** | Puede generar pantallas con UI coherente y texto | `"Interfaz de app movil que muestra..."` |
| **Infografias con datos** | Texto y numeros legibles en contexto visual | `"Infografia que explica con el texto exacto..."` |
| **Portadas de revistas/libros** | Titulo y subtitulo legibles con composicion editorial | `"Portada de revista con el titular..."` |
| **Etiquetas de producto** | Texto de etiqueta integrado en el producto | `"Botella con etiqueta que dice exactamente..."` |
| **Storyboards narrativos** | Comprende arcos de historia y coherencia de personajes | Brief Maestro de Personaje + escena contextual |
| **Instrucciones multi-condicion** | Sigue multiples restricciones simultaneas | Prompts en lenguaje natural complejo |
| **Edicion iterativa** | Via API de Responses, edicion conversacional multi-turno | Input de imagen + instruccion de cambio |

---

### 6.2 Donde GPT-Image-1 Falla o es Inferior

| Caso de Uso | Por que falla | Alternativa recomendada |
| :--- | :--- | :--- |
| **Fotorrealismo de piel ultra-detallado** | Look ligeramente "digital", poros y textura menos organica | Flux.1 Pro, Stable Diffusion 3.5 |
| **Consistencia facial hiper-precisa de personajes** | Sin equivalente a --cref, deriva en detalles faciales | Midjourney v7 con --cref |
| **Renders de arquitectura con fisica exacta** | No reemplaza V-Ray, OctaneRender, Blender Cycles | Software 3D especializado |
| **Arte con estilos pictoricos especificos** | Midjourney captura mejor el "alma" de un movimiento artistico | Midjourney v7, StyleDrop |
| **Escenas con 5+ personas en accion dinamica** | Artefactos anatomicos en grupos grandes | Flux.1, Stable Diffusion con ControlNet |
| **Inpainting de areas pequenias** | Mascaras menores al 5% del area producen inconsistencias | Photoshop Generative Fill, Adobe Firefly |
| **Generacion masiva a bajo costo** | Precio por imagen mas alto que alternativas open-source | SD local, ComfyUI, Flux local |

---

### 6.3 Comparativa Directa

| Categoria | GPT-Image-1 | Midjourney v7 | Flux.1 Pro | SD 3.5 | Ideogram v2 | Firefly 3 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Texto legible en imagen** | 1er lugar | 5to lugar | 2do lugar | 4to lugar | 2do lugar | 2do lugar |
| **Instruccion compleja** | 1er lugar | 3er lugar | 2do lugar | 2do lugar | 3er lugar | 3er lugar |
| **Fotorrealismo piel** | 2do lugar | 2do lugar | 1er lugar | 1er lugar | 3er lugar | 2do lugar |
| **Estetica artistica** | 3er lugar | 1er lugar | 2do lugar | 2do lugar | 3er lugar | 3er lugar |
| **Consistencia personaje** | 2do lugar | 1er lugar | 3er lugar | 3er lugar | 3er lugar | 3er lugar |
| **API / Integracion** | 1er lugar | 3er lugar | 1er lugar | 1er lugar | 2do lugar | 2do lugar |
| **Comercial / Producto** | 1er lugar | 2do lugar | 2do lugar | 3er lugar | 3er lugar | 1er lugar |
| **Edicion iterativa** | 1er lugar | 2do lugar | 3er lugar | 3er lugar | 3er lugar | 2do lugar |
| **Narrativa / Storyboard** | 1er lugar | 2do lugar | 3er lugar | 3er lugar | 3er lugar | 3er lugar |

---

## 7. Mejores Practicas por Direccion Visual

### 7.1 Direccion Realista / Fotografia Documental

**Objetivo:** Imagenes que parezcan tomadas con camara real, no generadas por IA.

**Vocabulario clave:**
- `fotografia tomada con iPhone 15 Pro` / `fotografia analogica de 35mm`
- `Kodak Portra 400 film look` — tonos piel calidos, grano fino
- `lente 85mm, apertura f/1.8, bokeh natural`
- `luz natural difusa, sin flash`
- `textura de piel natural, poros visibles`
- `shot on location, authentic and candid`

**Palabras a evitar:**
- `hyperrealistic`, `ultra-detailed`, `8K` → estas keywords disparan el look "digital AI"
- `cinematic lighting` sin especificar que tipo → puede producir over-dramatismo

**Prompt modelo:**
```
Fotografia tomada con lente de 35mm, grano de pelicula analogica Kodak Portra 400.
Una pareja joven latina en un mercado al aire libre en la Ciudad de Mexico,
riendo mientras prueban frutas. Luz del mediodia filtrada por una lona naranja
que crea un banio de luz calida. Composicion casual y espontanea. Imagen autentica
y sin retoques, estilo fotodocumental.
```

---

### 7.2 Direccion Cinematografica / Editorial

**Objetivo:** Imagenes con la grandiosidad visual del cine o la fotografia editorial de moda.

**Vocabulario clave:**
- `cinematographic color grading, teal and orange palette`
- `anamorphic lens flare` — destellos horizontales azulados de lente de cine
- `shallow depth of field, 85mm prime lens`
- `Arri Alexa color science` — tonos de piel de cine premium
- `golden hour, magic hour lighting`
- `dramatic Rembrandt lighting` — iluminacion lateral con triangulo en mejilla
- `low angle shot, hero perspective` — angulo bajo que hace al sujeto monumental

**Palabras a evitar:**
- `selfie style`, `casual` → rompe el tono cinematografico
- `flat lighting`, `even lighting` → sin drama visual
- `white background` → contexto vacio anti-cinematografico

**Prompt modelo:**
```
Fotografia cinematografica de alta produccion. Un hombre de negocios de 40 anios
con traje gris carbon camina hacia la camara en un lobby de rascacielos con
paredes de vidrio. Tomada desde un angulo bajo en contrapicado que lo hace
ver monumental. La luz del atardecer crea siluetas dramaticas y destellos
anamorficos dorados en los vidrios. Color grading cinematografico en tonos
teal y naranja. Sin texto.
```

---

### 7.3 Direccion 3D Pixar / Animacion Premium

**Objetivo:** Personajes y escenas con la estetica de animacion digital de alta produccion tipo Pixar, Illumination o DreamWorks.

**Vocabulario clave:**
- `3D animated character in the style of Pixar animation`
- `expressive oversized eyes, smooth rounded features`
- `subsurface scattering on skin` — luz que pasa a traves de la piel dando calidez
- `warm cinematic lighting, soft shadows`
- `high-quality 3D render, CGI`
- `detailed clothing with fabric texture and wrinkles`
- `wholesome and friendly atmosphere`
- `Pixar-style volumetric lighting`

**Palabras a evitar:**
- `photorealistic` → rompe el estilo de animacion
- `dark`, `gritty`, `noir` → tono contrario a Pixar
- `hyperdetailed skin texture` → realismo que desaparece el estilo animacion

**Prompt modelo:**
```
Ilustracion 3D al estilo de una pelicula de Pixar de alta produccion.
Un ninio de 8 anios con ojos grandes y expresivos, cabello alborotado castanio,
con mochila escolar roja, de pie frente a la puerta de su nueva escuela
con expresion de mezcla entre nervios y emocion. La escena tiene iluminacion
calida de maniana soleada con volumetria de luz. Colores vibrantes y saturados
pero armoniosos. Calidad de render de pelicula de animacion premium.
```

---

### 7.4 Direccion Comercial / Fotografia de Producto

**Objetivo:** Imagenes de producto aptas para e-commerce o campanas de marca.

**Vocabulario clave:**
- `professional product photography, studio lighting`
- `three-point lighting setup` — luz principal, relleno y contorno
- `clean white background` o `marble surface background`
- `shallow depth of field, sharp product focus`
- `hero shot` — angulo que muestra el producto en su mejor angulo
- `lifestyle product photography` — producto en contexto de uso
- `flat lay photography` — vista superior con composicion de elementos

**Palabras a evitar:**
- `cluttered background` → distracciones del producto
- `dramatic shadows` → para producto normalmente se quieren sombras suaves

**Prompt modelo:**
```
Fotografia de producto de alta calidad comercial. Una botella de perfume de
vidrio cuadrado con tapa dorada y etiqueta negra minimalista, sobre una
superficie de marmol negro con vetas doradas. Iluminacion de estudio con
tres puntos de luz que resaltan el brillo del vidrio y la tapa dorada.
Reflexion suave del producto en la superficie del marmol. Fondo negro profundo
con degradado sutil. Estilo de campana de fragancia de lujo masculina. Sin texto.
```

---

### 7.5 Direccion Fashion / Lifestyle Aspiracional

**Objetivo:** Imagenes que comunican un estilo de vida deseado y aspiracion social.

**Vocabulario clave:**
- `editorial fashion photography`
- `quiet luxury aesthetic` — lujo discreto sin logos
- `aspirational lifestyle photography`
- `golden hour outdoor fashion shot`
- `Mediterranean, European summer aesthetic`

**Palabras a evitar:**
- `cheap`, `affordable`, `sale` → anti-aspiracional
- `studio backdrop` para lifestyle → pierde autenticidad
- `bright neon colors` para quiet luxury → rompe el tono

**Prompt modelo:**
```
Fotografia editorial de moda estilo quiet luxury. Una mujer de unos 30 anios
con lino beige y lentes de sol oversized camina por una calle empedrada de
un pueblo mediterraneo al atardecer. Cabello castanio oscuro al viento.
La luz dorada del atardecer crea una atmosfera dorada y eterea.
Estilo Vogue editorial, composicion casual pero perfecta,
sensacion de libertad y elegancia discreta. Sin texto ni logos visibles.
```

---

### 7.6 Direccion Flat Design / UI y Tecnologia

**Objetivo:** Ilustraciones limpias, iconos, infografias y mockups de interfaz.

**Vocabulario clave:**
- `flat vector illustration, clean design`
- `isometric perspective illustration`
- `minimal color palette, 2-3 colors maximum`
- `UI mockup showing...`
- `geometric shapes, no gradients`

**Palabras a evitar:**
- `photorealistic`, `photograph` → rompe el estilo plano
- `complex textures`, `detailed backgrounds` → demasiado ruido visual

**Prompt modelo:**
```
Ilustracion flat design de estilo vectorial minimalista.
Un dashboard de analytics con tres secciones principales:
un grafico de lineas en la izquierda mostrando crecimiento,
cards de metricas en el centro con los numeros "2,847 usuarios",
"$15,293 ingresos", "94% satisfaccion", y un mapa de calor en la derecha.
Paleta de colores: azul indigo, blanco y coral suave.
Estilo clean tech, sin sombras pesadas, fondo blanco.
```

---

## 8. Biblioteca de 10 Prompts Comentados

### Prompt 1: Producto Skincare — Instagram Feed (1:1)

```
Professional studio product photography. A minimalist amber glass dropper
bottle of facial serum with a brushed gold cap, centered on a white marble
surface. Three dried rose petals placed naturally around the base. Soft,
diffused overhead studio lighting creates subtle shadows that give the bottle
dimensionality. The glass refracts light beautifully showing the golden serum
inside. White background with a gentle off-white gradient. Premium beauty
brand aesthetic, clean and luxurious. No text, no watermarks.
```

**Parametros API recomendados:** `quality: "high"`, `size: "1024x1024"`, `style: "natural"`

**Desglose:**
- `Professional studio product photography` → declara el tipo de imagen al inicio
- `amber glass dropper bottle` → especifica material y color del producto exactamente
- `brushed gold cap` → detalle de acabado material importante para consistencia
- `Three dried rose petals` → el numero evita que el modelo ponga "muchos" o "pocos"
- `Soft, diffused overhead studio lighting` → define la fuente de luz precisamente
- `No text, no watermarks` → control negativo explicito

**Por que funciona en GPT-Image-1:** El modelo interpreta correctamente el posicionamiento (petalos "around the base") y el control de multiples materiales con fisica correcta (vidrio refractante, metal cepillado), algo que los modelos de difusion frecuentemente malinterpretan.

---

### Prompt 2: Retrato Ejecutivo / LinkedIn — Formato Horizontal (3:2)

```
Una fotografia editorial de retrato ejecutivo de alta produccion. Un hombre
latinoamericano de aproximadamente 42 anios, cabello oscuro bien peinado con
algo de gris en las sienes, expresion de confianza tranquila con una
semisonrisa. Viste un traje azul marino de corte moderno con camisa blanca
sin corbata. Esta de pie en un lobby de oficinas modernas con vidrio y acero.
La luz natural entra desde atras y a la derecha creando un sutil rim light
que lo separa del fondo. El fondo esta suavemente desenfocado.
Tonos de imagen elegantes y calidos. Formato horizontal, plano americano.
Sin texto.
```

**Parametros API recomendados:** `quality: "high"`, `size: "1536x1024"`, `style: "natural"`

**Desglose:**
- `latinoamericano de aproximadamente 42 anios` → especifica demografia sin describir persona real
- `cabello oscuro bien peinado con algo de gris en las sienes` → rasgo de edad y distincion
- `expresion de confianza tranquila con una semisonrisa` → estado emocional especifico
- `rim light que lo separa del fondo` → vocabulario tecnico de iluminacion en lenguaje natural
- `Formato horizontal, plano americano` → controla composicion

**Uso ideal:** LinkedIn banner, pagina "Acerca de" de sitio web corporativo.

---

### Prompt 3: Contenido de Estilo de Vida para Instagram Stories (2:3)

```
Fotografia lifestyle autentica, estilo UGC de alta calidad. Una mujer latina
de unos 27 anios, cabello negro rizado hasta los hombros, sonrisa amplia y
ojos expresivos, sentada en una terraza de cafe con vista a una ciudad
latinoamericana con montanias al fondo. Sostiene entre las dos manos una
taza de cafe humeante. La luz del atardecer la bania en un tono dorado calido.
Usa un vestido floral ligero. La imagen tiene el grano suave y los colores
calidos de una foto tomada con un telefono de gama alta. Composicion vertical.
Sin texto.
```

**Parametros API recomendados:** `quality: "high"`, `size: "1024x1536"`, `style: "vivid"`

**Desglose:**
- `estilo UGC de alta calidad` → el oxímoron intencional logra el look organico pero cuidado
- `sostiene entre las dos manos una taza de cafe humeante` → accion especifica
- `ciudad latinoamericana con montanias al fondo` → especifica geografia cultural sin nombrar ciudad
- `grano suave y colores calidos de un telefono de gama alta` → define la textura sin usar terminos de difusion

**Uso ideal:** Instagram Stories, TikTok lifestyle, contenido de marca de cafe, turismo.

---

### Prompt 4: Cartel de Evento con Texto — Social Media (1:1)

```
Disenia un cartel moderno para un evento de tecnologia. El cartel tiene un
fondo degradado de negro profundo a azul indigo oscuro. En el centro superior,
el logotipo simplificado de una empresa (un rayo de luz abstracto en blanco).
En el centro con tipografia sans-serif moderna en blanco en grande: "AI SUMMIT
2025". Debajo en tipografia mas pequenia y ligera: "El futuro de los negocios
con inteligencia artificial". En la esquina inferior izquierda: "15 nov, CDMX"
en tipografia pequenia coral/naranja. Particulas de luz sutiles en el fondo.
Estetica tech premium, diseno minimalista.
```

**Parametros API recomendados:** `quality: "high"`, `size: "1024x1024"`, `style: "vivid"`

**Desglose:**
- Texto entre comillas: `"AI SUMMIT 2025"`, `"El futuro..."`, `"15 nov, CDMX"` → activar texto legible
- `tipografia sans-serif moderna` → especificar estilo de fuente
- `tipografia mas pequenia y ligera` → especificar jerarquia tipografica
- `esquina inferior izquierda` → posicion exacta del elemento
- `coral/naranja` → color especifico del elemento de acento

**Por que funciona en GPT-Image-1:** Este prompt seria imposible para Midjourney o Stable Diffusion. GPT-Image-1 puede renderizar los 3 textos con diferentes tamanios y ubicaciones en una sola generacion.

---

### Prompt 5: Fotografia de Producto Alimentario (3D Fruit Drop) — Feed (1:1)

```
High-speed photography commercial shot. A fresh green apple falling through
the air with perfect water droplets exploding off its surface, frozen in
mid-motion. Clean white background. Three-point professional studio lighting
with a subtle green reflection underneath suggesting a mirror surface.
The apple is perfectly round and vivid green, the water droplets catch the
light like diamonds. Sharp focus throughout. Commercial food photography
quality. No text.
```

**Parametros API recomendados:** `quality: "high"`, `size: "1024x1024"`, `style: "vivid"`

**Desglose:**
- `High-speed photography commercial shot` → declara la tecnica de camara
- `water droplets exploding off its surface` → accion fisica dinamica precisa
- `frozen in mid-motion` → refuerza que el movimiento esta congelado
- `water droplets catch the light like diamonds` → comparacion poetica que GPT-Image-1 interpreta visualmente

---

### Prompt 6: Infografia de Dato Unico — LinkedIn / Twitter (3:2)

```
Disenia una infografia minimalista de un solo dato para redes sociales.
Fondo blanco. En el centro, el numero grande en tipografia serif bold negra: "73%".
Debajo, una linea de separacion fina en azul electrico.
Luego en tipografia sans-serif regular gris oscuro: "de las PyMEs mexicanas
que adoptan IA reportan reduccion de costos operativos en el primer anio".
En la esquina superior izquierda, el logotipo pequenio "FLUIA" en azul.
En la esquina inferior derecha, fuente: "Estudio FLUIA 2025" en tipografia tiny gris claro.
Diseno corporativo moderno, limpio y de autoridad.
```

**Parametros API recomendados:** `quality: "high"`, `size: "1536x1024"`, `style: "natural"`

**Desglose:**
- Todos los textos en comillas para maxima fidelidad de renderizado
- `linea de separacion fina en azul electrico` → elemento de diseno con posicion
- Jerarquia tipografica explicita: serif bold → sans-serif regular → tiny
- Posiciones especificas: `esquina superior izquierda`, `esquina inferior derecha`

---

### Prompt 7: Avatar de Personaje para Serie de Contenido

```
Character design illustration. A friendly illustrated avatar of a professional
woman in her mid-thirties named "Maya", styled as a modern 2D vector illustration
with clean outlines. She has medium brown skin, straight shoulder-length dark
hair with a subtle burgundy tint, warm brown eyes, and is wearing a teal blazer
over a white top. Her expression is confident and approachable with a genuine
smile. Style: modern flat illustration with soft shadows, suitable for use as
a brand mascot or avatar. White background. Full portrait view, head and
shoulders. No text.
```

**Parametros API recomendados:** `quality: "high"`, `size: "1024x1024"`, `style: "natural"`

**Desglose:**
- `Character design illustration` → declara el tipo
- `2D vector illustration with clean outlines` → especifica el estilo grafico
- `medium brown skin` → descriptor de tono de piel sin ambiguedad
- `with a subtle burgundy tint` → detalle de color de pelo que define personalidad
- `suitable for use as a brand mascot or avatar` → contextualiza el proposito

---

### Prompt 8: Fotografia de Arquitectura / Real Estate

```
Professional real estate and interior photography. A bright, open-plan living
room in a high-end modern apartment during daytime. Floor-to-ceiling windows
with views of a city skyline. Furniture: a cream linen sofa, a round walnut
coffee table, and two white designer armchairs. Lush monstera and pothos plants
in terracotta pots. Natural light floods the space, casting warm geometric
shadows on the polished concrete floor. Scandinavian-Mexican design fusion
aesthetic. Wide-angle lens perspective showing the full room depth.
Professional real estate photography quality. No people, no text.
```

**Parametros API recomendados:** `quality: "high"`, `size: "1536x1024"`, `style: "natural"`

**Desglose:**
- `during daytime` → control de condicion de luz natural
- Inventario de mobiliario especifico: `cream linen sofa`, `round walnut coffee table` → GPT-Image-1 puede posicionar multiples objetos
- `Scandinavian-Mexican design fusion` → mezcla cultural especifica de estetica
- `No people, no text` → control negativo explicito doble

---

### Prompt 9: Packaging Mockup para E-commerce

```
Product packaging mockup, professional studio photography. A premium coffee
bag standing upright, kraft paper material with a matte black label covering
the front third. The black label shows in white serif typography: "ORIGIN"
on top in small caps, then in larger bold typeface "SIERRA MADRE" and below
in small sans-serif: "Specialty Coffee, Mexico, 250g". On the right side of
the bag, a simple line illustration of a coffee plant branch. The bag has a
resealable zipper at the top. Placed on a dark wooden surface with a few
scattered whole coffee beans around the base. Warm, moody cafe lighting.
Premium artisan brand aesthetic. Slight depth of field, crisp product focus.
```

**Parametros API recomendados:** `quality: "high"`, `size: "1024x1024"`, `style: "vivid"`

**Desglose:**
- Descripcion detallada del packaging: material, acabado, posicion de etiqueta
- Todos los textos del packaging en comillas para renderizado correcto
- `small caps` → especifica estilo tipografico
- `line illustration of a coffee plant branch` → elemento grafico de la etiqueta descrito
- `Slight depth of field, crisp product focus` → maneja el desenfoque del fondo

---

### Prompt 10: Anuncio de Redes Sociales — Meta Ad con CTA (Formato Vertical)

```
Crea un anuncio visual para redes sociales. Fondo degradado de azul marino
profundo a azul electrico, de abajo hacia arriba. En el tercio superior,
una fotografia circular recortada de una mujer profesional latina de 35 anios
con sonrisa genuina y blazer azul, mirando a camara.

En el centro, en tipografia sans-serif bold blanca grande: "Tu negocio
todavia opera sin IA?". Debajo en tipografia regular blanca mas pequenia:
"Automatiza en 30 dias o te devolvemos tu inversion".

En el tercio inferior, un boton CTA redondeado en naranja brillante con el
texto "QUIERO SABER MAS" en blanco. Debajo del boton, texto muy pequenio
blanco: "fluia.mx, Consulta gratuita".

Diseno de anuncio profesional, alta conversion, look tech-premium latinoamericano.
```

**Parametros API recomendados:** `quality: "high"`, `size: "1024x1536"`, `style: "vivid"`

**Desglose:**
- Estructura del anuncio en tercios: foto -> texto principal -> CTA -> refuerzo
- `fotografia circular recortada` → el modelo interpreta shape masking
- Todos los textos de copy en comillas para renderizado correcto
- `boton CTA redondeado en naranja brillante` → color de boton especifico y contraste
- Descripcion del color del boton separado del color del texto del boton

**Por que este prompt es unico para GPT-Image-1:** Ningun otro modelo generador de imagenes puede crear en una sola generacion una pieza publicitaria con 4 bloques de texto diferentes, diferentes tamanios tipograficos, un boton con forma especifica, y una fotografia incrustada. Este caso de uso es practicamente exclusivo de GPT-Image-1.

---

## Resumen de Principios Maestros

| Principio | Regla de oro |
| :--- | :--- |
| **Idioma del prompt** | Lenguaje natural completo en oraciones, no listas de tokens |
| **Longitud** | 3-6 oraciones descriptivas para contenido profesional |
| **Texto en imagen** | Siempre entre comillas dentro del prompt |
| **Tipo de imagen** | Declararlo explicitamente al inicio del prompt |
| **Negacion** | Usar frases como "sin texto", "fondo limpio", "sin logos" |
| **Parametros de calidad** | `high` para entregables finales, `medium` para iteracion |
| **Formato** | Usar `response_format: "b64_json"` en produccion, no `url` |
| **Consistencia** | Crear Character Sheets y usarlos como referencia de imagen via API |
| **Costos** | Optimizar `n` y `quality` segun el estadio del proyecto |
| **Aspect ratio** | Mencionar la composicion en el prompt si el ratio exacto no esta disponible |

---

#gpt-image-1 #chatgpt-images #openai #prompt-engineering #image-generation #ai-art #brand-content #social-media #marketing-visual #storyboard #api-openai
