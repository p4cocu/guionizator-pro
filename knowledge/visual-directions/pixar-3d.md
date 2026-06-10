# Pixar 3D Prompts: Guía Maestra para Replicar Animación 3D de Estudio con Modelos AI

> [!NOTE]
> **Base de Conocimiento de Referencia para Flux · GPT-Image-1 · Nano Banana**
> Esta guía enciclopédica está diseñada para que creadores de contenido e IA puedan generar imágenes con la estética visual exacta de las principales productoras de animación 3D mundial: Pixar, DreamWorks e Illumination. Cubre desde los tokens de activación correctos hasta estrategias de consistencia de personaje y aplicación publicitaria.

---

## 🎬 1. Anatomía Visual de los Tres Grandes Estudios

Comprender la "firma visual" de cada estudio es el punto de partida. Sin este mapa, los modelos AI producirán un "3D genérico" sin identidad reconocible.

### 1.1 Pixar Animation Studios — La Física de la Emoción

El estilo Pixar no es un look superficial; es una filosofía de renderizado que prioriza la **autenticidad emocional sobre la exageración**. Los personajes parecen poder tocarse, sus pieles reaccionan a la luz como tejido real y sus entornos tienen una densidad visual que invita a explorar cada centímetro.

| Característica Visual | Descripción Técnica | Token / Descriptor Clave |
| :--- | :--- | :--- |
| **Proporciones** | Realistas-aumentadas: cuerpos casi humanos, cabezas 15-20% más grandes, ojos 25% más grandes que en la realidad, narices pequeñas | `slightly enlarged head, expressive oversized eyes, small button nose` |
| **Piel y SSS** | Subsurface scattering extremo: la luz penetra la piel y se dispersa, creando un color rosado-cálido en zonas de luz directa. Poros visibles pero suavizados | `translucent skin with subsurface scattering, warm undertones, soft pore texture` |
| **Iluminación** | Global Illumination compleja, luz que rebota entre superficies, creando colores secundarios. Shadows suaves con penumbra. Rim light delicado | `Pixar-quality global illumination, soft shadow falloff, subtle warm rim light` |
| **Paleta Cromática** | Naturalista-vibrante: colores basados en la realidad pero con saturación elevada al 130-150%. Uso estratégico de colores complementarios | `vibrant naturalistic color palette, warm amber and teal complementary scheme` |
| **Materiales** | Shaders físicamente correctos (PBR): telas con microfibers, madera con vetas reales, metales con anisotropía | `photorealistic material shaders, fabric microfiber detail, PBR rendering` |
| **Ojos** | Iris de cristal con capas: capa de reflejo exterior, iris con variaciones de color, pupila profunda. Catchlight (punto de luz especular) siempre presente | `glass-like iris with multiple layers, detailed catchlight, deep sclera` |
| **Pelo** | Strands individuales simulados, con peso y gravedad. Highlights suaves tipo seda. Sin look de "casco plástico" | `strand-based hair simulation, soft silk highlights, natural hair flow with gravity` |
| **Entornos** | Ultra-detallados con historia: polvo en los muebles, desgaste en las paredes, plantas que crecen en grietas | `Pixar environment storytelling detail, aged surfaces, atmospheric dust particles` |

**Películas de referencia clave:** Coco (2017) — paleta más saturada y rica, Up (2009) — balance perfecto realismo/fantasía, Soul (2020) — textura de piel más hiperrealista

---

### 1.2 DreamWorks Animation — El Teatro de la Exageración

DreamWorks opera en un registro diferente: sus personajes son más performativos, más teatrales. El humor visual es más agresivo, las proporciones más distorsionadas, y la iluminación se usa dramáticamente para potenciar las actuaciones.

| Característica Visual | Descripción Técnica | Token / Descriptor Clave |
| :--- | :--- | :--- |
| **Proporciones** | Exageración máxima: cabezas muy grandes (30-40% del cuerpo), ojos enormes, mandíbulas pequeñas, cuerpos esbeltos o masivos sin término medio | `exaggerated cartoon proportions, oversized head, large expressive eyes, defined jaw` |
| **Ojos** | Los más grandes de la industria. Iris casi cubren toda la esclera. Highlights múltiples. Capaz de comunicar 20 emociones distintas en 3 frames | `DreamWorks-style mega eyes, multiple iris highlights, extremely expressive pupils` |
| **La "Cara DreamWorks"** | Término de la industria: una ceja levantada, semismile asimétrico, mirada de lado. Comunica sarcasmo, confianza o humor | `one eyebrow raised, asymmetric smirk, sideways confident glance, DreamWorks expression` |
| **Iluminación** | Más dramática y direccional. Key light fuerte, menos fill, sombras más definidas. Uso frecuente de rim lights de colores para separar personajes | `dramatic directional lighting, strong key light, colored rim lights, defined cast shadows` |
| **Materiales** | Shaders más estilizados que Pixar: piel con menos poros, telas más "limpias", menos envejecimiento en los materiales | `stylized cartoon shaders, clean material surfaces, reduced texture complexity` |
| **Paleta** | Más saturada y contrastada que Pixar. Uso de colores primarios intensos. Fonds con gradientes dramáticos | `high-saturation color palette, bold primary color scheme, dramatic gradient backgrounds` |
| **Anatomía** | Físicamente imposible pero visualmente coherente: torsos alargados, hombros anchos, piernas delgadas | `stylized impossible anatomy, elongated torso, strong silhouette design` |

**Películas de referencia:** Shrek (2001-2010), How to Train Your Dragon (2010), The Bad Guys (2022)

---

### 1.3 Illumination Entertainment — Pop Art en 3D

Illumination (los creadores de Minions) tiene el estilo más reconocible por su simplicidad radical. Sus personajes son formas geométricas básicas con personalidad explosiva. Menos es más: menos detalle, más carácter.

| Característica Visual | Descripción Técnica | Token / Descriptor Clave |
| :--- | :--- | :--- |
| **Proporciones** | Cuerpos geométrico-simplificados: cilindros, esferas, cubos redondeados. Minimalismo estructural máximo | `geometric simplified body shapes, rounded cylinder forms, minimal anatomical detail` |
| **Colores** | Los más saturados de la industria. Amarillo Pantone de los Minions. Paleta pop, casi neón | `maximum color saturation, Illumination pop palette, bright neon-adjacent colors` |
| **Ojos** | Tipos variados: lentes de seguridad para Minions, ojos grandes simples para otros personajes. Siempre con highlight blanco circular | `Illumination-style circular eyes, round iris, single white circular catchlight` |
| **Cel Shading** | Suave cel shading que aplana ligeramente las superficies, creando un look entre 2D y 3D. Menos SSS que Pixar | `soft cel shading, semi-flat surface rendering, reduced subsurface complexity` |
| **Texturas** | Mínimas: piel sin poros, ropa sin microfibers. Lo que importa son los colores y las formas | `minimal surface texture, smooth skin shader, flat color blocking with subtle gradients` |
| **Expresiones** | Físicamente imposibles: ojos que se convierten en formas geométricas, bocas que se agrandan 3x, cuerpos que se deforman totalmente | `Illumination rubber hose deformation, squash and stretch animation style, exaggerated facial deformation` |
| **Entornos** | Más limpios y menos detallados que Pixar/DreamWorks. Fondos con menos "historia" y más estética de parque temático | `clean colorful environments, minimal environmental storytelling, bright open spaces` |

