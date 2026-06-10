# Fotografía Hiperrealista con Modelos de Imagen AI
## Guía Técnica Exhaustiva — Flux · GPT-Image-1 · Nano Banana

> [!NOTE]
> **Base de Conocimiento de Referencia Rápida**
> Esta guía está diseñada para directores de arte, fotógrafos y creadores de contenido que quieran dominar la fotografía hiperrealista con modelos de imagen AI. El objetivo es que tus outputs sean indistinguibles de fotografías reales.

---

## 📐 La Fórmula Universal de Fotografía Hiperrealista

Antes de entrar en detalles de cada modelo, esta es la estructura que produce los resultados más consistentes y fotorrealistas en cualquier modelo:

```text
[Tipo de Fotografía + Referencia de Cámara], [Sujeto + Detalle humano específico],
[Pose/Acción no posada], [Entorno con luz física real], 
[Especificaciones técnicas: lente + apertura + ISO], [Imperfecciones intencionales]
```

**Ejemplo base:**
```
Candid documentary photograph, a 34-year-old man with visible skin texture and natural fatigue lines around his eyes, walking through a narrow market alley, late afternoon golden sidelight casting long shadows, shot on Leica M11 with 35mm f/2 lens, ISO 800 film grain, slight motion blur on hands
```

---

## 1. 🎯 Tokens y Descriptores de Activación Fotorrealista por Modelo

### 1.1 Flux Dev / Pro / Schnell — El Especialista en Fotorrealismo

Flux (desarrollado por Black Forest Labs) usa una arquitectura de **Rectified Flow Transformer** que lo hace excepcionalmente bueno simulando la física óptica real. Es el modelo más cercano a la fotografía de cámara real entre los tres.

#### Tokens de Activación Primaria (incluir al inicio del prompt)

| Token / Frase | Efecto en el Output | Cuándo usar |
|:---|:---|:---|
| `RAW photo` | Activa modo sin procesar, textura auténtica | Siempre para fotorrealismo base |
| `photorealistic` | Señal directa al modelo de intent fotográfico | Como refuerzo adicional |
| `candid photograph` | Activa look no posado, autenticidad documental | Street, lifestyle, documental |
| `shot on [camera model]` | Simula óptica específica de cámara real | Retratos, editorial |
| `documentary style` | Elimina artificialidad, agrega narrativa | Cualquier tipo fotorrealista |
| `35mm film photography` | Añade grano de película, color orgánico | Retrato, street, lifestyle |
| `Kodak Portra 400` | Tonos de piel cálidos, grano fino | Retrato, wedding, lifestyle |
| `Fuji 400H` | Tonos fríos-suaves, look de película analógica | Lifestyle, moda casual |
| `Ilford HP5` | Blanco y negro gritty, alto contraste | Street BW, documental |
| `hyperrealistic` | Máximo nivel de detalle y textura | Cuando "photorealistic" no es suficiente |
| `DSLR photography` | Activa calidad de sensor digital profesional | Comercial, producto |

#### Tokens de Cámara Específica (muy efectivos en Flux)

```
shot on Sony A7R IV — máxima resolución, tonos Sony
shot on Nikon D850 — tonos cálidos, piel natural Nikon
shot on Canon EOS R5 — skin tones Canon característicos
shot on Leica M11 — estética street, color Leica
shot on Hasselblad X2D — medium format look, gran detalle
shot on Fujifilm GFX100S — color Fuji, tonos de piel
```

#### Tokens ANTI-AI para Flux (lo que debes EVITAR)

```
❌ masterpiece          → produce look hiper-pulido artificial
❌ 8k resolution        → trigger para outputs sobre-procesados
❌ ultra-detailed       → puede producir textura plástica
❌ highly polished      → elimina imperfecciones que hacen real la foto
❌ perfect skin         → skin de maniquí, delata AI inmediatamente
❌ smooth               → mata la textura orgánica
❌ unreal engine        → activa render 3D, no fotografía
```

#### Configuración Técnica Óptima para Flux (en fal.ai o similar)

- **RAW Mode:** Activar en Flux 1.1 Pro Ultra — es el toggle más importante para fotorrealismo
- **CFG/Guidance Scale:** Mantener entre **2.5 — 3.5** (evitar >5, produce look artificial)
- **Inference Steps:** 30-40 pasos para el sweet spot calidad/velocidad
- **Negative Prompts:** Flux NO soporta negative prompts nativamente. En su lugar, usar constrainsts en el prompt: *"keep face realistic and natural, no text, no logos, natural skin texture"*

---

### 1.2 GPT-Image-1 (OpenAI) — El Fotorrealista de Lenguaje Natural

GPT-Image-1 tiene una arquitectura completamente diferente a Flux: es un **modelo multimodal que procesa lenguaje natural complejo**. No responde bien al "keyword soup" — prefiere instrucciones completas como las de un director de fotografía.

#### Principio Fundamental: Habla como Director de Foto, no como Prompt Engineer

**❌ Incorrecto (keyword soup):**
```
photorealistic, 85mm, f/1.8, bokeh, RAW, Nikon, masterpiece, ultra-detailed
```

**✅ Correcto (lenguaje de director):**
```
A photorealistic portrait photograph taken with an 85mm lens at f/1.8. 
The subject is a 32-year-old woman with visible natural skin texture and slight 
expression lines around her eyes. Soft window light from the left creates gentle 
shadows on her face. The background is softly out of focus in a warm, creamy bokeh.
```

#### Frases Activadoras de Fotorrealismo para GPT-Image-1

| Frase Natural | Efecto |
|:---|:---|
| `"A photorealistic photograph of..."` | Activa el modo foto sobre ilustración |
| `"Documentary-style photograph..."` | Elimina artificialidad, look de periodismo |
| `"Captured with a [camera] camera..."` | Fuerza simulación óptica específica |
| `"Taken on 35mm film..."` | Añade grano y color analógico |
| `"The photo shows natural skin texture with visible pores..."` | Evita piel de plástico |
| `"An unposed, candid moment showing..."` | Activa autenticidad y naturalismo |
| `"Shot in available light..."` | Elimina iluminación perfecta artificial |
| `"The image has the characteristic grain and depth of..."` | Referencia directa a película |

#### Gestión de Elementos No Deseados (sin negative prompts)

GPT-Image-1 NO tiene negative prompts. Usa estas frases en el cuerpo del prompt:

```
...without any artificial retouching or smoothing
...with no digital post-processing effect
...keeping the background naturally imperfect and organic
...avoiding any studio-perfect lighting or airbrushed appearance
...with genuine environmental imperfections in the scene
```

#### Iteración Conversacional (ventaja exclusiva de GPT-Image-1)

A diferencia de Flux, puedes refinar en conversación:
1. Genera imagen base
2. Pide: *"Increase the film grain significantly and make the lighting moodier"*
3. Continúa: *"Soften the skin retouching — it looks too perfect"*
4. Ajusta: *"The bokeh background looks too uniform and artificial — add some variation"*

---

### 1.3 Nano Banana 2 (Gemini 3.1 Flash Image) — El Modelo Versátil de Google

Nano Banana 2 es oficialmente **Gemini 3.1 Flash Image**, lanzado en febrero 2026. Su arquitectura es de **Multimodal Foundation Model** integrado con el ecosistema Gemini. Es rápido, económico y tiene excelente precisión de texto en imagen.

#### Arquitectura vs. Flux: Diferencias Clave