**Películas de referencia:** Despicable Me (2010-2022), The Super Mario Bros Movie (2023), Migration (2023)

---

## 🔑 2. Tokens de Activación por Modelo AI

Cada modelo AI tiene su propio "vocabulario de activación". Usar los tokens incorrectos en el modelo equivocado produce resultados genéricos. Esta es la diferencia entre un resultado de 3 estrellas y uno de 5 estrellas.

### 2.1 Flux (fal.ai / Flux.1 Pro / Flux.1 Dev)

Flux responde mejor a vocabulario técnico de render 3D compacto y referencias de software específicas. Es el modelo más "técnico" de los tres.

| Objetivo | Tokens de Alta Activación | Tokens a EVITAR |
| :--- | :--- | :--- |
| **Activar 3D de alta calidad** | `octane render, 8K resolution, hyperdetailed 3D animation, studio quality CGI, photorealistic cartoon render` | `cartoon` solo, `drawing`, `illustration` |
| **Estilo Pixar específico** | `Pixar-style 3D animation, RenderMan quality, subsurface scattering skin shader, global illumination` | `Pixar art style` (activa look 2D), `animated movie poster` |
| **Estilo DreamWorks** | `DreamWorks 3D animation style, hyperexpressive character design, theatrical lighting setup, stylized cartoon render` | `shrek style` (puede violar derechos/confundir) |
| **Estilo Illumination** | `Illumination Entertainment CGI, cel-shaded 3D render, saturated pop colors, simplified geometric character` | `minion style` específico |
| **Calidad de render** | `Arnold renderer, V-Ray quality, photon mapping, ray tracing, ambient occlusion, HDRI lighting` | `realistic` solo (sin contexto 3D puede ir a fotografía) |
| **Materiales orgánicos** | `subsurface scattering, translucent skin material, organic shader, PBR material workflow` | `skin texture` solo (puede producir piel hiperrealista no deseada) |

**Fórmula maestra Flux para estilo Pixar:**
```
3D animated character, [descripción del personaje], Pixar-style CGI, subsurface scattering skin, 
global illumination, octane render, 8K detail, cinematic studio lighting, soft ambient occlusion, 
vibrant naturalistic color palette, [entorno], cinematic composition
```

---

### 2.2 GPT-Image-1 (OpenAI)

GPT-Image-1 responde mejor a **descripciones narrativas y cinematográficas** que a términos técnicos puros. Funciona como si le describieras a un director de arte lo que quieres ver. Menos jerga de render, más lenguaje de película.

| Objetivo | Tokens de Alta Activación | Tokens a EVITAR |
| :--- | :--- | :--- |
| **Activar estilo Pixar** | `in the visual style of a Pixar animated film, as if from a Pixar movie, Pixar feature film quality` | `octane render` (confunde el modelo con tecnicismos sin contexto) |
| **Calidad cinematográfica** | `cinematic 3D animation quality, movie-production CGI, feature film animation, big-budget studio animation` | `4K render` solo (activa fotografía no animación) |
| **Iluminación descriptiva** | `warm studio lights wrapping around the character, soft shadows falling naturally, light bouncing off surfaces` | `global illumination` técnico sin contexto |
| **Personaje expresivo** | `the character has large bright eyes full of emotion, rounded friendly features, the face shows [emoción]` | `cartoon eyes` solo (puede ir a 2D) |
| **Materiales narrativos** | `the skin glows softly in the light as if translucent, the hair catches the light like real strands` | `subsurface scattering` (puede confundir GPT-Image-1) |
| **DreamWorks** | `in the style of a DreamWorks animated feature, theatrical expressive character, bold animation style` | `DreamWorks` solo (necesita contexto) |
| **Consistency** | `consistent character design throughout, same character as before with identical features` | — |

**Fórmula maestra GPT-Image-1 para estilo Pixar:**
```
A [descripción del personaje] in the visual style of a Pixar animated feature film. 
The character has [rasgos físicos detallados]. The scene is lit with warm soft studio lighting 
that wraps around the character and creates gentle shadows. The skin appears translucent and 
glowing in the light. The eyes are large, detailed, and filled with emotion. 
The overall quality matches a Pixar feature film, with rich colors and cinematic depth.
[Entorno y acción]. Vibrant, warm, emotionally resonant color palette.
```

---

### 2.3 Nano Banana

Nano Banana tiene un motor de comprensión más literal. Responde a una combinación de **nombres de película o personaje como referencia estilística** más **descriptores visuales directos**. El modelo necesita "anclajes culturales" para activar el estilo correcto.

| Objetivo | Tokens de Alta Activación | Tokens a EVITAR |
| :--- | :--- | :--- |
| **Activar 3D animado** | `3D animated movie style, CGI animated character, animated feature film aesthetic` | `render 3D` en español (el modelo procesa mejor en inglés) |
| **Estilo Pixar** | `Pixar movie aesthetic, animation studio quality, 3D cartoon with realistic lighting` | `como Pixar` o términos mixtos español/inglés |
| **Personaje expresivo** | `cute 3D animated character with big eyes, rounded features, friendly cartoon face` | `hyperrealistic cartoon` (genera confusión en el modelo) |
| **Iluminación** | `soft cinematic lighting, warm glow, light wrapping around the subject, bright colorful scene` | `global illumination`, `ambient occlusion` (demasiado técnico) |
| **Alta calidad** | `high quality 3D animation, detailed animated character, studio animation quality` | `8K`, `hyperdetailed` (puede no activar modo animación) |
| **Paleta** | `vibrant saturated colors, bright cheerful palette, rich animation colors` | Términos específicos de colorimetría |

**Fórmula maestra Nano Banana para estilo Pixar:**
```
High quality 3D animated character in Pixar movie aesthetic. [Descripción del personaje] 
with big expressive eyes and rounded friendly features. Soft cinematic lighting with warm 
glow. Vibrant saturated colors. Detailed animated textures. Studio animation quality. 
[Entorno colorido y detallado].
```