| Característica | Nano Banana 2 (Gemini Flash) | Flux 2 (Black Forest Labs) |
|:---|:---|:---|
| **Arquitectura** | Multimodal Foundation Model | Rectified Flow Transformer |
| **Fortaleza** | Velocidad, costo, text-in-image | Fidelidad visual, simulación óptica |
| **Fotorrealismo** | Bueno, requiere más precisión | Excelente, responde bien a técnica |
| **Lenguaje** | Natural estructurado | Keywords + lenguaje natural |
| **Mejor uso** | Producción a escala, mockups | Trabajo comercial de alta gama |

#### Tokens y Estructura Específica para Nano Banana 2

```
[Tipo de fotografía específico], [Sujeto con descriptores físicos reales],
physics-based lighting [descripción], [Lente y apertura],
texture emphasis: [detalles táctiles concretos], natural imperfections
```

**Ejemplo estructurado para Nano Banana:**
```
Photorealistic portrait photography, a 28-year-old woman with fine skin texture 
showing natural pores and slight redness on cheeks, soft natural window light 
from the right creating defined but gentle shadows, 85mm portrait lens compression 
with f/1.8 aperture bokeh, texture emphasis: visible hair strands, subtle eyelash 
detail, natural lip texture, natural imperfections in the background
```

#### Ventajas Únicas de Nano Banana para Fotorrealismo

1. **Text-in-image:** Puede renderizar texto legible en carteles, marcas en productos
2. **Web grounding:** Puede referenciar lugares o contextos reales para mayor autenticidad
3. **Imagen de referencia:** Acepta imágenes como input para consistencia de producto/personaje
4. **Velocidad:** Ideal para iteración rápida de variaciones fotorrealistas

---

## 2. 📷 Simulación de Lentes Fotográficos en AI

La focal length (distancia focal) es el parámetro individual más importante para controlar la **perspectiva, compresión y mood** de la imagen. Los modelos AI están entrenados en millones de fotografías reales con metadatos EXIF, por lo que responden de forma precisa a estos descriptores.

### 2.1 24mm — Gran Angular Extremo

**Física real:** Captura ángulo muy amplio (84°), produce distorsión de barril en los bordes, exagera las distancias entre elementos, hace que los fondos parezcan más lejanos de lo que son.

**Mood y contexto:** Grandiosidad, escala épica, arquitectura, landscapes urbanos, sensación de inmersión en el entorno.

**Descriptores AI específicos:**

```
shot on 24mm wide-angle lens
dramatic wide perspective
environmental scale emphasized
architectural distortion at edges
immersive wide-angle field of view
foreground elements prominently large, background receding
```

**Uso fotográfico:**
- Fotografía de arquitectura interior/exterior
- Reportaje que necesita mostrar contexto masivo
- Fotografía de viaje con sentido de escala
- Composiciones de ambiente donde el entorno es el protagonista

**Trampa AI común:** Con 24mm, la AI tiende a producir distorsión excesiva en rostros — evitar usarlo para retratos cercanos. Usar solo para *environmental portraits* donde el sujeto aparece pequeño en el frame.

---

### 2.2 35mm — El Lente del Street Photographer

**Física real:** Ángulo de 63°, perspectiva ligeramente más amplia que el ojo humano, muy poca distorsión, permite estar cerca del sujeto sin deformar.

**Mood y contexto:** Autenticidad documental, presencia narrativa, contexto ambiental visible, intimidad sin invasión.

**Descriptores AI específicos:**

```
shot on 35mm prime lens
natural documentary perspective
environmental portrait framing
street photography focal length
slightly wider than natural human vision
subject in context, environment visible
classic reportage framing
```

**Uso fotográfico:**
- Street photography (el lente estándar de Leica street)
- Reportaje y fotoperiodismo
- Environmental portraits (sujeto + entorno)
- Lifestyle fotorrealista donde importa el contexto

**Combinaciones de referencia:**
```
shot on Leica M6 with 35mm f/1.4 Summilux, Kodak Tri-X grain
classic Magnum street photography, 35mm documentary style
```

---

### 2.3 50mm — La Perspectiva Humana

**Física real:** Imita exactamente el campo de visión del ojo humano. No hay distorsión notable, ni compresión ni extensión del espacio. Es el "lente neutro" por excelencia.

**Mood y contexto:** Naturalidad, neutralidad, versatilidad, lo que "la cámara vio es lo que estaba ahí".

**Descriptores AI específicos:**

```
50mm prime lens
natural human eye perspective
neutral compression, no distortion
standard portrait framing
natural spatial relationships
"nifty fifty" natural look
```

**Uso fotográfico:**
- Fotografía de street con enfoque en el sujeto
- Lifestyle diario y cotidiano
- Fotografía de familia y documental personal
- Retratos de ambiente donde importa la naturalidad

**Mejor para:** Cuando quieres que la imagen parezca simplemente "una foto que alguien tomó" — sin artificio óptico aparente.

---

### 2.4 85mm — El Rey del Retrato

**Física real:** Ángulo de 29°, produce compresión de perspectiva que aplana ligeramente los rasgos faciales (más favorecedor que un gran angular), separa completamente al sujeto del fondo, el bokeh comienza a ser prominente.

**Mood y contexto:** Belleza, intimidad, sofisticación, separación sujeto-fondo, glamour.

**Descriptores AI específicos:**

```
85mm portrait lens
flattering facial compression
background subject separation
classic portrait focal length
creamy background separation
"portrait compression" of features
flattering perspective, no nasal distortion
tight environmental portrait
```

**Uso fotográfico:**
- Retratos de belleza y headshots
- Fotografía de moda editorial
- Retratos comerciales y corporativos
- Wedding photography (portraits de novios)

**Combinaciones perfectas:**
```
85mm f/1.4 lens, shallow depth of field, creamy bokeh, subject isolated
classic portrait: 85mm, f/1.8, soft window light, natural skin texture
```

---

### 2.5 105mm / 135mm — Tele para Detalle y Distancia

**Física real:** Mayor compresión aún, distancia de trabajo mayor al sujeto (menos intimidante), bokeh extremo a f/2 o menos, ideal para capturar detalles sin alterar el entorno.

**Descriptores AI específicos:**

```
telephoto portrait lens
extreme background compression
intimate distance maintained
135mm f/2 lens
compressed perspective
subject extracted from environment
```

**Uso fotográfico:**
- Fotografía de producto con detalle
- Macro photography (con extensión)
- Retratos de candid telefoto (sin que el sujeto sienta la cámara)

---

### Tabla Comparativa de Lentes para Decisión Rápida

| Focal | Perspectiva | Bokeh | Mejor Para | Distorsión |
|:---:|:---:|:---:|:---|:---:|
| 24mm | Ultra amplia | Mínimo | Arquitectura, escala épica | Alta en bordes |
| 35mm | Amplia natural | Bajo | Street, reportaje, ambiental | Mínima |
| 50mm | Humana neutra | Moderado | Lifestyle, documental | Ninguna |
| 85mm | Compresión suave | Alto | Retrato, belleza, editorial | Favorecedora |
| 135mm | Compresión fuerte | Muy alto | Detalle, tele-retrato | Muy favorecedora |

---

## 3. 💡 Sistemas de Iluminación Fotográfica — Descriptores Específicos para AI

La iluminación es el factor individual más determinante para lograr fotorrealismo. Una mala iluminación siempre delata AI. Estos son los sistemas principales con sus descriptores exactos.

### 3.1 Golden Hour — La Luz Dorada

**Qué es físicamente:** La luz del sol durante los 30-60 minutos después del amanecer o antes del atardecer. El sol está bajo en el horizonte, la luz viaja más distancia a través de la atmósfera, filtrando las longitudes de onda azules y dejando solo rojo-naranja-dorado. Las sombras son largas, suaves y cálidas.