---

## 💡 3. Iluminación 3D: El Lenguaje Técnico Completo

La iluminación es lo que separa un render 3D profesional de uno de aficionado. Estos son los descriptores técnicos más poderosos y cómo usarlos:

### 3.1 Glosario de Técnicas de Iluminación 3D

| Técnica | Qué es | Token Exacto | Efecto Visual |
| :--- | :--- | :--- | :--- |
| **Subsurface Scattering (SSS)** | La luz penetra la superficie y se dispersa internamente, creando ese glow rosado en las orejas, dedos y zonas delgadas de piel | `subsurface scattering, translucent skin with inner light glow` | Piel que parece viva, ojos que brillan desde dentro, orejas con tono rosado en contraluz |
| **Ambient Occlusion (AO)** | Oscurece automáticamente las zonas donde dos superficies se encuentran o están muy juntas: pliegues de ropa, axila, zona detrás de las orejas | `ambient occlusion in crevices, contact shadows in tight spaces` | Profundidad y peso en los objetos, sensación de que los elementos "tocan" la superficie |
| **Global Illumination (GI)** | La luz rebota entre superficies y "pinta" colores secundarios. Un objeto rojo junto a un personaje tiñe su piel de rojo | `global illumination, color bleeding from environment, light bouncing off surfaces` | Escenas que se sienten cohesionadas, colores que "hablan" entre sí, realismo atmosférico |
| **Rim Light / Back Light** | Luz detrás y ligeramente a un lado del personaje que dibuja su silueta, separándolo del fondo | `rim light separating character from background, edge light highlight, backlit silhouette glow` | Separación dramática del personaje, sensación de presencia volumétrica, looks cinematográficos |
| **Key Light (Luz Principal)** | La fuente de luz dominante que da forma al personaje. Define las sombras principales | `strong key light at 45 degrees, Rembrandt lighting pattern, defined main light source` | Moldea el volumen del rostro, crea la jerarquía lumínica de la escena |
| **Fill Light (Luz de Relleno)** | Luz secundaria, suave, que rellena las zonas de sombra del Key Light. Controla el ratio de contraste | `soft fill light reducing shadow harshness, wrap-around fill lighting` | Controla cuántas sombras se ven, define el "mood" de la escena |
| **HDRI Lighting** | Iluminación basada en una imagen de 360° del entorno real, que produce reflexiones y iluminación ambientales realistas | `HDRI environment lighting, studio HDRI, natural outdoor HDRI illumination` | Reflexiones realistas en superficies especulares, iluminación ambiental coherente |
| **Three-Point Lighting** | Setup clásico de estudio: Key + Fill + Rim. El triángulo de oro de la iluminación cinematográfica | `three-point studio lighting setup, key fill and rim light composition` | Personajes bien iluminados, tridimensionales, con separación clara del fondo |
| **Caustics** | Patrones de luz que se forman cuando la luz pasa por materiales transparentes (vidrio, agua) | `light caustics through glass, water caustic patterns on floor` | Realismo extremo en escenas con agua o vidrio |
| **Volumetric Lighting** | Luz visible en el aire: rayos de sol con polvo, niebla iluminada, dios-rays | `volumetric light rays, atmospheric light shafts, god rays through window` | Profundidad atmosférica, mood dramático, sensación de espacio |

### 3.2 Combinaciones de Iluminación por Mood en Animación 3D

| Mood/Escena | Combinación de Luces | Prompt de Iluminación Completo |
| :--- | :--- | :--- |
| **Calidez familiar (Pixar clásico)** | Key cálido + Fill neutral + Rim dorado + GI activo | `warm golden key light at 45°, neutral soft fill, warm rim light, global illumination with color bleeding from warm surfaces, ambient occlusion in fabric folds` |
| **Aventura épica (DreamWorks)** | Key dramático + Rim de color + Sombras definidas | `dramatic side key light, colored rim light, strong shadow definition, high contrast theatrical lighting` |
| **Comedia pop (Illumination)** | High-key luz uniforme + Colores saturados + Sin sombras duras | `bright high-key lighting, even soft illumination, vibrant color response, minimal hard shadows, cheerful studio lighting` |
| **Escena nocturna mágica** | Rim de luna azul + Puntos de luz cálidos + GI oscuro | `cool moonlight rim, warm practical light sources, dark global illumination, subsurface scattering on skin in moonlight` |
| **Interior dramático** | Low-key + Key lateral + Volumetric | `low-key dramatic lighting, side key light, volumetric light shaft, deep shadows, ambient occlusion emphasizing depth` |

---

## 🎭 4. Materiales y Texturas: Cómo Describir los Shaders de Animación

### 4.1 Skin Shader — Piel de Personaje Animado

La piel es el material más complejo de la animación 3D. La diferencia entre "plástico" y "vivo" depende de estos descriptores:

| Nivel de Detalle | Descriptor Técnico | Cuándo Usarlo |
| :--- | :--- | :--- |
| **Básico** | `smooth cartoon skin with soft shading` | Estilo Illumination, personajes simples |
| **Intermedio** | `stylized skin with subtle pore texture, warm tone subsurface` | Estilo DreamWorks, personajes secundarios Pixar |
| **Avanzado (Pixar)** | `hyper-detailed skin shader with visible pores, subsurface scattering creating warm pink glow under cheeks, translucent ear tips in backlight, micro-bump normal map on skin surface` | Protagonistas Pixar, primeros planos extremos |
| **Bebés/Niños** | `smooth baby-soft skin, extra SSS glow, round chubby cheeks, no visible pores, peach-warm complexion` | Personajes infantiles, Boo de Monsters Inc., Ellie de Up |
| **Ancianos** | `skin with stylized wrinkle depth maps, reduced SSS, matte finish areas, age spots suggestion, saggy jowl shading` | Carl de Up, Edna Mode, personajes adultos mayores |

### 4.2 Cartoon Eyes — Los Ojos Son el Alma

Los ojos en animación 3D son el elemento más importante. Una jerarquía de capas:

```
ESTRUCTURA DEL OJO ANIMADO (de exterior a interior):
1. Specular highlight layer (punto de luz exterior, blanco)
2. Sclera (blanco del ojo) — con SSS suave y venas mínimas
3. Iris (capa de cristal) — con variaciones de color y textura
4. Pupila (negra profunda, que puede deformarse para expresión)
5. Catchlight (reflexión del entorno, da vida)
```