**Por qué funciona en fotografía:** Crea una atmosfera emocional inmediata de calidez, plenitud y autenticidad. Es la luz más "favorecedora" para piel humana.

**Descriptores AI para Golden Hour:**

```
golden hour sunlight                    → base del efecto
warm directional late afternoon light   → especifica dirección y hora
low-angle sun casting long shadows      → describe las sombras características
golden rim light on hair                → detalle específico muy efectivo
warm amber backlight                    → cuando el sol viene desde atrás
lens flare from direct sunset light     → imperfección óptica auténtica
warm golden sidelight on face           → iluminación lateral dorada
soft warm shadows, not harsh            → controla la dureza de la sombra
color temperature ~3200K, golden warm   → para modelos que entienden temperatura
```

**Prompt completo de Golden Hour:**
```
Candid portrait photograph, a 29-year-old woman sitting on outdoor steps, 
warm directional golden hour sunlight from the right side creating a soft 
golden glow on her hair and a subtle rim light effect, long shadows extending 
to the left, skin appears warm and luminous in the late afternoon light, 
shot on 50mm f/2.8, Kodak Portra 400 film grain
```

---

### 3.2 Blue Hour / Magic Hour — La Luz Azul-Índigo

**Qué es físicamente:** Los 20-30 minutos después del atardecer (o antes del amanecer). El sol está bajo el horizonte pero la luz reflejada en la atmósfera crea un tono azul-índigo profundo. Las luces artificiales se vuelven protagonistas en contraste con el cielo.

**Descriptores AI:**

```
blue hour twilight lighting
deep indigo sky after sunset
ambient outdoor blue-cool light
city lights beginning to glow, natural sky indigo blue
magic hour atmospheric glow
cool blue ambient with warm artificial light contrast
post-sunset diffused blue atmospheric light
```

---

### 3.3 Rembrandt Lighting — El Triángulo Clásico

**Qué es físicamente:** La fuente de luz está a 45° lateral y ligeramente elevada. Crea un pequeño triángulo iluminado en la mejilla opuesta a la luz (en el lado oscuro del rostro). Nombrado por el pintor holandés que lo usaba consistentemente.

**Descriptores AI para Rembrandt:**

```
classic Rembrandt lighting setup
45-degree key light creating cheek triangle
small triangle of light on shadow-side cheek
painterly portrait lighting with deep shadows
one-side illuminated face, dramatic chiaroscuro
Rembrandt triangle highlight on cheek
dramatic single-source portrait lighting
dark background with strong directional light
```

**Efectividad por modelo:**
- **Flux:** Entiende perfectamente "Rembrandt lighting" como token directo
- **GPT-Image-1:** Prefers: *"The lighting creates the classic Rembrandt triangle of light visible on the cheek opposite the light source"*
- **Nano Banana:** Responde bien a: *"Rembrandt-style portrait lighting with strong directional key light at 45 degrees"*

---

### 3.4 Softbox / Diffused Light — Luz de Estudio Suave

**Qué es físicamente:** Una fuente de luz grande difuminada (parabólica, octabox, stripbox) que produce luz suave sin sombras duras. Los modelos se usan en fotografía comercial, belleza y e-commerce.

**Descriptores AI:**

```
large softbox key light from the left
soft diffused studio lighting
beauty dish lighting setup
even soft fill light, no hard shadows
gentle studio illumination
commercial beauty lighting
flattering diffused key light with soft shadows
octabox overhead soft light
butterfly lighting (softbox directly in front, slightly elevated)
```

**Para fotografía de producto:**
```
professional softbox studio lighting
diffused white background, even product illumination
commercial photography studio setup, controlled soft light
high-key studio lighting with minimal shadows
```

---

### 3.5 Practical Lights — Las Luces del Entorno

**Qué son:** Las fuentes de luz que existen en el entorno real: lámparas, velas, pantallas, focos de calle, neones, luces de ventanas. Cuando se usan como fuente principal de iluminación, crean un look extremadamente auténtico.

**Descriptores AI:**

```
warm ambient table lamp as key light
practical lamp casting soft warm glow
candlelight illumination, flickering warm light
screen glow reflecting on face from laptop or phone
neon sign practical light, colored ambient
streetlamp overhead, tungsten warm circle
fireplace warm glow as primary light source
window light diffused through sheer curtains
```

**Por qué son tan efectivos para evitar el look de AI:** Las practical lights crean sombras inconsistentes, múltiples fuentes de color y caídas de luz no perfectas — exactamente lo que hace que una foto parezca real.

**Ejemplo de prompt con practical lights:**
```
Candid indoor photograph, a man reading at a wooden desk, the only light source 
is a warm amber table lamp to his right, soft warm pool of light on the desk 
and left side of his face, the rest of the room fades into natural darkness, 
ambient room temperature shadow on right side, shot on 35mm f/2, ISO 1600, 
visible film grain in the darker areas
```

---

### 3.6 Hard Light / Sunlight Directo — La Luz de Verano

**Qué es:** El sol directo al mediodía o ligeramente lateral. Produce sombras duras, definidas, con bordes nítidos. En fotografía de moda editorial crea un look agresivo y contemporáneo.

**Descriptores AI:**

```
harsh direct sunlight
hard shadows with defined edges
high noon direct sunlight, no diffusion
strong single directional light source, hard shadows
contrasty midday sun
unforgiving direct light exposing skin texture
bold sharp shadow casting
summer beach hard sunlight
```

---

### 3.7 Three-Point Studio Lighting — El Estándar de Estudio

**Qué es:** El sistema de iluminación más usado en fotografía comercial: Key Light (principal), Fill Light (relleno), y Rim/Back Light (contorno). Crea una iluminación tridimensional y profesional.

**Descriptores AI:**

```
professional three-point lighting setup
key light, fill light, and rim backlight
classic studio photography lighting rig
separated subject from background with rim light
three-point portrait lighting with defined separation
studio portrait setup: key from upper-left, fill from right, rim from behind
```

---

### 3.8 Chiaroscuro / Low-Key — El Claroscuro

**Qué es:** Técnica extrema de alto contraste donde las sombras dominan la imagen y un haz preciso de luz ilumina al sujeto. Originado en pintura renacentista (Caravaggio).

**Descriptores AI:**

```
dramatic chiaroscuro lighting
low-key photography, deep rich shadows
single beam of light on subject, darkness surrounds
high-contrast cinematic shadows
noir-style dramatic light and shadow
95% shadow with directional light beam
theatrical spot-lighting effect
dramatic moody low-key portrait
```

---

### Tabla Rápida de Decisión de Iluminación

| Sistema | Mood | Mejor para | Dificultad AI |
|:---|:---|:---|:---|
| Golden Hour | Cálido, emocional | Lifestyle, outdoor | Fácil |
| Blue Hour | Misterioso, urbano | Street, city | Media |
| Rembrandt | Dramático, artístico | Retrato, editorial | Fácil |
| Softbox | Limpio, comercial | E-commerce, belleza | Fácil |
| Practical Lights | Auténtico, cinematográfico | Lifestyle indoor, candid | Media |
| Hard Light | Agresivo, contemporáneo | Editorial, moda | Media |
| Three-Point | Profesional, comercial | Headshot, corporativo | Fácil |
| Chiaroscuro | Dramático, artístico | Fine art, editorial | Fácil |

---

## 4. 🌀 Profundidad de Campo y Bokeh — Descriptores por Modelo

### La Física del Bokeh (para describir correctamente)

El bokeh no es simplemente "fondo borroso". Es el resultado de tres variables físicas que trabajan juntas:
1. **Apertura amplia** (número f bajo): f/1.2, f/1.4, f/1.8
2. **Focal length larga**: 85mm boquehea más que 35mm con la misma apertura
3. **Distancia sujeto-fondo**: A mayor distancia, más bokeh aunque la apertura sea la misma

Esto es crucial para prompt engineering — si especificas f/1.4 pero el sujeto está pegado al fondo, el bokeh será mínimo en la realidad fotográfica.

### 4.1 Bokeh Cremoso (el más buscado)

**Descriptores para Flux:**
```
f/1.2 aperture, creamy out-of-focus background
extremely shallow depth of field
soft creamy bokeh, subject clearly isolated
background completely dissolved into soft blur
buttery smooth background blur
```

**Descriptores para GPT-Image-1:**
```
"The background is rendered in extremely soft, creamy out-of-focus blur due to 
the wide f/1.4 aperture. The subject is sharply in focus while the background 
circles of confusion create a silky smooth bokeh effect."
```

**Descriptores para Nano Banana:**
```
f/1.8 portrait lens bokeh, subject isolated from background, 
soft focus background rendering with gentle circular blur patterns
```

### 4.2 Bokeh de Lente Anamórfico (Cinematográfico)

**Física:** Los lentes anamórficos estiran los círculos de bokeh horizontalmente y crean flares azul-horizontal característicos del cine.

**Descriptores:**
```
anamorphic lens bokeh, horizontal oval blur
cinematic anamorphic oval bokeh
anamorphic horizontal lens flare streaks
widescreen anamorphic look with characteristic lens distortion
oval bokeh circles, not round, anamorphic stretch
```

### 4.3 Profundidad de Campo Total (f/8 - f/16)

**Para fotografía de producto, arquitectura o paisaje donde todo debe estar nítido:**

```
deep depth of field, f/8 sharp focus throughout
everything in sharp focus from foreground to background
deep focus, full scene sharpness
f/11 architecture photography, all planes in focus
no bokeh, complete scene sharpness
```

### 4.4 Defocus Selectivo (Planos Específicos)

```
sharp focus on the eyes, soft focus on the nose and beyond
subject's face in focus, body slightly soft
foreground elements sharp, midground and background progressively out of focus
selective focus technique, focused on [elemento específico]
```

### 4.5 Trampas del Bokeh en AI

> [!WARNING]
> **Problemas comunes con bokeh en AI:**
> - **Bokeh demasiado perfecto:** AI tiende a crear bokeh perfectamente uniforme — en fotografía real, el bokeh tiene variaciones. Añadir: *"slightly irregular bokeh pattern, natural lens characteristics"*
> - **f/1.2 puede sobredibujar el fondo:** Evita que el modelo "invente" contenido irreal. Solución: usar f/2.8 para más control sobre qué aparece en el fondo bokehado.
> - **Bokeh que no corresponde con el entorno:** El AI puede crear bokeh que no concuerda físicamente con la escena descrita. Ser explícito: *"background bokeh showing soft green vegetation circles consistent with park environment"*

---

## 5. 📸 Tipos de Fotografía — Guías Específicas por Género

### 5.1 Fotografía de Retrato

**Características distintivas:**
- Conexión emocional con el sujeto
- Enfoque en el rostro (especialmente ojos)
- Luz favorecedora para piel
- Separación sujeto-fondo

**Estructura óptima de prompt:**
```
[Tipo de retrato: headshot/environmental/beauty], [edad y descripción física específica 
con imperfecciones reales], [expresión o microgestión], [fuente de luz específica], 
[lente 85mm o 135mm], [apertura f/1.4-f/2.8], [detalles de piel no perfectos]
```

**Palabras clave activadoras:**
```
compelling portrait, piercing eye contact, natural micro-expression, 
genuine candid expression, environmental portrait, beauty photography, 
catchlight in eyes, natural skin texture, pores visible, slight asymmetry
```

**Palabras a EVITAR (delatan AI):**
```
perfect symmetrical face, flawless skin, smooth complexion, beautiful, gorgeous
(estos tokens activan el look de muñeca de AI)
```

**Prompt de ejemplo — Retrato editorial:**
```
Environmental portrait photograph, a 45-year-old man with weathered skin, 
visible laugh lines and natural sun damage on cheekbones, standing in front 
of an industrial workshop wall with worn paint textures, soft overcast natural 
light from above creating even soft shadows, candid pensive expression, 
shot on 85mm f/2, Kodak Portra 400, natural skin grain matching the scene texture
```

---

### 5.2 Street Photography

**Características distintivas:**
- Momentos decisivos no posados
- Contexto urbano visible
- Imperfecciones de composición intencionales
- Expresiones genuinas sin contacto con la cámara

**Estructura óptima:**
```
[Momento específico de acción], [sujeto con descripción específica no idealizada], 
[entorno urbano con detalles reales], [luz de calle auténtica], 
[35mm o 50mm], [ISO alto para grano de calle], [composición asimétrica]
```

**Palabras clave activadoras:**
```
candid street moment, unposed documentary, decisive moment, 
Leica street photography aesthetic, reportage style, 
slightly asymmetric framing, motion blur on background pedestrians, 
wet pavement reflections, urban texture and grit, 
street-level perspective
```

**Referentes fotográficos que funcionan como descriptores:**
```
Henri Cartier-Bresson decisive moment style
Vivian Maier self-portrait street style
Daido Moriyama high-contrast gritty Tokyo street
Saul Leiter color street photography layers
William Klein aggressive urban geometry
```

**Prompt de ejemplo — Street Photography:**
```
Candid street photograph in Tokyo, a salary-man in his 50s with loosened tie 
and tired eyes waiting for the subway, fluorescent station lights overhead 
creating harsh downward shadows, crowds blurred in motion around him, 
shot on Leica M6 with 35mm f/2 Summicron, Kodak Tri-X pushed to ISO 3200, 
high contrast black and white, gritty grain, unposed authentic moment
```

---

### 5.3 Fotografía Comercial de Producto

**Características distintivas:**
- El producto es el protagonista absoluto
- Iluminación controlada y limpia
- Sin distracciones del fondo
- Detalles de textura y acabado perfectamente visibles

**Estructura óptima:**
```
[Tipo de producto shot: hero/detail/lifestyle], [producto con descripción específica 
de materiales], [superficie/entorno que complementa], [sistema de iluminación 
controlado], [lente 50mm o 85mm a f/5.6-f/8], [profundidad de campo suficiente 
para mostrar todo el producto]
```

**Palabras clave activadoras:**
```
commercial product photography, studio still life, 
hero product shot, clean product render, 
packshot photography, e-commerce catalog style, 
precision softbox lighting, product details highlighted, 
controlled environment, white or neutral background, 
contact shadow beneath product, no props distracting from product
```

**Prompt de ejemplo — Producto:**
```
Commercial product photography of a matte black leather wallet with gold 
hardware, placed at a slight angle on a dark charcoal stone surface, 
two soft large softbox lights creating even illumination with a gentle 
shadow to the right, the leather texture is clearly visible with every 
grain and stitch defined, shot on 85mm lens at f/8, sharp focus throughout, 
high dynamic range, clean commercial aesthetic
```

---

### 5.4 Fotografía Editorial / Fashion

**Características distintivas:**
- Narrativa visual conceptual
- Vestuario como protagonista junto al modelo
- Composición experimental pero controlada
- Referencias a editoriales de revistas específicas

**Estructura óptima:**
```
[Referencia editorial: Vogue/i-D/AnOther], [concepto o narrativa específica], 
[modelo con look editorial], [entorno que apoya el concepto], 
[iluminación dramática o de estudio], [lente 85mm], 
[colorimetría específica]
```