| Tipo de Ojo | Descriptor Completo | Referencia de Personaje |
| :--- | :--- | :--- |
| **Ojos Pixar estándar** | `large rounded iris with multiple color layers, bright specular catchlight, slightly off-white sclera, expressive pupils capable of subtle deformation, glass-like cornea reflection` | WALL-E, Nemo, Joy |
| **Ojos DreamWorks extremos** | `enormous iris covering 80% of eye area, multiple bright catchlights, highly expressive pupils, dramatic color depth in iris, theatrical eye whites` | Puss in Boots, DnD dragon |
| **Ojos Illumination simples** | `round solid-color iris, single circular catchlight, clean simplified eye design, no complex layering, bold outlined pupils` | Gru, Minions (lentes) |
| **Ojos de criatura/animal** | `non-human iris shape (slit/horizontal/circular), natural animal coloring, reflective tapetum effect, wild expressive capability` | Sisu (Raya), Toothless |

### 4.3 Stylized Hair — Cabello Sin Ser Fotografía

El cabello animado vive entre el realismo y la estilización. Nunca debe verse como una foto, pero tampoco como una mancha de color:

| Estilo de Cabello | Descriptor Completo | Efecto |
| :--- | :--- | :--- |
| **Pixar strand-based** | `individual hair strands with natural gravity, silk-like highlight running along the hair shaft, hair with volume and natural flyaways, strand simulation with wind response` | Merida (Brave), Miguel (Coco) |
| **DreamWorks stylized** | `stylized hair shape as unified forms, bold highlight stroke across hair surface, strong silhouette hair design, defined hair chunks with cartoon sheen` | Rapunzel style, Hiccup |
| **Illumination minimal** | `simplified hair shape, flat color with single gradient, minimal strand detail, strong color blocking for hair` | Gru's no-hair, Minions capsule heads |
| **Cabello corto masculino** | `short textured hair, soft directional highlight, natural side part, minimal strand complexity, matte-to-semi-gloss finish` | Mr. Incredible, Marlin |
| **Cabello largo femenino** | `flowing long hair with layered highlights, natural movement simulation, volume gradient from roots to tips, warm ambient occlusion at scalp` | Anna/Elsa (Frozen), Moana |

### 4.4 Telas y Ropa — El Material que Define la Personalidad

| Material de Tela | Descriptor Técnico | Películas de Referencia |
| :--- | :--- | :--- |
| **Lana/Tejido suave** | `soft knit fabric with microfiber detail, subtle specular sheen on fabric ridges, natural fold simulation, warm matte finish` | Coraline, personajes de invierno Pixar |
| **Ropa de superhéroe** | `spandex-like tight fabric, slight specular stretch highlights, muscle definition visible through fabric, clean matte color blocking` | The Incredibles, personajes de acción |
| **Ropa medieval/fantasía** | `worn leather texture with bump mapping, cloth with woven pattern visible, metal buckle with specular highlight, aged material look` | Brave, How to Train Your Dragon |
| **Ropa casual moderna** | `cotton t-shirt with subtle fabric weave, slight creasing at body joints, natural color variation suggesting wash history, realistic drape simulation` | Pixar Turning Red, personajes cotidianos |

---

## 🔄 5. Consistencia de Personaje 3D Entre Generaciones

Este es el desafío más grande en flujos de trabajo con AI: hacer que el mismo personaje se vea igual en 100 imágenes diferentes. Estas son las estrategias más efectivas:

### 5.1 El Sistema de Descripción Ancla (Character Anchor System)

Crea una "ficha técnica" de tu personaje que incluyas en CADA prompt:

```
CHARACTER ANCHOR TEMPLATE:
[Nombre], a [edad aproximada] [género] [raza/etnia] character with [color de cabello] [tipo de cabello] 
hair, [color de ojos] eyes with [característica distintiva de ojos], [tono de piel] skin tone, 
[característica facial distintiva: cicatriz, pecas, forma de nariz], wearing [descripción exacta de ropa 
con colores HEX o Pantone si es posible], approximately [altura/proporción corporal].

EJEMPLO:
Marco, a 10-year-old Latino boy with wavy dark brown hair, large warm amber eyes with thick dark lashes, 
olive warm skin tone, small upturned nose, wearing a red hoodie with white stripe detail and dark jeans, 
approximately 1.2m tall with slightly large head proportions.
```

### 5.2 Estrategia de Seed Fijo

| Modelo | Cómo Fijar el Seed | Limitaciones |
| :--- | :--- | :--- |
| **Flux (fal.ai)** | Usar parámetro `seed: [número]` en la API o interfaz | Solo garantiza pose base similar, no estabilidad total |
| **GPT-Image-1** | No tiene seed público, pero usar el mismo prompt exacto + `same character as before` ayuda | Menor control, más variabilidad |
| **Nano Banana** | Configurar seed desde la interfaz si disponible | Verificar disponibilidad en versión actual |

### 5.3 Reference Sheet Prompting

La técnica más poderosa: generar una "hoja de referencia" del personaje en primera instancia y usarla como referencia visual:

```
PASO 1 — Generar Reference Sheet:
"Character reference sheet for [nombre], showing: front view, 3/4 view, side view, and back view. 
All views show the same character: [anchor description completo]. 
White background, Pixar 3D animation style, consistent character design across all views, 
model sheet layout, studio animation quality."

PASO 2 — Usar como imagen de referencia:
Subir la reference sheet como imagen de entrada + prompt de la escena deseada
"Based on the character reference shown, create [nombre] doing [acción] in [escena]..."
```

### 5.4 Tokens de Consistencia Activos

Estos tokens empujan al modelo a mantener coherencia:

```
consistent character design, same character throughout, 
on-model character, maintaining character integrity,
character turnaround consistency, production-ready character model
```

### 5.5 Estrategia de "Primer Frame" (Best Practice)

1. Generar entre 20-50 versiones del personaje con el anchor prompt
2. Seleccionar la que más se acerque a la visión
3. Usar esa imagen ganadora como referencia en todas las generaciones futuras
4. Crear variaciones solo de pose, emoción y contexto — nunca del personaje base

---

## ⚡ 6. "3D Pixar Real" vs "3D Genérico AI" — Los Tokens que Marcan la Diferencia

Este es el núcleo del problema: la mayoría de los intentos de "3D Pixar con AI" producen un resultado que se ve plástico, genérico, y sin alma. Aquí está el análisis de por qué y cómo solucionarlo.

### 6.1 Por qué el "3D Genérico AI" se ve diferente

| Problema Visual | Causa Técnica | Solución con Tokens |
| :--- | :--- | :--- |
| **Piel plástica/muñeca** | Sin SSS, el modelo genera un shader opaco sin translucidez | `subsurface scattering, translucent warm skin glow, inner skin light` |
| **Ojos "muertos"** | Sin catchlight específico, los ojos carecen de vida | `bright catchlight in eyes, specular highlight on cornea, living eyes with depth` |
| **Pelo "casco"** | El modelo default genera pelo como forma sólida | `strand-based hair, individual hair strands, natural hair volume, silk highlights on hair` |
| **Iluminación flat** | Sin GI, la iluminación es uniforme y aburrida | `global illumination, light bouncing, color bleeding, three-point lighting` |
| **Proporciones incorrectas** | Sin especificar proporciones, el modelo va a "realista por defecto" | `Pixar character proportions, slightly oversized head, large expressive eyes, animation character design` |
| **Sin contexto de estudio** | El modelo no sabe qué look específico replicar | `Pixar Animation Studios quality, RenderMan-style rendering, feature film 3D animation` |
| **Colores desaturados** | Por defecto, los modelos tienden a colores conservadores | `vibrant Pixar color palette, rich saturated storytelling colors, warm cinematic color grading` |
| **Textura excesiva** | En modo "realista" los modelos añaden demasiado detalle de piel | `stylized skin texture, smoothed artistic skin, animation-appropriate skin detail` |

### 6.2 Los 10 Tokens Que Transforman "Genérico" en "Pixar"

Estos son los 10 tokens de mayor impacto. Incluirlos aumenta dramáticamente la calidad del resultado:

```
1. "Pixar Animation Studios quality CGI"
2. "subsurface scattering warm skin"
3. "large expressive eyes with bright catchlight"
4. "global illumination with color bleeding"
5. "strand-based hair simulation"
6. "three-point studio lighting setup"
7. "ambient occlusion in contact shadows"
8. "vibrant naturalistic Pixar color palette"
9. "feature film 3D animation production quality"
10. "emotionally resonant character design"
```

### 6.3 Los 10 Tokens que DESTRUYEN el Estilo Pixar

Evitar estos a toda costa cuando se busca el estilo de estudio:

```
❌ "realistic" (sin contexto 3D — activa fotografía)
❌ "anime" o "manga" (contamina el estilo)
❌ "cartoon" solo (va a 2D genérico)
❌ "drawing" o "illustration" (modo 2D)
❌ "photorealistic" (pelea contra el look estilizado)
❌ "low poly" (destruye el detalle de studio)
❌ "flat colors" (elimina el sombreado 3D)
❌ "cute" sin contexto (puede ir a kawaii/chibi)
❌ "Disney" con "Pixar" juntos (confunde el modelo)
❌ "render" solo (puede activar arquitectura o producto)
```

---

## 📦 7. Estilo Pixar Aplicado a Publicidad — Productos en el Universo 3D Animado

Integrar productos reales en el universo de animación 3D es uno de los usos más poderosos y rentables. Esta sección cubre las técnicas para que un producto se vea "en casa" dentro del universo Pixar.

### 7.1 La Filosofía del Prop de Animación

En animación, los objetos (props) tienen reglas propias: no se distorsionan para ser más atractivos, sino que se integran orgánicamente al universo. Un frasco de perfume en Pixar no se ve como en un anuncio de TV — se ve como si ese frasco hubiera existido en ese mundo desde siempre.

### 7.2 Técnicas de Integración de Producto

| Técnica | Descripción | Tokens Clave |
| :--- | :--- | :--- |
| **Product as Prop** | El producto aparece como objeto dentro del mundo animado, con el mismo nivel de render que los personajes | `[product name] as 3D animated prop, matching Pixar render quality, integrated into animated world` |
| **Character Interaction** | Un personaje 3D interactúa con el producto, creando conexión emocional | `Pixar character holding [product], genuine emotional interaction with product, character's expression reflecting product benefit` |
| **World Building** | El producto es parte del entorno/decorado del universo animado | `[product] as environmental element in Pixar world, background prop with animation studio detail` |
| **Hero Shot Animado** | El producto es el protagonista absoluto, con iluminación de studio sobre él | `[product] as hero object in 3D animation, product hero shot with Pixar lighting, studio quality product visualization` |
| **Magical Transformation** | El producto tiene propiedades mágicas/emocionales en el universo animado | `[product] with magical glow aura in animated world, product with emotional resonance, enchanted product visual` |

### 7.3 Adaptación de Packaging a Estilo Animado

Para que el packaging de un producto se integre en el universo animado:

```
PROCESO DE ADAPTACIÓN DE PACKAGING:
1. Simplificar el logo (menos detalle, más legibilidad)
2. Aumentar la saturación de colores del packaging en 20-30%
3. Añadir ambient occlusion en la base del producto
4. Darle una "historia" al objeto: manchas de uso, pequeños detalles humanizantes
5. Asegurarse de que el producto reacciona a la misma iluminación que los personajes

TOKEN BASE: "[Product] designed in Pixar animation aesthetic, 3D animated product design, 
matching studio CGI quality, [colores del producto] with vibrant Pixar color saturation, 
product with subtle ambient occlusion base, integrated animated world lighting"
```

### 7.4 Casos de Uso Publicitarios

| Tipo de Producto | Estrategia de Integración | Prompt Base |
| :--- | :--- | :--- |
| **Bebidas/Alimentos** | Personaje con producto, expresión de satisfacción, líquido con dinámica animada | `Pixar character with [drink/food], animated fluid with SSS, character's joyful reaction, warm appetizing lighting` |
| **Tecnología/Apps** | Pantalla del dispositivo en el mundo animado, UI simplificada para el universo | `[device] as Pixar prop, simplified animated UI on screen, character interacting with technology` |
| **Ropa/Moda** | Personaje vistiendo la prenda, tela con física animada | `Pixar character wearing [garment], animated fabric simulation, character showcasing outfit with personality` |
| **Skincare/Belleza** | Producto con aura luminosa (SSS del producto mismo), personaje con piel perfecta | `[skincare product] with soft glowing aura in Pixar world, character with perfect animated skin reflecting product benefit` |
| **Servicios/SaaS** | Dashboard/interfaz en un mundo animado, personaje usando el servicio exitosamente | `Pixar scene showing [service benefit], animated characters experiencing [service outcome], storytelling product integration` |

---

## 📝 8. 15 Prompts de Ejemplo Comentados — Análisis Completo

### PROMPT 1: Protagonista Pixar Masculino — Niño Aventurero

```
3D animated character portrait, 10-year-old Latino boy with wavy dark brown hair and large amber 
eyes full of curiosity and wonder, small upturned nose, warm olive skin with subsurface scattering 
glow, wearing a red hoodie, backpack visible over shoulder, Pixar Animation Studios quality CGI, 
three-point studio lighting with warm golden key light, global illumination with subtle color 
bleeding, ambient occlusion in fabric folds, strand-based hair with natural gravity and silk 
highlights, bright catchlight in eyes, vibrant naturalistic Pixar color palette, cinematic 
composition, feature film 3D animation quality --ar 2:3
```