**Palabras clave activadoras:**
```
high-fashion editorial, Vogue Italia aesthetic, 
avant-garde styling, couture fashion photography, 
editorial concept, structured composition, 
fashion story narrative, dramatic fashion lighting, 
beauty editorial, Harper's Bazaar spread style
```

**Prompt de ejemplo — Editorial Fashion:**
```
High-fashion editorial photograph in the style of Vogue, a model wearing 
a sculptural monochrome white structured coat, standing in a brutalist 
concrete architectural space, dramatic single softbox creating strong 
directional shadow emphasizing the garment's sculptural quality, 
sharp editorial gaze directly at camera, shot on 85mm f/1.4 lens, 
shallow depth of field separating model from concrete background, 
cinematic color grading with desaturated shadows
```

---

### 5.5 Fotografía Lifestyle / UGC

**Características distintivas:**
- Parece tomada por un usuario, no por un profesional
- Momentos cotidianos aspiracionales
- Iluminación natural sin estudio
- Imperfecciones que la hacen auténtica

**Estructura óptima:**
```
[Momento cotidiano específico], [persona común no modelo], 
[entorno doméstico o social auténtico], [luz natural de interior o exterior], 
[lente 35mm o 50mm], [ISO medio para algo de grano], 
[composición ligeramente imperfecta]
```

**Palabras clave activadoras:**
```
UGC style, user-generated content aesthetic, 
shot on iPhone naturally, candid everyday moment, 
authentic lifestyle photography, 
real person not model, slice of life, 
natural indoor lighting, slightly imperfect framing, 
genuine emotion not posed, relatable scene
```

**Prompt de ejemplo — Lifestyle:**
```
Candid lifestyle photograph, a 30-year-old woman with natural makeup and 
slightly messy morning hair, sitting cross-legged on a bed with white linen 
sheets holding a coffee mug with both hands, warm morning window light 
streaming from the left creating a soft cozy atmosphere, she's slightly 
smiling looking away from camera, shot on iPhone-style 28mm natural lens, 
natural skin texture visible, authentic everyday moment
```

---

### 5.6 Fotografía Documental / Fotojournalismo

**Características distintivas:**
- Autenticidad sobre estética
- Contexto social o histórico
- Imperfecciones técnicas aceptadas (grano, blur)
- El momento importa más que la composición perfecta

**Estructura óptima:**
```
[Momento o situación de importancia narrativa], 
[sujeto(s) en acción genuina], [entorno que cuenta la historia], 
[luz disponible no controlada], [35mm o 28mm], 
[ISO alto, grano de película, posibles imperfecciones técnicas]
```

**Palabras clave activadoras:**
```
documentary photography, photojournalism style, 
available light documentary, social documentary, 
unposed truthful moment, gritty authenticity, 
Magnum Photos aesthetic, National Geographic reportage, 
real moment captured, not staged, 
ethical documentary photography
```

---

## 6. 🚫 Cómo Evitar el "Look de AI"

### Los 10 Síntomas del Look de AI (Diagnóstico)

| Síntoma | Por qué ocurre | Solución |
|:---|:---|:---|
| **Piel de plástico / ceroso** | El modelo optimiza para "belleza" | Añadir: `natural skin texture, visible pores, slight skin imperfections` |
| **Ojos demasiado perfectos y brillantes** | Sobreoptimización de catchlights | Añadir: `natural eyes with realistic iris detail, not overly enhanced` |
| **Cabello perfectamente ordenado** | El modelo promedia texturas de cabello | Añadir: `slight hair flyaways, natural hair texture, not perfectly styled` |
| **Fondos perfectamente desenfocados y uniformes** | AI crea bokeh perfecto irreal | Añadir: `slightly irregular bokeh, natural lens aberration at edges` |
| **Simetría facial perfecta** | Promediar rostros produce simetría artificial | Añadir: `slight natural facial asymmetry, one side slightly different` |
| **Iluminación perfecta de estudio sin photoshoot** | El modelo aplica iluminación idealizada | Especificar luz natural imperfecta: `natural available light, soft uneven illumination` |
| **Manos con demasiados o muy pocos dedos** | Limitación arquitectural de difusión | Mostrar manos parcialmente o pedir: `hands naturally in pocket, or out of frame` |
| **Ropa sin arrugas ni textura** | El modelo promedia tejidos | Añadir: `natural fabric wrinkles, slight clothing texture, worn appearance` |
| **Fondos con elementos incoherentes** | Baja coherencia espacial de AI | Describir el fondo específicamente: `plain wall background, single texture` |
| **"Too perfect" composition** | El modelo optimiza composición para "estética" | Añadir: `slightly off-center framing, natural documentary composition` |

### 6.1 Técnicas de Imperfección Intencional

**Film Grain / Grano de Película:**
El grano de película es diferente del ruido digital — es orgánico, no uniforme, y tiene una textura que el ojo interpreta como "real":

```
subtle film grain throughout the image
35mm film grain, especially visible in dark areas
Kodak Portra grain structure
natural ISO noise pattern, not digital noise
organic grain texture in shadows
slight halation around highlights (característica de película analógica)
```

**Aberración Cromática:**
El color bleeding en los bordes de contraste es una imperfección real de lentes que delata autenticidad:

```
slight chromatic aberration at high contrast edges
subtle purple fringing on backlit areas
natural lens color separation at extremes
gentle chromatic aberration at corners (wide angle effect)
```

**Motion Blur Direccional:**
Movimiento realista, no posado:

```
slight motion blur on walking subject
natural hand motion blur
subject's clothing with subtle movement blur
hair moving slightly in wind, soft blur
```

### 6.2 Referencias de Películas Fotográficas — Los "Filtros" más Efectivos

| Película | Color Profile | Grain | Cuándo Usar |
|:---|:---|:---|:---|
| `Kodak Portra 400` | Cálido, piel natural, highlights suaves | Fino | Retrato, wedding, lifestyle |
| `Kodak Tri-X 400` | B&W alto contraste, negros profundos | Grueso | Street BW, documental |
| `Fujifilm Velvia 50` | Saturación alta, verdes intensos | Mínimo | Paisaje, naturaleza |
| `Fujifilm 400H` | Cool, suave, pastel | Fino | Moda casual, lifestyle |
| `Ilford HP5` | B&W versátil, tono medio | Medio | Todo en B&W |
| `Kodak Gold 200` | Cálido, vintage, ligero amarillo | Medio | Snapshots, vintage look |
| `Cinestill 800T` | Tungsten warm, halo rojo en luces | Grueso | Night, neon, cine |

### 6.3 El "Momento Decisivo" — La Táctica más Potente

El fotógrafo Henri Cartier-Bresson definió el "momento decisivo" como el instante en que composición, narrativa y acción se alinean perfectamente. En AI, describir un momento específico de acción no posada es la táctica más efectiva para evitar el look estático de AI:

```
❌ "a woman standing in front of a coffee shop"
✅ "a woman reaching for the door handle of a coffee shop, weight shifted forward, 
   eyes focused on the door, caught mid-motion in a candid moment"
```

---

## 7. 📊 Metadatos Fotográficos en Prompts — EXIF como Descriptores

Aunque los modelos AI no generan EXIF real, están entrenados en imágenes con metadatos reales y "reconocen" las correlaciones físicas entre parámetros técnicos. Usar la "triángulo de exposición" correctamente produce resultados mucho más auténticos.

### 7.1 ISO — Condición de Luz y Ruido

El ISO indica qué tan sensible era el sensor a la luz disponible. En fotografía real, más ISO = más ruido = más grano. Los modelos AI comprenden esta correlación.