**🔍 Análisis del Prompt:**
- `10-year-old Latino boy` — Especifica edad y etnia para proporciones y tono de piel correctos
- `large amber eyes full of curiosity` — Activa el oversizing Pixar + la cualidad emocional
- `warm olive skin with subsurface scattering glow` — El token crítico que elimina la piel plástica
- `three-point studio lighting with warm golden key light` — Setup de iluminación completo
- `global illumination with subtle color bleeding` — Activa los rebotes de luz que dan cohesión
- `ambient occlusion in fabric folds` — Añade profundidad en la ropa
- `strand-based hair with natural gravity and silk highlights` — Pelo con comportamiento real
- `bright catchlight in eyes` — El token más importante para ojos vivos
- `vibrant naturalistic Pixar color palette` — Ancla la paleta de colores al estudio

---

### PROMPT 2: Protagonista DreamWorks Femenina — Guerrera Épica

```
3D animated feature film character, fierce young warrior woman early 20s, DreamWorks animation 
style, impossibly large expressive green eyes with multiple catchlights, one eyebrow raised in 
confident smirk, strong jaw line, long dark hair in battle braid with stylized strand chunks, 
bold colored rim lights: cool blue from left, warm orange from right, dramatic theatrical lighting 
with strong key shadow definition, exaggerated heroic proportions, warrior armor with stylized 
leather texture and metal specular highlights, high saturation color palette with deep jewel tones, 
epic fantasy environment background with atmospheric depth, feature film DreamWorks CGI quality --ar 9:16
```

**🔍 Análisis del Prompt:**
- `DreamWorks animation style` — El token de estudio que cambia las proporciones y el approach
- `impossibly large expressive green eyes with multiple catchlights` — La marca DreamWorks más reconocible
- `one eyebrow raised in confident smirk` — La "cara DreamWorks" icónica
- `bold colored rim lights: cool blue from left, warm orange from right` — Iluminación dramática DreamWorks
- `dramatic theatrical lighting with strong key shadow definition` — Más contraste que Pixar
- `exaggerated heroic proportions` — Activa las proporciones imposibles del estudio
- `high saturation color palette with deep jewel tones` — La paleta más saturada de DreamWorks

---

### PROMPT 3: Personaje Illumination — Villano Cómico

```
3D animated character, silly cartoon villain in Illumination Entertainment style, 
geometric rounded body shape like a bean, extremely simplified anatomy, bald round head 
with comically tiny eyes and enormous mouth, wearing a dramatic purple cape that contrasts 
with his tiny stature, maximum color saturation with bright primary colors, soft cel shading 
on all surfaces, single circular catchlight in each eye, bright even lighting without hard 
shadows, Illumination CGI quality, pop art color palette, exaggerated rubber hose deformation 
capability in pose, cheerful comedic scene, clean background with bright sky blue --ar 1:1
```

**🔍 Análisis del Prompt:**
- `geometric rounded body shape like a bean` — La forma geométrica característica de Illumination
- `extremely simplified anatomy` — Opuesto al hiperrealismo Pixar
- `maximum color saturation with bright primary colors` — La paleta pop de Illumination
- `soft cel shading on all surfaces` — El tipo de shading que da el look 2.5D
- `single circular catchlight in each eye` — Los ojos simples pero vivos de Illumination
- `bright even lighting without hard shadows` — Sin dramatismo, luz de comedia
- `rubber hose deformation capability` — Referencia al estilo de deformación extrema

---

### PROMPT 4: Escena Familiar Pixar — Interior Cálido

```
Pixar animated movie interior scene, cozy living room at golden hour, warm amber light streaming 
through curtain-filtered window creating volumetric light shafts with visible dust particles, 
grandmother character 70s with white curly hair and deep smile lines sitting in armchair, 
reading to small grandchild character 5 years old in her lap, both characters with Pixar 
subsurface scattering warm skin, global illumination creating warm color bleeding from yellow 
walls, ambient occlusion under furniture and in fabric folds, three-point warm lighting setup, 
cozy home environment with storytelling detail: family photos on walls, well-worn books, potted 
plants, Pixar production quality CGI, emotionally resonant composition, vibrant naturalistic 
warm color palette --ar 16:9
```

**🔍 Análisis del Prompt:**
- `warm amber light streaming through curtain-filtered window` — Iluminación narrativa de Pixar
- `volumetric light shafts with visible dust particles` — El dust que aparece en Up, Coco, etc.
- `deep smile lines` — Detalles de age que Pixar maneja magistralmente
- `global illumination creating warm color bleeding from yellow walls` — GI específico con contexto
- `storytelling detail: family photos on walls, well-worn books, potted plants` — El detalle ambiental Pixar
- `emotionally resonant composition` — Activa el "propósito emocional" del frame

---

### PROMPT 5: Producto en Universo Pixar — Botella de Agua

```
Pixar animated world product hero shot, a colorful water bottle character come to life, 
anthropomorphic blue and silver water bottle with small expressive cartoon eyes and tiny arms, 
standing proudly in a bright animated kitchen environment, three-point studio lighting with 
cool blue fill light and warm rim light, subsurface scattering on frosted blue plastic material, 
subtle specular highlight on metallic cap, ambient occlusion at base contact with counter, 
vibrant kitchen environment with Pixar storytelling detail, product matching Pixar render quality, 
emotionally engaging product character, global illumination from warm window light, 
fun and approachable advertising composition, 3D animated brand character --ar 4:5
```

**🔍 Análisis del Prompt:**
- `anthropomorphic blue and silver water bottle with small expressive cartoon eyes` — El método Pixar de humanizar productos
- `subsurface scattering on frosted blue plastic material` — SSS adaptado a plástico, no solo piel
- `subtle specular highlight on metallic cap` — Especificación de material diferente por parte del objeto
- `ambient occlusion at base contact with counter` — El AO que hace que los objetos "se sientan" en el suelo
- `emotionally engaging product character` — El objetivo publicitario integrado en el prompt

---

### PROMPT 6: Villain Pixar — Antagonista con Carisma

```
3D animated villain character, Pixar Animation Studios quality, tall imposing woman mid-50s 
with sharp angular features contrasting with soft curved hero world, silver perfectly styled 
hair, piercing deep violet eyes with complex iris layering and cold catchlight, dramatic high 
cheekbones with ambient occlusion emphasizing structure, wearing elegant dark tailored suit 
with subtle iridescent fabric sheen, sophisticated rim light with cool purple undertone 
separating from warm environment, global illumination creating slight cool-to-warm tension 
in the scene, Pixar feature film quality, expressive hands with long fingers, slight imperious 
smirk with one corner of mouth raised, architectural background in cool grays vs warm hero space --ar 2:3
```