| ISO | Condición de Luz Real | Efecto en Imagen | Descriptores AI |
|:---:|:---|:---|:---|
| `ISO 100` | Exterior soleado directo | Imagen limpia, sin grano | `ISO 100, clean image, no grain, bright daylight` |
| `ISO 200` | Exterior nublado o sombra | Casi sin grano | `ISO 200, bright overcast light, minimal grain` |
| `ISO 400` | Interior con luz natural | Grano muy sutil | `ISO 400 film, subtle grain texture, indoor natural light` |
| `ISO 800` | Interior con luz artificial | Grano notable | `ISO 800, visible grain, indoor artificial lighting` |
| `ISO 1600` | Oscuridad parcial, noche interior | Grano prominente | `ISO 1600, prominent grain, low light conditions` |
| `ISO 3200` | Noche, conciertos, lugares oscuros | Grano grueso dramático | `ISO 3200 pushed, heavy dramatic grain, available darkness` |
| `ISO 6400+` | Oscuridad extrema | Ruido/grano muy dramático | `ISO 6400, extreme grain, darkness, high noise texture` |

### 7.2 Apertura — El Control del Bokeh y la Luz

| Apertura | Profundidad de Campo | Bokeh | Descriptores AI |
|:---:|:---|:---|:---|
| `f/1.2` | Extremadamente poca (mm de enfoque) | Extremo, cremoso | `f/1.2 ultra-wide aperture, extreme bokeh, razor-thin focus plane` |
| `f/1.4` | Muy poca | Muy pronunciado | `f/1.4, very shallow DOF, smooth creamy background blur` |
| `f/1.8` | Poca (retrato estándar) | Prominente | `f/1.8, classic portrait bokeh, subject isolated` |
| `f/2.8` | Moderada | Notable | `f/2.8, gentle background separation, moderate bokeh` |
| `f/4` | Media | Leve | `f/4, moderate depth of field, slight background blur` |
| `f/5.6` | Amplia | Mínimo | `f/5.6, good overall sharpness, minimal background blur` |
| `f/8` | Muy amplia (estándar producto) | Prácticamente cero | `f/8, deep depth of field, everything sharp` |
| `f/11-16` | Máxima | Ninguno | `f/11, maximum depth of field, landscape all in focus` |

### 7.3 Velocidad de Obturación — El Control del Movimiento

| Velocidad | Efecto en Movimiento | Uso Típico | Descriptores AI |
|:---:|:---|:---|:---|
| `1/4000s` | Todo congelado, hasta gotas de agua | Deportes, pájaros | `frozen motion, extremely high shutter speed, no blur whatsoever` |
| `1/2000s` | Movimiento rápido congelado | Deportes, acción | `action frozen at high shutter speed, crisp motion stop` |
| `1/1000s` | Movimiento normal congelado | Personas caminando | `motion completely stopped, high shutter speed clarity` |
| `1/500s` | Movimiento cotidiano nítido | Retrato con movimiento | `crisp action, walking motion stopped cleanly` |
| `1/250s` | Leve blur en movimientos rápidos | Street photography | `slight motion suggestion in fastest elements` |
| `1/60s` | Blur en movimiento de manos | Interior, lifestyle | `subtle hand motion blur, slight movement in scene` |
| `1/30s` | Blur notable en personas | Night, bajo luz | `natural motion blur on moving subjects` |
| `1/15s o más lento` | Blur dramático, trails de luz | Noche, arte | `dramatic motion blur, light trails, long exposure effect` |

### 7.4 Combinaciones EXIF Completas para Situaciones Específicas

**Retrato de estudio profesional:**
```
shot at f/1.8, 1/200s, ISO 100 — clean studio conditions, 
sharp subject with beautiful bokeh, no motion blur, clean digital sensor
```

**Street photography nocturna:**
```
shot at f/2.8, 1/60s, ISO 3200 — low light street, 
noticeable grain especially in shadows, slight motion suggestion 
from passing pedestrians
```

**Fotografía deportiva exterior:**
```
shot at f/4, 1/2000s, ISO 400 — bright outdoor sporting event, 
action completely frozen, good depth of field to track subject
```

**Fotografía de producto en estudio:**
```
shot at f/8, 1/125s, ISO 100 — controlled studio, 
maximum product sharpness, deep depth of field, 
clean image with no grain or noise
```

---

## 8. 📋 20 Prompts de Ejemplo Comentados

### RETRATO

---

**Prompt #1 — Headshot Corporativo (Flux)**
```
RAW photograph, professional corporate headshot of a 38-year-old South Asian man 
with natural dark skin, subtle beard shadow, professional confidence in his direct 
gaze toward camera, wearing a well-fitted navy suit and white shirt with open collar, 
positioned against a soft blurred background of a modern office, three-point studio 
lighting setup with a large softbox key light from upper left creating clean shadow 
on right side, gentle fill light to avoid harsh contrast, subtle rim light separating 
from background, shot on 85mm f/1.8 prime lens, natural skin texture with slight 
skin pores visible, ISO 100, no grain, clean commercial quality
```

> **Desglose técnico:**
> - `RAW photograph` → activa modo fotorrealista Flux
> - `38-year-old South Asian man` → sujeto específico con edad y etnia (evita el "hombre genérico" de AI)
> - `natural dark skin, subtle beard shadow` → detalles físicos realistas que evitan la piel de plástico
> - `direct gaze toward camera` → contacto visual de conversión
> - `three-point studio lighting setup` → iluminación profesional específica
> - `85mm f/1.8` → retrato estándar con bokeh moderado
> - `natural skin texture with slight skin pores visible` → clave para evitar look de muñeca
> - **Trap evitada:** No usa "perfect skin", "smooth", ni "gorgeous"

---

**Prompt #2 — Retrato de Carácter (Flux + estilo film)**
```
35mm film photography, documentary portrait of an 65-year-old Oaxacan artisan woman, 
deep expressive wrinkles mapping decades of work and sun exposure, silver-streaked 
dark hair in a traditional braid, wearing a handwoven indigo huipil, looking slightly 
off-camera with a knowing quiet expression, photographed in soft overcast morning 
light inside a workshop with warm wood textures surrounding her, shot on Leica M6 
with 50mm f/2 Summicron, Kodak Portra 400 film grain, warm natural skin tones, 
authentic documentary character study
```

> **Desglose técnico:**
> - `35mm film photography` → activa el color y textura de película analógica
> - Descripción específica de arrugas, cabello y ropa → humaniza completamente, imposible de idealizar
> - `looking slightly off-camera` → el contacto directo con cámara a veces se ve artificial; off-camera es más documental
> - `Leica M6 con 50mm` → referencia de cámara de street photography que activa estética específica
> - `Kodak Portra 400 film grain` → el film stock más fotografiado del mundo, el modelo lo conoce bien
> - **Trap evitada:** No hay ningún token de belleza o perfección en todo el prompt

---

**Prompt #3 — Retrato de Belleza Comercial (GPT-Image-1)**
```
A photorealistic commercial beauty photograph of a 25-year-old woman with 
naturally radiant skin that shows real texture including visible pores and 
a slight flush on the cheeks. The lighting is a classic butterfly setup with 
a large beauty dish positioned slightly above and directly in front, creating 
a soft shadow beneath the nose and gentle fill from a reflector below. 
Her hair is naturally slightly tousled, not overly styled. 
The camera is positioned at a flattering slight downward angle. 
Shot on an 85mm lens at f/2.8 with shallow depth of field. 
The overall feel is naturally beautiful, not digitally retouched.
```

> **Desglose técnico (GPT-Image-1):**
> - Lenguaje natural completo, no keyword soup
> - "naturally radiant skin that shows real texture including visible pores" → refuerza autenticidad
> - Descripción física del setup de iluminación como lo haría un director de foto
> - "naturally slightly tousled, not overly styled" → directriz negativa dentro del lenguaje natural
> - "overall feel is naturally beautiful, not digitally retouched" → instrucción anti-AI al final

---

**Prompt #4 — Environmental Portrait (Nano Banana)**
```
Photorealistic environmental portrait photography, a 42-year-old male chef with 
genuine fatigue in his eyes from a long service, wearing a slightly stained white 
chef's coat, standing in the warm glow of a professional kitchen with practical 
cooking light, physics-based lighting from multiple overhead sources creating 
complex real shadows, 35mm environmental portrait lens perspective showing kitchen 
context behind him, texture emphasis: skin pores, steam in background, worn fabric 
texture on coat, natural imperfections in the setting, not studio-posed
```

> **Desglose técnico (Nano Banana):**
> - `physics-based lighting` → descriptor específico efectivo para Nano Banana
> - `texture emphasis:` → seguido de lista específica, activador efectivo para el modelo
> - "not studio-posed" → directriz anti-AI específica
> - El contexto del chef con "slightly stained white chef's coat" → imperfección específica que hace real

---

### STREET PHOTOGRAPHY

---

**Prompt #5 — Street Clásico Blanco y Negro (Flux)**
```
35mm black and white documentary photograph, candid street scene in Mexico City 
historic center, an elderly man in his 70s selling newspapers on a corner, 
completely absorbed in reading one of his own papers, unaware of the camera, 
morning overcast light creating even soft illumination with no harsh shadows, 
people softly blurred in background going about their day, shot on Leica M11 
with 35mm f/2.8, Kodak Tri-X pushed to ISO 1600, high contrast black and white, 
visible gritty grain structure, authentic Magnum documentary style, 
no eye contact with camera, genuine unposed moment
```

> **Desglose técnico:**
> - "unaware of the camera" → el mejor descriptor para evitar el look de "pose de AI"
> - `Kodak Tri-X pushed to ISO 1600` → específico film stock + push development = grano grueso real
> - `people softly blurred in background` → añade movimiento y vida real al entorno
> - `Magnum documentary style` → referencia a la agencia de fotoperiodismo más famosa del mundo

---

**Prompt #6 — Street Color Contemporáneo (Flux)**
```
Candid color street photograph, Tokyo Shibuya crossing at night, a young woman 
in her 20s in colorful streetwear mid-stride through the crossing surrounded by 
a sea of other pedestrians, neon advertising signs reflecting on wet pavement, 
slight motion blur on her feet and the surrounding crowd suggesting movement, 
mixed practical light from storefronts: warm orange on right side, cool blue from 
LED screen on left, creating complex color cross-lighting, shot on 35mm f/2.8 lens, 
ISO 1600 for street conditions, visible digital noise consistent with high ISO, 
cinematic color grade with preserved neon colors
```

> **Desglose técnico:**
> - "mid-stride through the crossing" → acción específica, no posada
> - "surrounding crowd" con "slight motion blur" → añade vida y autenticidad urbana
> - Descripción de fuentes de luz múltiples y sus colores → iluminación compleja = más real
> - `ISO 1600 for street conditions` → el ISO explicado por la condición real que lo motivaría

---

**Prompt #7 — Street con Clima (GPT-Image-1)**
```
A photorealistic candid street photograph taken during light rain in a European 
cobblestone street. The subject is a middle-aged woman with a bright red umbrella 
walking away from camera, her figure slightly blurred suggesting movement. 
The cobblestones reflect the grey overcast sky and the red of her umbrella creates 
a strong color contrast against the muted tones of the wet street. 
Other pedestrians appear as soft moving forms in the background. 
The photograph feels genuinely spontaneous, with the slight imperfections 
of handheld photography in difficult weather conditions. 
Shot on a 35mm lens with natural available light, ISO 800, slight grain visible.
```

---

### FOTOGRAFÍA COMERCIAL DE PRODUCTO

---

**Prompt #8 — Hero Shot de Producto (Flux)**
```
Commercial product photography hero shot, a premium matte black ceramic coffee 
mug with minimalist brushed gold handle, positioned at a 3/4 angle on a polished 
dark slate surface, freshly brewed coffee steam rising gently from the cup, 
a single large softbox diffused light from the upper-left creating a clean 
highlight along the left edge of the mug, soft shadow extending to the right, 
the steam slightly backlit creating atmospheric depth, shot on 85mm lens at f/8 
for complete product sharpness, clean commercial photography, 
studio-controlled environment, no props competing with the product
```

---

**Prompt #9 — Lifestyle de Producto (Flux)**
```
Premium lifestyle product photograph, a luxury leather-bound notebook placed 
open on a natural wooden work desk next to a steaming cup of tea and reading 
glasses, warm morning window light from the left casting long gentle shadows 
across the desk surface, the notebook shows handwritten notes in a real script 
style, a few dried flowers in a small vase softly out of focus in the background, 
shot on 50mm f/4 lens, deep enough depth of field to show product clearly while 
background remains slightly soft, Kodak Portra 400 warm color grading, 
aspirational but authentic work morning scene
```

---

**Prompt #10 — Detalle de Textura (Nano Banana)**
```
Extreme close-up commercial product photography, a luxury Swiss mechanical watch, 
precision macro photography focusing on the watch face showing intricate dial details 
and sapphire crystal, physics-based single directional light from upper right creating 
micro-shadows that reveal the three-dimensional texture of each numeral and hand, 
the metal bracelet links reflect the studio light with accurate specular highlights, 
texture emphasis: brushed metal grain, anti-reflective crystal coating, 
milled seconds markings, f/8 maximum sharpness, 105mm macro lens
```

---

### EDITORIAL / FASHION

---

**Prompt #11 — Fashion Editorial Dramático (Flux)**
```
High-fashion editorial photograph in the style of Vogue Italia, a model with 
strong angular features wearing a sculptural black architectural coat with 
structured shoulders, standing in stark white brutalist concrete corridor, 
dramatic single spotlight from above creating a sharply defined pool of light 
on the model and leaving the rest in deep shadow, the coat's structural form 
emphasized by the hard light, model's gaze is intense and directly at camera, 
shot on 85mm f/1.4 lens, classic editorial framing, 
strong chiaroscuro contrast, desaturated editorial color grade
```

---

**Prompt #12 — Belleza Editorial (GPT-Image-1)**
```
A high-fashion beauty editorial photograph for a luxury magazine. The model has 
striking bone structure with natural skin that shows realistic texture and imperfections. 
She wears a bold architectural avant-garde headpiece and dramatic dark eye makeup. 
The lighting is a precise butterfly setup creating a defined shadow beneath the nose 
and strong cheekbone definition. The background is a seamless deep charcoal grey. 
The image quality suggests it was shot on an 85mm lens at f/2.8, with the subject 
in razor-sharp focus while the background is rendered in a completely smooth, 
creamy out-of-focus graduation. The mood is severe, powerful, and unapologetically high-fashion.
```

---

**Prompt #13 — Street Fashion Editorial (Flux)**
```
Fashion editorial street photography, high-fashion model wearing a luxurious oversized 
camel wool coat and tall leather boots, walking purposefully through a rain-slicked 
Paris street at dusk, cobblestones reflecting the warm orange glow of a street lamp 
ahead, slight motion blur on the coat hem and walking motion suggesting determined 
stride, editorial gaze directed slightly above camera not directly at it, 
shot on 35mm film, f/2.8, blue hour ambient light mixed with warm practical 
street lighting, Vogue Paris editorial aesthetic
```