**🔍 Análisis del Prompt:**
- `sharp angular features contrasting with soft curved hero world` — El contraste visual de villanos Pixar (formas angulares = malo, curvas = bueno)
- `piercing deep violet eyes with complex iris layering and cold catchlight` — Ojos que comunican frialdad
- `ambient occlusion emphasizing structure` — AO usado dramáticamente en rasgos faciales
- `sophisticated rim light with cool purple undertone` — Rim light de color para carácter
- `cool-to-warm tension` — La guerra cromática que Pixar usa para establecer conflicto

---

### PROMPT 7: Personaje Animal Pixar — Perro Fiel

```
Pixar-quality 3D animated dog character, golden retriever with oversized soulful brown eyes, 
slightly enlarged head proportions in Pixar style, soft warm fur with individual strand simulation, 
fur catching warm afternoon light with SSS glow through ear tips in backlight, wet nose with 
specular highlight and micro bump texture, expressive eyebrows (yes, dogs with brows in animation), 
warm golden fur color with ambient occlusion deepening tones in shadow areas, three-point warm 
lighting with strong golden key and soft fill, natural dog sitting pose with slight head tilt 
and eager expression, forest path environment background with dappled light through trees, 
Pixar feature film CGI quality, emotionally resonant animal character design --ar 3:4
```

**🔍 Análisis del Prompt:**
- `slightly enlarged head proportions in Pixar style` — La regla de proporciones para animales también
- `SSS glow through ear tips in backlight` — El detalle físico que los diseñadores reales aplican
- `wet nose with specular highlight and micro bump texture` — Detalle específico del material
- `expressive eyebrows (yes, dogs with brows in animation)` — Nota aclaratoria que ayuda al modelo
- `natural dog sitting pose with slight head tilt` — Pose específica de lenguaje corporal

---

### PROMPT 8: Escena DreamWorks — Acción Épica

```
DreamWorks 3D animated action scene, two dragon characters mid-air battle above stormy ocean, 
Night Fury style dark dragon with bioluminescent blue accents vs. red aggressive armored dragon, 
dramatic storm lighting with lightning bolt illuminating scene, multiple colored rim lights 
creating separation in chaotic composition, dynamic action poses with extreme foreshortening, 
spray particles from ocean and fire breath volume effects, dark moody atmosphere with pockets 
of dramatic warm light from fire, DreamWorks feature film animation quality, high saturation 
theatrical color palette, epic wide angle composition showing scale, atmospheric depth haze, 
motion blur on fast-moving wing tips --ar 21:9
```

**🔍 Análisis del Prompt:**
- `bioluminescent blue accents` — El tipo de detalle de material que da identidad única
- `lightning bolt illuminating scene` — Fuente de luz adicional dramática de DreamWorks
- `multiple colored rim lights creating separation` — La técnica DreamWorks de rim lights de color
- `extreme foreshortening` — Ángulo dramático característico de las acciones épicas
- `atmospheric depth haze` — La profundidad atmosférica que da escala épica

---

### PROMPT 9: Scene Illumination — Familia Feliz

```
Illumination Entertainment 3D animated scene, happy family of four with geometric simplified 
body shapes, all with oversized round heads and tiny features except eyes, standing in front 
of their colorful suburban home, maximum color saturation with bright primary and secondary 
colors: red door, yellow walls, blue sky, green lawn, bright high-key even lighting without 
harsh shadows, simple cel shading on all surfaces and characters, pop art color blocking, 
single circular catchlights in all characters' eyes, cheerful comedic poses with rubber hose 
flexibility, clear bright day outdoor lighting, clean simple background, Illumination CGI quality --ar 16:9
```

**🔍 Análisis del Prompt:**
- `geometric simplified body shapes` — La forma más opuesta a Pixar posible, totalmente Illumination
- `maximum color saturation with bright primary and secondary colors` — La paleta Illumination al máximo
- `bright high-key even lighting without harsh shadows` — Iluminación de comedia pop
- `pop art color blocking` — La referencia estética del estudio
- `rubber hose flexibility` — El tipo de animación inspirado en los clásicos

---

### PROMPT 10: Pixar — Momento Emocional Close-Up

```
Pixar animated close-up portrait, adult woman character late 30s experiencing overwhelming joy 
with tears of happiness, eyes glistening with high-quality SSS-lit water layer on iris, 
subsurface scattering creating warm rose flush on cheeks and nose from crying, micro-expressions 
of happiness visible: slightly raised cheeks, lifted mouth corners, upward curved brows, 
warm golden soft key light caressing face, subtle rim light defining jawline, deep ambient 
occlusion under eyes enhancing emotion, strand-based hair with some strands displaced naturally, 
the skin shows genuine texture: tiny pores, natural variation in skin tone, Pixar feature film 
close-up quality, emotionally devastating beauty, cinematic composition tight on face --ar 2:3
```

**🔍 Análisis del Prompt:**
- `tears of happiness, eyes glistening with high-quality SSS-lit water layer on iris` — Detalle extremo de material (agua sobre iris)
- `warm rose flush on cheeks and nose from crying` — El SSS generando el enrojecimiento realista
- `micro-expressions of happiness: slightly raised cheeks, lifted mouth corners` — Descripción técnica de actuación facial
- `deep ambient occlusion under eyes enhancing emotion` — AO usado para potenciar la emoción
- `emotionally devastating beauty` — El oxímoron que captura la filosofía Pixar

---

### PROMPT 11: Producto Animado — Lanzamiento de App en Mundo 3D

```
Pixar animated advertising scene, friendly young professional character 28 years old, 
holding a glowing smartphone showing a clean app interface with warm light from screen 
illuminating face with subtle SSS glow, character has genuine excited smile showing white 
teeth, large warm amber eyes looking at camera for direct engagement, modern casual clothing, 
warm office environment background with Pixar storytelling detail: plants, coffee mug, 
morning light, three-point warm lighting setup, global illumination creating cohesive warm 
atmosphere, product integration: phone as hero prop with matching Pixar render quality, 
vibrant and inviting color palette for commercial use, emotionally approachable advertising 
character, cinematic composition --ar 4:5
```

**🔍 Análisis del Prompt:**
- `warm light from screen illuminating face with subtle SSS glow` — El bounce light del teléfono aplicado a piel con SSS
- `character has genuine excited smile showing white teeth` — "Genuine" es un token clave para evitar expresiones forzadas
- `looking at camera for direct engagement` — El contacto visual para conversión publicitaria
- `product integration: phone as hero prop with matching Pixar render quality` — La instrucción de matching render

---

### PROMPT 12: DreamWorks — Comedia con Contraste de Personajes