---

### LIFESTYLE / UGC

---

**Prompt #14 — Morning Routine (Flux + UGC style)**
```
UGC organic photograph, shot on iPhone 15 natural lens, a 27-year-old woman 
with natural no-makeup skin, morning hair still slightly disheveled from sleep, 
sitting at a wooden kitchen table with morning light streaming through curtains, 
both hands wrapped around a large ceramic mug of coffee, looking contentedly 
at the steam rising, not at the camera, warm morning golden light creating 
a cozy authentic atmosphere, natural pores and skin texture visible, 
slight digital blur from iPhone computational photography, 
authentic everyday moment, no professional lighting, no professional setup
```

---

**Prompt #15 — Outdoor Lifestyle (Nano Banana)**
```
Authentic lifestyle photograph, a 33-year-old man hiking on a mountain trail, 
wearing practical outdoor gear showing real wear, stopping to look at a distant 
mountain view, backpack slung on one shoulder, caught in a genuine candid moment 
of rest and contemplation, physics-based bright overcast natural light providing 
even outdoor illumination, texture emphasis: worn fabric on jacket, 
dusty hiking boots, natural skin with sun-touched color and slight wind-burn, 
35mm environmental lens showing landscape context, ISO 400 clean image, 
authentic adventure without overproduction
```

---

**Prompt #16 — Social Lifestyle (GPT-Image-1)**
```
A photorealistic candid lifestyle photograph of three friends in their late 20s 
seated around an outdoor café table in bright warm afternoon sunlight. 
They are mid-conversation and mid-laugh, none of them looking at the camera. 
Wine glasses and small plates with food on the table show the scene is real and 
lived-in. The light is warm afternoon golden hour creating natural shadows on their 
faces. The background shows a lively outdoor terrace with other patrons softly 
out of focus. Shot on a 35mm lens with natural available light, f/4, 
the image feels genuinely spontaneous rather than directed.
```

---

### DOCUMENTAL

---

**Prompt #17 — Fotoperiodismo (Flux)**
```
Documentary photojournalism photograph, a 50-year-old market vendor in Marrakech 
arranging fresh spice piles in his stall, completely absorbed in his work, 
completely unaware of the camera, warm morning market light from an overhead 
skylight creating dramatic shafts of light through dust particles in the air, 
the spice colors — turmeric yellow, paprika red, cumin brown — all vibrant 
in the warm shaft of light, shot on Leica M11 35mm f/2, 
candid documentary moment, Sebastião Salgado photojournalism aesthetic, 
no artificial staging, authentic labor and craft
```

---

**Prompt #18 — Documental Urbano (GPT-Image-1)**
```
A photorealistic documentary photograph capturing a genuine moment of urban life. 
An elderly woman sits alone on a public bench in a city park, surrounded by 
pigeons that have gathered around her feet as she scatters bread crumbs. 
She wears a practical winter coat and comfortable shoes suggesting a person 
of modest means and daily routine. The light is soft and overcast, creating 
even natural illumination without dramatic shadows. 
The background shows the park in natural mid-morning light with other park users 
visible but out of focus and going about their own activities. 
The photograph has the quiet dignity and observational quality of documentary 
photography — watching life rather than directing it.
```

---

### TÉCNICOS EXPERIMENTALES

---

**Prompt #19 — Fotografía de Película Caducada (Flux)**
```
Expired film photograph with characteristic color shifts, a couple at golden hour 
on a rooftop overlooking a city at sunset, warm scene with film emulsion degradation 
showing slight green-magenta color cast in shadows, mild light leaks on one edge 
of the frame suggesting actual film damage, slightly desaturated highlights with 
color blooming, film sprocket marks barely visible at edge (35mm film strip), 
actual expired Kodak Gold 200 film aesthetic, vintage 1990s photography feel, 
all imperfections as authentic features not mistakes, genuine analog warmth
```

> **Por qué funciona:**
> - Las "imperfecciones" están explícitamente descritas como características auténticas
> - El color cast específico (green-magenta) es una imperfección de película caducada real
> - "not mistakes" → instrucción directa para que el modelo no "corrija" los defectos intencionales

---

**Prompt #20 — Doble Exposición Fotoquímica (Flux)**
```
In-camera double exposure 35mm film photograph, a portrait of a young woman 
overlaid with an architectural exposure of a forest of bare winter trees, 
the two exposures merging so her face floats ghost-like within the tree branches, 
processed in Kodak Portra 400 film color palette, the double exposure technique 
creates natural halation and tonal overlap between skin tones and grey winter bark, 
shot in portrait 85mm f/2.8 for first exposure, 35mm for the architectural second, 
authentic analog double exposure technique result, not digital compositing
```

---

## 🔑 Tabla Master de Referencia Rápida

### Tokens por Categoría — Copia y Pega

**Para activar fotorrealismo BASE (cualquier modelo):**
```
RAW photo, candid documentary photograph, natural skin texture with visible pores,
genuine unposed moment, available light photography, shot on [camera] with [lens]mm lens
```

**Para el RETRATO perfecto:**
```
85mm f/1.8, shallow depth of field, soft window light from [dirección], 
slight natural facial asymmetry, natural pores visible, not overly retouched
```

**Para STREET auténtico:**
```
35mm candid street photograph, unaware of camera, documentary style, 
Kodak Tri-X grain, slight motion blur on [elemento], decisive candid moment
```

**Para PRODUCTO comercial:**
```
commercial product photography, softbox studio lighting, 85mm f/8, 
deep depth of field, all product details sharp, clean controlled studio environment
```

**Para EDITORIAL fashion:**
```
high-fashion editorial, dramatic [tipo] lighting, 85mm f/1.4, 
[referencia de revista] aesthetic, editorial gaze, cinematic color grade
```

**Para EVITAR el look de AI siempre:**
```
slight natural imperfections, natural skin texture, not digitally retouched, 
slightly irregular [elemento], natural [material] texture visible, 
genuine candid not staged
```

---

## 🧠 Principios Maestros del Hiperrealismo AI

1. **La física antes que la estética:** Describe cómo funciona la luz, no cómo se ve. *"Light coming through window creating shadow on opposite wall"* en vez de *"beautiful lighting"*.

2. **La imperfección es la clave:** Una imagen perfecta delata AI. Cada imperfección intencional — grano, asimetría, blur, aberración — añade autenticidad.

3. **El sujeto primero, la técnica después:** Primero describe quién es la persona con detalles específicos no idealizados. Luego añade la técnica fotográfica.

4. **Evita la belleza genérica:** Palabras como "beautiful", "gorgeous", "perfect", "stunning" activan el modo idealización del AI. Úsalas si quieres un resultado de moda/belleza, evítalas si quieres documentalismo.

5. **La cámara como personaje:** Especificar la cámara real (Leica M11, Sony A7R IV, Fujifilm GFX100S) no es cosmético — activa asociaciones de color science, óptica y estética específicas que el modelo aprendió de millones de fotos reales.

6. **El ISO cuenta la historia de la luz:** ISO 3200 dice "estoy en un bar oscuro de jazz". ISO 100 dice "estoy en una playa a mediodía". El modelo entiende la narrativa de luz detrás del número.

7. **El momento, no la pose:** El mejor antídoto al look de AI es describir una acción en progreso, no una pose estática.

---

#fotografía-ai #hiperrealismo #flux #gpt-image-1 #nano-banana #prompt-engineering #fotografia-profesional #bokeh #lighting #street-photography #portrait #editorial #documental #producto #obsidian-wiki