```
DreamWorks 3D animated comedy scene, two contrasting characters side by side: tall slender 
sophisticated villain with perfectly groomed hair, extremely arched eyebrow and imperious smirk 
vs. short round bumbling sidekick with enormous eyes taking up 60% of face, both with DreamWorks 
exaggerated anatomy, theatrical three-point lighting with dramatic shadows, slightly high contrast, 
colored rim lights: cool for villain, warm for sidekick, comedic pose contrast: villain elegant 
cross-armed vs. sidekick wildly gesticulating with panic expression, bold saturated color palette, 
background dark comedy environment with single spot light creating theatrical stage feel, 
DreamWorks feature film quality --ar 16:9
```

**🔍 Análisis del Prompt:**
- `contrasting characters side by side` — El tipo de composición de buddy comedy DreamWorks
- `enormous eyes taking up 60% of face` — El extremo absoluto de los ojos DreamWorks
- `colored rim lights: cool for villain, warm for sidekick` — Uso narrativo del color de luz
- `comedic pose contrast: villain elegant cross-armed vs. sidekick wildly gesticulating` — La descripción de actuación como coreografía

---

### PROMPT 13: Pixar — Entorno Natural sin Personaje (Establishing Shot)

```
Pixar animated establishing shot, magical enchanted forest at twilight, towering ancient trees 
with glowing bioluminescent mushrooms at base, fireflies creating volumetric light points in 
mid-air, golden sunset light filtering through dense canopy creating multiple volumetric god rays 
with atmospheric particles, ground covered with moss showing ambient occlusion depth in every 
crevice, still pond reflecting forest with perfect SSS-like water translucency, environmental 
storytelling details: ancient stone path, forgotten lantern, flower petals, every surface with 
Pixar-quality material shaders: bark with bump mapping, leaves with SSS translucency, water 
with caustics, vibrant but naturalistic color palette with warm amber sunset and cool blue shadows, 
Pixar feature film environment quality, cinematic wide angle composition --ar 21:9
```

**🔍 Análisis del Prompt:**
- `bioluminescent mushrooms at base` — El tipo de detalles mágicos que Pixar introduce en entornos
- `multiple volumetric god rays with atmospheric particles` — La iluminación atmosférica compleja
- `environmental storytelling details: ancient stone path, forgotten lantern, flower petals` — La "historia en los objetos"
- `bark with bump mapping, leaves with SSS translucency, water with caustics` — Especificación de material por tipo de superficie
- `warm amber sunset and cool blue shadows` — La complementariedad de colores en Pixar

---

### PROMPT 14: Campaña Publicitaria — Personaje 3D con Producto de Lujo

```
Pixar-quality 3D animated luxury product advertisement, elegant woman character 35 years old 
with sophisticated Pixar proportions, holding luxury perfume bottle with SSS-lit frosted glass 
material catching warm studio light, character wearing couture gown with animated fabric 
simulation showing realistic drape, expression of serene luxury satisfaction, eyes half-closed 
with subtle smirk and warm catchlight, three-point luxury studio lighting: warm key from 45°, 
cool blue fill, champagne gold rim light, perfume bottle as hero prop with prismatic light 
refraction creating rainbow caustics, dark luxurious background with subtle gradient from 
deep navy to near-black, product name area clean and uncluttered, vibrant jewel-tone color 
palette with gold accents, cinematic portrait composition --ar 4:5
```

**🔍 Análisis del Prompt:**
- `SSS-lit frosted glass material catching warm studio light` — SSS aplicado a vidrio, no solo piel
- `animated fabric simulation showing realistic drape` — El tejido como material vivo
- `prismatic light refraction creating rainbow caustics` — El efecto físico del vidrio con luz
- `champagne gold rim light` — Color muy específico del rim light para lujo
- `product name area clean and uncluttered` — Instrucción de composición para uso publicitario

---

### PROMPT 15: Meta-Prompt — El Personaje Universal que Funciona en Todo

```
3D animated character design, universal everyman hero character, young adult 25 years old, 
gender-neutral or slightly androgynous design choices, warm neutral skin tone with Pixar 
subsurface scattering, medium brown wavy hair with natural strand-based simulation, large 
friendly hazel eyes with expressive capability: catchlight at 10 o'clock position, 
slight freckles adding personality, wholesome friendly smile showing genuine warmth, 
wearing universally appealing casual clothes: simple clean hoodie and comfortable pants, 
Pixar-quality three-point soft studio lighting, warm neutral color palette with slight 
golden undertone, emotionally accessible and culturally inclusive character design, 
proportions following Pixar standard: 6.5 heads tall, slightly oversized head, large eyes, 
small nose, ambient occlusion, global illumination, feature film 3D quality, 
white or gradient background for versatility --ar 2:3
```

**🔍 Análisis del Prompt:**
- `gender-neutral or slightly androgynous design choices` — Maximiza la identificación del usuario
- `catchlight at 10 o'clock position` — Especificación técnica de la posición exacta del catchlight
- `slight freckles adding personality` — El detalle humanizante sin comprometer universalidad
- `proportions following Pixar standard: 6.5 heads tall, slightly oversized head` — La "fórmula matemática" Pixar
- `white or gradient background for versatility` — Instrucción práctica para uso en diferentes contextos

---

## 📊 Resumen Ejecutivo — Cheat Sheet de Referencia Rápida

### Los 5 Tokens Más Importantes por Estudio

| Estudio | Token 1 | Token 2 | Token 3 | Token 4 | Token 5 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pixar** | `subsurface scattering skin` | `global illumination` | `strand-based hair` | `bright catchlight in eyes` | `vibrant naturalistic palette` |
| **DreamWorks** | `enormously expressive eyes` | `dramatic theatrical lighting` | `exaggerated proportions` | `colored rim lights` | `high saturation bold palette` |
| **Illumination** | `geometric simplified shapes` | `maximum color saturation` | `soft cel shading` | `bright high-key lighting` | `rubber hose deformation` |

### La Fórmula Ganadora Universal

```
[Estudio específico] 3D animated [tipo de personaje/escena], 
[descripción detallada del personaje con proporciones], 
[descripción emocional/expresión], 
[iluminación: key + fill + rim + GI + AO], 
[materiales: piel SSS + pelo strand + ojos con catchlight], 
[paleta de colores específica del estudio], 
[entorno con storytelling detail], 
[calidad: feature film production quality] 
--ar [ratio según uso]
```

---

#pixar-prompts #dreamworks-prompts #illumination-prompts #3d-animation-ai #flux-prompts #gpt-image-prompts #nano-banana #prompt-engineering #ai-art-direction #subsurface-scattering #global-illumination #character-design-ai
