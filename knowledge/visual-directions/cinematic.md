# Estéticas Cinematográficas Profesionales con Modelos de Imagen y Video AI
## Enciclopedia de Referencia Técnica para Prompt Engineering Cinematográfico

> [!NOTE]
> **Base de Conocimiento: Cine → AI**
> Esta guía sintetiza la gramática visual del cine profesional y la traduce en tokens, estructuras y estrategias de prompting para modelos de imagen y video AI (Flux, Midjourney v6, Stable Diffusion XL, GPT-Image-1, Kling, Wan, Luma, Sora). El objetivo es replicar la intencionalidad estética de directores de cine con resultados deterministas, no decorativos.

---

## 📌 Estructura Universal de Prompt Cinematográfico

```text
[director_style / film_movement], [shot_type] of [subject], [action/mood], [environment + lighting], [color_grade], [lens + technical], [imperfections], --ar [ratio]
```

**¿Por qué este orden importa?**
Los modelos de difusión procesan tokens por peso de atención. Poner el estilo del director primero establece el "espacio latente" en el que se construye toda la imagen. Poner las imperfecciones al final las añade como capa encima sin distorsionar la composición base.

---

## 1. 🎬 Los 10 Estilos Cinematográficos Más Reconocibles: Tokens Específicos

### 1.1 Christopher Nolan — Grandiosidad Técnica e Ilusión Práctica

**Filosofía visual:** Nolan construye épica con cámaras reales, sets físicos y luz práctica. Evita el CGI descarado. Su look es frío, azul-gris en exteriores, con sombras largas y arquitectura imponente como personaje.

**Tokens de activación:**
```text
Christopher Nolan cinematic style, IMAX 70mm film photography, cold desaturated steel-blue tones, practical lighting only, immense scale architecture, deep focus with foreground elements, Hoyte van Hoytema cinematography, teal shadows and cool midtones, overcast natural light, shallow atmospheric haze
```

**Color:** Azul-acero (#4A6274) en sombras, gris-plata en medios, blancos fríos en altas luces.
**Lente característica:** 65mm / IMAX 15-perf. Usar token `large format film, wide angle with depth retention`.
**Composición:** Sujeto pequeño contra arquitectura enorme. Token: `human figure dwarfed by imposing structure`.
**Caso de uso AI:** Escenas épicas, sci-fi, thrillers donde el peso visual debe aplastar al personaje.

---

### 1.2 Denis Villeneuve — Silencio Visual y Escala Alienante

**Filosofía visual:** Villeneuve usa el silencio como herramienta. Sus encuadres son deliberadamente lentos, con sujetos aislados en entornos vastos. La iluminación es casi siempre lateral o trasera, nunca frontal.

**Tokens de activación:**
```text
Denis Villeneuve cinematic style, Roger Deakins cinematography, extreme wide shot, lone figure in vast landscape, desolate atmospheric environment, side-lighting with deep shadows, muted earth tones with warm amber highlights, cinematic stillness, dusty haze atmosphere, otherworldly silence, 1.85:1 aspect ratio framing
```

**Color:** Ocres quemados (#C4933F), sombras violáceas (#3D2B4A), cielos blancos sobreexpuestos.
**Composición:** Sujeto en el tercio inferior izquierdo, 80% del frame es entorno. Token: `subject occupying lower third, vast negative space`.
**Trampas:** Los modelos tienden a hacer al sujeto protagonista. Usar `minimalist composition, subject as secondary element` para forzar la escala.

---

### 1.3 David Fincher — Precisión Quirúrgica y Oscuridad Controlada

**Filosofía visual:** Fincher nunca improvisa la luz. Cada sombra es diseñada. Su paleta es verde-oliva en sombras (el look de "Seven" y "Fight Club"), con iluminación de fuente única hard light que dibuja texturas de piel y materiales.

**Tokens de activación:**
```text
David Fincher cinematic style, Jeff Cronenweth cinematography, moody low-key lighting, single hard light source casting sharp shadows, desaturated green-olive shadow tones, high contrast noir aesthetic, face partially in shadow, institutional cold interiors, clinical precision composition, urban grit texture, digital grain overlay
```

**Color:** Verde-sombra (#2D3B2A), piel desaturada (#8B7355), altas luces amarillo-sucio.
**Lente:** 35mm a 40mm. Token: `slightly wide angle, minimal lens distortion, clinical perspective`.
**Regla Fincher:** La cámara no se mueve a menos que tenga una razón narrativa. Token: `static camera, locked-off shot, no motion blur`.
**Caso de uso AI:** Retratos psicológicos, villanos, espacios urbanos nocturnos, corporate thriller.

---

### 1.4 Stanley Kubrick — Simetría como Dominio y Terror

**Filosofía visual:** Kubrick usó la perspectiva de un punto de fuga como arma psicológica. Sus corredores, habitaciones y composiciones son perfectamente simétricas, lo que produce una sensación de control total que resulta inquietante.

**Tokens de activación:**
```text
Stanley Kubrick cinematic style, one-point perspective symmetry, perfectly centered composition, long symmetrical corridor, cold institutional fluorescent lighting, wide-angle lens distortion at edges, static locked-off camera, pale clinical color palette, geometric precision, Clockwork Orange aesthetic, The Shining visual grammar
```

**Composición:** Simetría perfecta. Token obligatorio: `perfectly symmetrical frame, single vanishing point perspective, centered subject`.
**Color:** Blancos clínicos, luces de neón frías, sombras neutras sin calidez.
**Trampa crítica:** Los modelos confunden "kubrick" con "simetría decorativa". Forzar: `forced perspective, architectural symmetry as psychological tool, unsettling stillness`.
**Lente:** Gran angular 18-24mm. Token: `ultra-wide angle lens, slight barrel distortion, deep depth of field`.

---

### 1.5 Wong Kar-wai — Temporalidad Rota y Nostalgia Sensorial

**Filosofía visual:** WKW trabaja con la memoria y el tiempo como materiales físicos. Sus imágenes están saturadas en warmth, con motion blur intencional (step-printing) y luces prácticas de neón que sangran sobre el sujeto.

**Tokens de activación:**
```text
Wong Kar-wai cinematic style, Christopher Doyle cinematography, step-printing motion blur effect, saturated warm practical neon lights, 1960s Hong Kong aesthetic, intimate close-up, shallow depth of field, venetian blind light pattern, slow shutter motion trail, magenta and amber color bleeding, melancholic romantic atmosphere, expired film look, In the Mood for Love visual style
```

**Color:** Rojos y magentas saturados (#C2185B), dorados cálidos (#F59E0B), sombras verdes oscuros (#1B5E20).
**Efecto signature:** Step-printing = motion blur selectivo. Token: `intentional motion blur on subject, sharp background, ghost trail effect`.
**Trampa:** Sin el motion blur y las luces de neón sangrando, el modelo produce algo genéricamente "asiático vintage". El paso-impresión es lo que define el estilo.

---

### 1.6 Estética A24 — Indie Prestige y Realismo Mágico

**Filosofía visual:** A24 no es un director sino una casa productora con estética consistente: naturalismo elevado, colores desgastados pero emocionalmente ricos, cámaras de hombro sin trípode, naturaleza como elemento emocional.

**Tokens de activación:**
```text
A24 film aesthetic, indie prestige cinematography, naturalistic lighting, overcast soft daylight, muted warm earth tones, handheld camera slight movement, raw emotional realism, grain-heavy 16mm film stock, faces in honest unposed light, rural or suburban American setting, quiet melancholic atmosphere, Hereditary color palette OR Midsommar bright horror aesthetic
```

**Color A24 oscuro (Hereditary/Midsommar/Lighthouse):** Azules nocturnos densos, verdes bosque, sombras casi sin detalle.
**Color A24 cálido (Ladybird/Moonlight):** Magentas de atardecer, piel dorada, cielos color durazno.
**Lente:** 16mm o Super 16. Token: `16mm film grain, organic texture, slight color shifting, photochemical process`.

---

### 1.7 Wes Anderson — Artificialidad Consciente y Paleta Pastel

**Filosofía visual:** Anderson construye mundos imposiblemente ordenados. Sus composiciones son estrictamente simétricas como Kubrick, pero cálidas y pasteles. La cámara se mueve en tracks horizontales perfectamente paralelos al suelo (pan plano).

**Tokens de activación:**
```text
Wes Anderson aesthetic, symmetrical pastel color palette, centered flat composition, dollhouse perspective, warm muted yellows and pinks, horizontal tracking shot style, whimsical retro props, vintage typography elements, twee nostalgia atmosphere, Grand Budapest Hotel color palette, deliberate artificiality
```

**Paleta:** Amarillo pálido (#F5E642), rosa vintage (#F4A0A0), verde menta (#A8D5A2), rojo granate (#8B1A1A).
**Composición:** Siempre centrado. Token: `dead center framing, flat depth, theatrical staging`.
**Diferencia con Kubrick:** Anderson = calidez, color, artificio amable. Kubrick = frialdad, dominio, terror psicológico.

---

### 1.8 Terrence Malick — Magia de la Hora Dorada y Cámara Viva

**Filosofía visual:** Malick filma solo durante la "magic hour" (hora dorada). Sus cámaras se mueven libremente, rotan alrededor de los actores, miran al sol directamente. Los personajes no actúan para la cámara — existen dentro del entorno.

**Tokens de activación:**
```text
Terrence Malick cinematic style, Emmanuel Lubezki cinematography, golden hour magic light, sun flare shooting directly into lens, wide angle close-up with environment, spinning handheld movement, grass fields backlit, faces illuminated by reflected golden light, Tree of Life visual grammar, ephemeral fleeting moment, spiritual naturalism
```

**Regla Malick:** La luz del sol debe ser fuente directa. Token: `sun as direct light source, shooting into the sun, heavy lens flare, golden backlight`.
**Trampas:** "Golden hour" solo produce atardeceres genéricos. Agregar `Malick-style lens flare, handheld intimate rotation` para activar el movimiento y la espiritualidad.

---

### 1.9 Park Chan-wook — Simetría Perturbadora y Violencia Elegante

**Filosofía visual:** Como Kubrick pero con sangre. Park usa simetría para crear tensión y luego la rompe con violencia. Sus paletas son ricas y saturadas — reds y greens complementarios en alta saturación.

**Tokens de activación:**
```text
Park Chan-wook cinematic style, rich saturated color palette, deep crimson and forest green complementary colors, symmetrical composition broken by violence, extreme close-up of mundane details, highly stylized choreography, cold calculating framing, Oldboy visual language, graphic novel color saturation, revenge thriller aesthetic
```

**Color:** Rojo sangre (#8B0000) vs verde oscuro (#1B5E20). Alta saturación sin perder detalle.
**Composición:** Simetría que se quiebra en el momento de clímax emocional.

---

### 1.10 Alfonso Cuarón — Plano Secuencia y Verismo Documental

**Filosofía visual:** Cuarón usa el plano secuencia como herramienta de inmersión total. Su estética en "Roma" es en blanco y negro con luz natural y detalles texturales urbanos. En "Gravity" y "Children of Men", la cámara es un testigo sin cortes.

**Tokens de activación:**
```text
Alfonso Cuarón cinematic style, Roma film aesthetic, black and white high contrast documentary, available light photography, urban Mexican texture, deep focus with both near and far sharp, neorealist visual language, long unbroken take implied, intimate observational camera, Lubezki cinematography, social realist atmosphere
```

**Para Roma (B&W):** `monochromatic, rich shadow detail, silver halide film texture, street documentary realism`.
**Para Gravity/Children of Men:** `single unbroken take aesthetic, handheld immersion, action chaos in real time, documentary war photography style`.

---

## 2. 📐 Aspect Ratios Cinematográficos: Impacto Visual y Cómo Especificarlos

### Tabla Comparativa de Formatos

| Ratio | Nombre | Uso Clásico | Sensación | Token AI |
|:---|:---|:---|:---|:---|
| **2.39:1** | Anamorfic Scope | Épica, western, sci-fi | Grandioso, panorámico, inmersivo | `anamorphic 2.39:1 widescreen, scope format, letterbox black bars` |
| **2.35:1** | CinemaScope | Clásico Hollywood | Majestuoso, épico clásico | `CinemaScope 2.35:1, classic Hollywood widescreen` |
| **1.85:1** | Academy Flat | Drama prestige, indie | Equilibrado, narrativo, natural | `1.85:1 flat widescreen, prestige drama format` |
| **1.78:1** | 16:9 | Televisión, digital | Familiar, accesible, moderno | `16:9 aspect ratio, widescreen television format` |
| **1.37:1** | Academy | Pre-1953 Hollywood | Íntimo, clásico, teatral | `Academy ratio 1.37:1, classic cinema format, intimate framing` |
| **1.33:1** | 4:3 | Films vintage, Dogme 95 | Antiguo, documental, rawness | `4:3 aspect ratio, vintage film format, raw documentary` |
| **1:1** | Cuadrado | Experimental, arte | Claustrofóbico, igualitario | `square format 1:1, equal tension all sides` |

### Cómo Especificar Aspect Ratios por Plataforma

**Midjourney:**
```text
--ar 21:9    (equivalente a 2.33:1 Scope)
--ar 16:9    (equivalente a 1.78:1)
--ar 3:2     (equivalente a 1.50:1)
--ar 4:3     (equivalente a 1.33:1)
```

**Stable Diffusion / Flux (por pixels):**
```text
2.39:1 → width: 1792, height: 750
1.85:1 → width: 1664, height: 896
1.78:1 → width: 1792, height: 1008
1.33:1 → width: 1344, height: 1008
```

**Con keywords descriptivas (cuando no hay parámetro --ar):**
```text
"anamorphic widescreen composition with black letterbox bars, scope format"
"square 1:1 format, equal frame tension"
"vertical 9:16 portrait mobile composition"
```

### Impacto Visual Psicológico

- **2.39:1:** El negro de las barras letterbox comunica "esto es cine serio". El ancho extremo da sensación de libertad y escala. Usar para épicas, espacios abiertos, desiertos, cosmos.
- **1.85:1:** El formato favorito del drama prestige. No tan ancho que aplaste, no tan cuadrado que quite grandeza. Villeneuve lo usa en casi toda su filmografía.
- **4:3:** En el contexto moderno comunica nostalgia, limitación o autenticidad documental. "The Lighthouse" de Eggers, "First Reformed" de Schrader. Úsalo para intimidad radical.
- **1:1:** Experimental. Todo el frame tiene igual peso gravitacional. El sujeto no puede escapar hacia los lados. Claustrofobia o balance zen.

---

## 3. 🎨 Color Grading Descriptors: Tokens Exactos para AI

### Glosario de Grades Cinematográficos

| Grade | Descripción Visual | Tokens de Activación | Directores que lo Usan |
|:---|:---|:---|:---|
| **Teal & Orange** | Complementarios: pieles cálidas naranja, sombras azul-verde | `teal and orange color grading, complementary skin tones and shadow hues, blockbuster color grade` | Bay, Nolan, Mann |
| **Bleach Bypass** | Desaturación parcial, contraste extremo, retención de plata | `bleach bypass look, silver retention process, high contrast desaturated, crushed blacks with muted color` | Sena, Fincher, Saving Private Ryan |
| **Cross-Process** | Proceso cruzado E-6/C-41, colores aberrantes, saturación exagerada | `cross-processed film, shifted color channels, oversaturated greens and purples, E6-C41 process` | Moda editorial años 90, Terry Richardson |
| **Film Noir** | B&W o casi-monocromático, contraste extremo, sombras sin detalle | `film noir black and white, hard directional shadows, venetian blind light pattern, expressionist contrast` | Wilder, Huston, Welles |
| **Warm Indie** | Magentas suaves, piel dorada, sombras azules dulces | `warm indie film look, golden skin tones, muted magenta highlights, soft blue shadows, Ladybird color palette` | Gerwig, Jenkins, Chazelle |
| **Desaturated Prestige** | Colores apagados sin ser B&W, alta resolución de detalle en sombras | `desaturated prestige color grade, muted palette, low saturation with rich shadow detail, Sicario color science` | Villeneuve, Deakins, Nolan |
| **Day-for-Night** | Filmado de día, gradado para parecer noche | `day-for-night color grading, blue-shifted daylight, underexposed sky, artificial night effect` | Clásico Hollywood años 50-70 |
| **Kodachrome** | Rojos y verdes primarios vibrantes, azules nítidos, skin cálido | `Kodachrome color profile, vivid primary colors, rich reds and greens, warm accurate skin tones, vintage slides look` | Spielberg, Ford |
| **Cyan Shadows** | Sombras cian frías, altas luces neutras, skin desaturado | `cyan shadow tones, cold blue-green shadows, neutral highlights, clinical cold atmosphere` | Fincher tardío, Se7en |
| **Golden Hollywood** | Luces ámbar profundas, piel perfecta, sombras color chocolate | `golden Hollywood classic color grade, amber highlights, perfect warm skin tones, chocolate shadow tones, studio golden age aesthetic` | Spielberg, Cuarón en Roma |

### Tokens de Color Science por Cámara (para AI)

```text
Arri Alexa color science   → tonos de piel naturales, transiciones suaves
Red Dragon color science   → microdetalles, contraste nativo alto
KODAK 5219 vision3         → grain orgánico, warmth moderado, piel fiel
FUJIFILM Eterna 500T       → azules fríos, verdes naturales, bajo contraste
Blackmagic Pocket Cinema   → textura digital + feel indie, shadow latitude
```

---

## 4. 💡 Iluminación Cinematográfica: Esquemas y Tokens AI

### 4.1 Practical Lights (Luz Práctica)
Fuentes de luz que son visibles en el encuadre y justifican la iluminación de la escena.

```text
practical lighting only, visible light sources in frame, table lamp casting warm pool of light, motivated practical sources, tungsten bulb glow, neon sign illumination bleeding onto subject face
```

**Cuándo usarlo:** Realismo, intimidad, dramas de cuarto, estética Wong Kar-wai, A24.

### 4.2 Motivated Light (Luz Motivada)
La luz proviene de una fuente justificada narrativamente aunque no sea visible.

```text
motivated natural light from window, sunlight streaking through venetian blinds, fire-motivated warm orange side light, screen light reflecting on face, motivated moonlight through curtains
```

### 4.3 Silhouette (Contraluz Total)
Sujeto completamente oscuro contra fondo iluminado.

```text
full silhouette against bright background, subject in total shadow, strong rim backlight, dramatic silhouette composition, counter-jour photography, subject outline only visible
```

### 4.4 Chiaroscuro (Alto Contraste Tenebrista)
Contraste extremo luz-sombra. Inspirado en Caravaggio. Usado en thriller y drama.

```text
chiaroscuro lighting, extreme light-dark contrast, Rembrandt triangle on face, tenebrism style, one hard side light, deep shadow engulfing half face, old master painting light quality, Caravaggio inspired illumination
```

### 4.5 Rembrandt Lighting (Triángulo de Luz)
Pequeño triángulo de luz en el pómulo oscuro del rostro.

```text
Rembrandt lighting setup, small triangle of light on shadow cheek, 45-degree key light, three-quarter face lighting, classical portrait illumination
```

### 4.6 Butterfly / Paramount Lighting
Luz desde arriba creando sombra de mariposa bajo la nariz. Glamour clásico Hollywood.

```text
butterfly lighting, Paramount lighting style, overhead key light, butterfly nose shadow, glamour portrait lighting, classic Hollywood beauty light
```

### 4.7 Split Lighting (Iluminación Dividida)
Mitad del rostro en luz, mitad en oscuridad perfecta.

```text
split lighting, exactly half face in shadow, dramatic 90-degree side light, perfectly divided face illumination, dramatic split portrait
```

### 4.8 Available Light (Solo Luz Disponible)
Sin iluminación artificial. Cámara captura la luz existente.

```text
available light only, no artificial lighting, natural ambient light, window light, overcast outdoor illumination, documentary available light photography
```

---

## 5. 🖼️ Composición Cinematográfica: Cómo Describírsela a un Modelo AI

### 5.1 Regla de Tercios
```text
rule of thirds composition, subject positioned at left third intersection, off-center framing, horizon on lower third, visual balance through asymmetry
```

### 5.2 Simetría Kubrickiana (Un Punto de Fuga)
```text
one-point perspective, perfectly symmetrical composition, single vanishing point centered, architectural symmetry, Kubrick-style forced perspective, corridors converging to center
```

### 5.3 Leading Lines (Líneas Guía)
```text
leading lines guiding to subject, converging lines toward focal point, road leading into distance, railway tracks perspective, architectural lines directing gaze
```

### 5.4 Espacio Negativo
```text
negative space composition, subject occupying small portion of frame, vast empty sky above, deliberate empty space creating loneliness, minimalist negative space, subject lost in frame
```

### 5.5 Dutch Angle (Cámara Inclinada)
```text
Dutch angle tilt, canted frame, tilted horizon line, psychological tension composition, diagonal frame, camera rolled 15-30 degrees
```

### 5.6 Profundidad de Staging
```text
deep staging with foreground middle and background elements, foreground frame element, layered depth of field, bokeh background with sharp foreground framing element
```

### 5.7 Over-the-Shoulder (Por Encima del Hombro)
```text
over-the-shoulder shot, subject's shoulder and back framing foreground, dialogue framing, conversational perspective
```

### 5.8 Low Angle (Ángulo Bajo)
```text
low angle heroic shot, camera below eye level looking up, imposing perspective, subject appears dominant and powerful, worm's eye view
```

### 5.9 High Angle / Bird's Eye
```text
high angle overhead shot, bird's eye view, camera above looking down, subject appears vulnerable or small, God perspective
```

### 5.10 Extreme Close-Up
```text
extreme close-up, eyes filling entire frame, pores visible, micro-expression captured, Leone-style ECU, maximum emotional intensity
```

---

## 6. 🌟 Imperfecciones Ópticas Cinematográficas: El Look Que Da Autenticidad

Estas imperfecciones son lo que separa una imagen cinematográfica real de una imagen "AI genérica". Los modelos tienden a producir imágenes demasiado limpias. Las imperfecciones añaden la textura de la realidad fotoquímica.

### 6.1 Film Grain (Grano de Película)
```text
visible film grain overlay, 35mm grain texture, ISO 3200 grain, heavy grain visible on skin and shadows, Kodak 5219 grain structure, organic photochemical grain
```

**Cuándo:** Casi siempre para romper el look digital de AI. El grano es el primer paso para hacer una imagen creíble.
**Trampa:** `grain` solo en algunos modelos produce ruido digital uniforme, no grano orgánico. Usar `organic film grain, photochemical grain texture` para especificar el tipo.

### 6.2 Halation (Halo Rojizo en Altas Luces)
```text
halation effect on highlights, reddish-orange halo bleeding around bright light sources, film base halation, anti-halation layer missing effect, light bloom on film emulsion
```

**Qué es:** En película analógica, la luz intensa penetra la emulsión y se refleja en la base de acetato produciendo un halo rojizo-naranja. Es uno de los indicadores más fuertes de "esto es película real".
**Cuándo:** Fuentes de luz en frame (lámparas, ventanas, sol), luces de neón.

### 6.3 Anamorphic Lens Flare
```text
anamorphic lens flare, horizontal blue streak flare, oval bokeh highlights, barrel distortion at frame edges, 2.39:1 scope format, anamorphic compression artifacts
```

**Componentes del look anamórfico:**
- Destellos horizontales (no radiales) azulados o dorados
- Bokeh con forma oval (no redonda)
- Leve distorsión barril en los bordes
- Rango dinámico comprimido

### 6.4 Chromatic Aberration (Aberración Cromática)
```text
subtle chromatic aberration, color fringing on high contrast edges, purple fringing on highlights, red-cyan color split at edges, optical lens aberration, prismatic color separation
```

**Cuándo:** Lentes vintage, tomas en backlight extremo, bordes de objetos contra el cielo.
**Nivel:** Sutil es cinematográfico. Extremo es videojuego de los años 2000. Usar `subtle` o `slight`.

### 6.5 Vignette (Viñetado)
```text
subtle lens vignette, darkened edges and corners, natural optical vignette, drawing attention to center, vintage lens light falloff
```

### 6.6 Gate Weave (Vibración del Frame)
```text
gate weave film instability, slight frame jitter, analog film registration movement, vintage projector shake
```

**Cuándo:** Solo para estética muy vintage o experimental. En exceso parece error técnico.

### 6.7 Lens Breathing (Respiración del Lente)
```text
lens breathing artifact, slight zoom pulse during focus rack, optical zoom breathing, analog lens focus pull
```

### 6.8 Dust and Scratches
```text
film scratches and dust particles, analog film damage, vertical scratch lines, dust specks on film emulsion, archival film texture
```

### 6.9 Focus Rack / Bokeh Transition
```text
focus rack from foreground to background, shifting plane of focus, selective focus pull, bokeh transition, depth of field shift
```

### 6.10 Temporal Dither / Step-Print
```text
step-printing motion effect, temporal dithering, stuttered motion, Wong Kar-wai motion blur, slow shutter painterly motion
```

---

## 7. ⚠️ Cinemático REAL vs. Cinemático de AI: Cómo Evitar el Segundo

### El "Cinemático de AI" — El Problema

Los modelos AI han sido entrenados con millones de imágenes etiquetadas como "cinematic". Esto ha creado un arquetipo genérico: **el look AI cinemático** que tiene características muy reconocibles:

| Característica | Look AI Cinemático | Look Cinematográfico Real |
|:---|:---|:---|
| **Suavidad** | Piel perfecta como plástico, sin poros | Textura real de piel con imperfecciones |
| **Contraste** | Sobre-contrastado, sombras aplastadas | Contraste narrativo, sombras con detalle |
| **Color** | Teal & orange predecible, siempre igual | Color motivado por la historia y el lugar |
| **Grano** | Sin grano o grano digital uniforme | Grano orgánico fotoquímico irregular |
| **Bokeh** | Circular perfecto, siempre presente | Variable, oval si anamórfico, contextual |
| **Iluminación** | Tres puntos perfectos, sin dirección | Una fuente dominante con motivación |
| **Composición** | Siempre centrado o rule-of-thirds exacto | Asimétrico, intencional, narrativo |
| **Detalle** | Hipernítido en todo el frame | Selectivamente nítido, resto en bokeh |

### Estrategias para Escapar del Look AI

**1. Especifica imperfecciones antes que cualquier otra cosa:**
```text
heavy 35mm film grain, halation on practical lights, slight chromatic aberration, [resto del prompt...]
```

**2. Usa referencias de películas específicas, no géneros:**
❌ `cinematic photography`
✅ `shot on location like Alfonso Cuarón's Roma, 2018`

**3. Nombra al cinematógrafo, no al director:**
❌ `Nolan style`
✅ `Hoyte van Hoytema cinematography on Dunkirk`

**4. Especifica las imperfecciones del proceso:**
```text
photochemical color process, optical printing artifacts, analog film base, Kodak Vision3 250D stock
```

**5. Describe la fuente de luz, no el resultado:**
❌ `moody lighting`
✅ `single 2K fresnel from camera left at 45 degrees, motivated by window out of frame`

**6. Añade elementos contraintuitivos que rompen la perfección AI:**
```text
slight motion blur on subject's hand, background lamp slightly overexposed, skin with visible pores and texture
```

**7. Usa tokens de proceso de producción:**
```text
on-location production still, between takes photography, making-of film style, documentary set photography
```

**8. Referencia stock de película específico:**
```text
KODAK 5219 500T for tungsten interior, KODAK 5207 250D for daylight exterior, FUJIFILM Eterna Vivid 500T
```

### El Token Más Poderoso Contra el Look AI
```text
shot on analog film with visible photochemical characteristics, no digital post-processing look, raw scan from film negative, ungraded natural color science
```

---

## 8. 🎬 20 Prompts de Ejemplo con Análisis Cinematográfico Completo

---

### PROMPT 01 — La Espera en la Ciudad de Noche (Wong Kar-wai)

**Escena:** Una mujer espera en un bar de Hong Kong, 1962. Las luces de neón la bañan. Está sola pero no solitaria.

**Análisis Cinematográfico:**
- **Director de referencia:** Wong Kar-wai / In the Mood for Love
- **Cinematógrafo:** Christopher Doyle
- **Color grade:** Magentas y ámbar saturados, sombras verde oscuro
- **Iluminación:** 100% prácticas (neón, faroles, lámpara de mesa)
- **Lente:** 28mm a f/1.4, focus rack suave
- **Composición:** Off-center derecha, espacio negativo izquierda
- **Efecto signature:** Step-printing (motion blur temporal)

```text
Wong Kar-wai cinematic style, In the Mood for Love 1962 aesthetic, intimate close-up of a solitary woman in a dimly lit Hong Kong bar at night, wearing a floral silk cheongsam dress, saturated warm magenta and amber practical neon lights bleeding onto her skin, step-printing motion blur on her hands holding a glass, deep green and jade shadow tones, shallow depth of field with melancholic defocus, Christopher Doyle cinematography, expired Kodak film grain, halation around neon signs, melancholic romantic atmosphere, off-center composition with negative space, --ar 2:3
```

---

### PROMPT 02 — El Astronauta Solo en el Cosmos (Nolan)

**Escena:** Un astronauta mira a través de la ventanilla de su nave. La Tierra es apenas un punto de luz en el fondo.

**Análisis Cinematográfico:**
- **Director de referencia:** Christopher Nolan / Interstellar
- **Color grade:** Azul-acero frío, blancos sobreexpuestos, sin warmth
- **Iluminación:** Luz prácticas del panel de control + luz fría del cosmos
- **Lente:** IMAX, perspectiva normal con tremenda profundidad de campo
- **Composición:** Figura humana pequeña, 85% frame es universo
- **Imperfecciones:** Mínimas — Nolan prefiere la limpieza épica

```text
Christopher Nolan Interstellar cinematic style, IMAX large format photography, lone astronaut in EVA suit seen from behind, small human figure against vast dark cosmos, Earth as a tiny blue marble in distance, cold steel-blue lighting from practical ship panels, Hoyte van Hoytema cinematography, deep focus with razor sharp foreground and infinite depth, cold desaturated color palette, steel grey spacesuit texture, awe-inspiring scale contrast, one-point perspective through circular porthole, subtle atmospheric haze of vacuum, --ar 21:9
```

---

### PROMPT 03 — El Detective en la Lluvia (Fincher)

**Escena:** Detective bajo lluvia nocturna, luz de farola desde arriba. Rostro a medias en sombra. Contexto: Años 90 urbano.

**Análisis Cinematográfico:**
- **Director de referencia:** David Fincher / Se7en / Zodiac
- **Color grade:** Verde-oliva en sombras, piel desaturada, lluvia realza el grano
- **Iluminación:** Una fuente hard (farola), sin fill, sombras aplastadas
- **Lente:** 40mm, ligeramente wide
- **Imperfecciones:** Grano pesado ISO 800 simulado, halos en luces de la calle

```text
David Fincher Se7en cinematic style, Jeff Cronenweth cinematography, medium close-up of weathered male detective standing in rain-soaked night street, face half in deep shadow from overhead sodium street lamp, desaturated olive-green shadow tones, cold desaturated skin, visible film grain ISO 800 texture, rain streaks catching light, single hard top-down key light, no fill light, crushed blacks in shadow areas, urban 1990s noir grime texture, wet asphalt reflections, locked-off static camera, teal and green color science, --ar 16:9
```

---

### PROMPT 04 — El Corredor del Hotel (Kubrick)

**Escena:** Un corredor infinito y simétrico de un hotel desierto. Una figura pequeña al fondo. Luz fluorescente clínica.

**Análisis Cinematográfico:**
- **Director de referencia:** Stanley Kubrick / The Shining
- **Color grade:** Blanco-clínico, azules fluorescentes, sin calidez alguna
- **Iluminación:** Luz fluorescente propia del corredor
- **Lente:** 18mm ultra-wide, perspectiva forzada agresiva
- **Composición:** UN punto de fuga perfecto al centro. Alfombra geométrica. Simetría absoluta.

```text
Stanley Kubrick The Shining cinematic style, one-point perspective symmetry, long hotel corridor stretching into infinite distance, patterned geometric carpet symmetric on both sides, small solitary child figure at vanishing point center, clinical cold fluorescent overhead lighting, pale yellow institutional walls, no warmth in color palette, deep depth of field, ultra-wide angle 18mm slight barrel distortion, locked-off static camera, perfectly symmetrical frame, psychological unease atmosphere, --ar 21:9
```

---

### PROMPT 05 — La Duna al Atardecer (Villeneuve)

**Escena:** Figura solitaria de pie en una cresta de duna. Cielo quemado. Silencio visual total.

**Análisis Cinematográfico:**
- **Director de referencia:** Denis Villeneuve / Dune
- **Cinematógrafo:** Greig Fraser
- **Color grade:** Ocre quemado, cielo blanco-sobreexpuesto, sombras violáceas
- **Iluminación:** Luz solar lateral dura desde el horizonte
- **Composición:** Figura en tercio inferior, 75% frame es duna y cielo

```text
Denis Villeneuve Dune cinematic style, Greig Fraser cinematography, extreme wide shot, lone cloaked figure standing on golden sand dune ridge, vast Arrakeen desert landscape, harsh directional sunlight from horizon, overexposed blown-out white sky, scorched earth amber color palette, purple-tinted shadow areas, muted desaturated earth tones, cinematic desolation atmosphere, subject in lower third frame with overwhelming negative space, 1.85:1 prestige drama format, organic film grain, atmospheric heat haze, --ar 21:9
```

---

### PROMPT 06 — La Chica en el Apartamento (A24 / Drama Íntimo)

**Escena:** Mujer joven en un apartamento pequeño, tarde de invierno. Luz de ventana suave. Momento de silencio emocional.

**Análisis Cinematográfico:**
- **Referencia:** A24 / Ladybird / Frances Ha
- **Color grade:** Warm indie — piel durazno, sombras azul-suave, muted tones
- **Iluminación:** Solo ventana lateral (available light)
- **Lente:** 35mm a f/2.8, grain pesado

```text
A24 indie film aesthetic, intimate medium shot of young woman in small apartment, soft overcast winter window light from left, honest unposed expression of quiet introspection, warm skin tones with muted magenta highlights, soft blue-grey shadow tones, 16mm film grain heavy texture, naturalistic available light only, muted earth tone color palette, raw emotional authenticity, handheld slight camera movement, wool sweater texture visible, interior plant in soft background bokeh, --ar 3:4
```

---

### PROMPT 07 — El Amanecer en el Trigo (Malick)

**Escena:** Niña corriendo por un campo de trigo al amanecer. Cámara persiguiéndola, sol directo en el lente.

**Análisis Cinematográfico:**
- **Director:** Terrence Malick / Days of Heaven / The Tree of Life
- **Color grade:** Golden hour extreme — ámbar, dorado intenso
- **Iluminación:** Sol directo como fuente principal (shooting into the sun)
- **Lente:** 21mm, shooting into light, heavy flare

```text
Terrence Malick Days of Heaven cinematic style, Nestor Almendros cinematography, magic hour golden dawn, young girl running through golden wheat field, camera shooting directly into low sun on horizon, extreme lens flare bleeding across frame, golden backlight silhouetting edges of hair and arms, warm amber and gold color palette, Emmanuel Lubezki handheld rotation style, slight motion blur on moving figure, god rays through wheat stalks, joyful ephemeral atmosphere, 35mm film grain, --ar 21:9
```

---

### PROMPT 08 — El Espejo Roto (Park Chan-wook)

**Escena:** Hombre mirándose en un espejo roto. Cada fragmento refleja un ángulo diferente de su rostro. Estética revenge thriller.

**Análisis Cinematográfico:**
- **Director:** Park Chan-wook / Oldboy / Sympathy for Mr. Vengeance
- **Color grade:** Rojos saturados vs verdes oscuros (complementarios)
- **Composición:** Simétrica pero fragmentada por los espejos

```text
Park Chan-wook Oldboy cinematic style, medium close-up of damaged man staring into shattered mirror, multiple fragmented reflections showing different angles of face, deep crimson red practical wall light, forest green shadow tones, highly saturated complementary color palette, cold calculating framing, graphic novel color intensity, detailed texture on skin and broken glass, psychological fractured identity composition, rim light separating subject from dark background, --ar 16:9
```

---

### PROMPT 09 — La Calle Mojada B&W (Cuarón / Roma)

**Escena:** Calle colonial en Ciudad de México, noche. Lluvia. Una figura camina alejándose. Encuadre fijo.

**Análisis Cinematográfico:**
- **Director:** Alfonso Cuarón / Roma (2018)
- **Fotografía:** Alfonso Cuarón (él mismo)
- **Color grade:** Blanco y negro, rango dinámico enorme, silver halide
- **Composición:** Static long shot, figura pequeña en profundidad

```text
Alfonso Cuarón Roma 2018 cinematic style, black and white neorealist photography, long static shot of colonial Mexico City street at night, rain-wet cobblestone reflecting sparse lamplight, lone small figure walking away into depth of frame, deep focus with sharp foreground and background simultaneously, silver halide film texture, high dynamic range from bright white lamps to deep velvet shadows, documentary observational camera, available light neorealism, rich shadow detail, --ar 16:9
```

---

### PROMPT 10 — El Pastel de Colores (Wes Anderson)

**Escena:** Recepción de un hotel vintage de montaña. Dos botones en posición perfectamente simétrica. Paleta pastel.

**Análisis Cinematográfico:**
- **Director:** Wes Anderson / The Grand Budapest Hotel
- **Color grade:** Pastel rico — rosas, amarillos, púrpuras muted
- **Composición:** Perfectamente centrada, plana, teatral

```text
Wes Anderson Grand Budapest Hotel cinematic style, symmetrical centered flat composition, hotel lobby reception interior, two identically dressed bellboys standing in perfect mirror symmetry, pastel pink and lavender color palette, warm golden yellow accent lighting, vintage 1930s European hotel decor, flat depth staging, deliberate artificiality, dollhouse perspective, perfectly centered single vanishing point, whimsical retro props and typography, --ar 4:3
```

---

### PROMPT 11 — El Tiroteo en el Vestuario (Acción / Michael Mann)

**Escena:** Interior vestuario de polideportivo. Fluorescentes. Acción congelada en el momento previo al disparo.

**Análisis Cinematográfico:**
- **Director:** Michael Mann / Heat / Collateral
- **Color grade:** Digital cold — azul-verde, desaturado, sombras profundas
- **Lente:** 2K digital, detalle extremo

```text
Michael Mann Heat cinematic style, digital cold color science, tense action moment inside fluorescent-lit locker room, figure in tactical crouch position frozen pre-action, blue-green fluorescent overhead lighting casting harsh shadows, desaturated cold tones, high detail digital sharpness throughout, no aesthetic grain — pure digital precision, shallow breathing tension atmosphere, institutional grey surfaces, hard light from above, real location feel, --ar 16:9
```

---

### PROMPT 12 — El Funeral en el Campo Abierto (Slow Cinema)

**Escena:** Cementerio rural. Viento moviendo la hierba alta. Pequeño grupo de personas en el horizonte. Sin primer plano.

**Análisis Cinematográfico:**
- **Referencia:** Béla Tarr / Sátántangó — Slow cinema
- **Color grade:** B&W o extremely desaturated, gris plomo
- **Composición:** Total landscape, personajes en la distancia

```text
Béla Tarr slow cinema style, extreme wide establishing shot of rural cemetery, small group of mourners barely visible at horizon line, tall grass bending in wind motion blur, overcast flat grey sky consuming 60% of frame, desaturated almost monochromatic cold grey palette, static contemplative camera position, gloomy existential atmosphere, long exposure grass blur, human figures as compositional elements not subjects, --ar 21:9
```

---

### PROMPT 13 — El Villano en la Penumbra (Neo-Noir)

**Escena:** Hombre sentado al escritorio. Solo la mitad de su cara visible. Habla sin que la cámara se mueva.

**Análisis Cinematográfico:**
- **Referencia:** Fincher + Mann + Neo-Noir contemporáneo
- **Iluminación:** Single-source, hard, unmotivated para aumentar amenaza
- **Color grade:** Verde-teal en sombras, piel desaturada

```text
neo-noir contemporary cinematic style, tightly framed medium shot of seated menacing male figure, exactly half face illuminated by single hard light source from frame left, other half in absolute darkness, dark teal and green shadow tones, clinical desaturated skin, looming power composition, static unmoving camera, dark wooden desk with minimal objects in foreground blur, oppressive atmospheric tension, fine digital grain, heavy vignette, locked-off shot --ar 16:9
```

---

### PROMPT 14 — La Bailarina al Contraluz (Danza / Silueta)

**Escena:** Bailarina clásica en posición arabesque perfecta. Luz desde atrás. Sala de ensayo. Polvo en el aire.

**Análisis Cinematográfico:**
- **Iluminación:** Contraluz total + scatter de polvo
- **Estética:** Prestige drama + arte visual
- **Imperfecciones:** Haze atmosférico, halos en los bordes de la figura

```text
prestige dance film cinematic style, full silhouette of classical ballet dancer in perfect arabesque, strong backlight source through rehearsal studio window, dust particles floating visible in backlit air, dancer's body in total shadow with golden rim-light on edges, atmospheric haze scattering light, graceful motion with slight held-pose tension, dramatic chiaroscuro contrast, warm amber practical window light, fine film grain on shadows, --ar 2:3
```

---

### PROMPT 15 — El Niño en el Umbral (A24 Horror)

**Escena:** Niño de espaldas mirando un pasillo oscuro. La oscuridad es total al fondo. Luz cálida desde atrás.

**Análisis Cinematográfico:**
- **Referencia:** Hereditary / Ari Aster
- **Color grade:** Warm amber en primer plano, oscuridad absoluta al fondo
- **Composición:** Niño en centro-inferior, pasillo como amenaza

```text
A24 Hereditary horror film aesthetic, medium shot of small child seen from behind standing at threshold of dark hallway, warm amber practical lamplight from behind illuminating just shoulders and hair edges, absolute pitch black darkness ahead, psychological dread composition, rule of thirds with child lower center, extreme contrast between warm safety light and cold dark unknown, heavy 35mm film grain, halation around lamp behind child, quiet horror atmosphere, --ar 16:9
```

---

### PROMPT 16 — El Mercado de Noche en Asia (Weerasethakul)

**Escena:** Mercado nocturno en Tailandia. Vapor de comida. Luces de faroles. Multitud borrosa en fondo.

**Análisis Cinematográfico:**
- **Referencia:** Apichatpong Weerasethakul / Tropical Malady
- **Iluminación:** 100% prácticas — faroles, pantallas de teléfono, fuego
- **Color grade:** Warm gold, magentas de faroles, sombras verde-teal

```text
Apichatpong Weerasethakul tropical cinema style, nighttime Thai street market, warm golden practical lantern lights hanging overhead, steam rising from food stalls catching light, humid tropical atmosphere, blurred crowd movement in background, intimate observational medium shot, warm amber and orange practical lighting, teal shadow undertones, documentary realism, shallow depth of field on food textures foreground, ambient noise atmosphere suggested by composition, 16mm film grain, --ar 3:2
```

---

### PROMPT 17 — El Viaje en Coche (Road Movie)

**Escena:** POV desde interior del auto. Autopista nocturna, luces de otros autos, lluvia en el parabrisas.

**Análisis Cinematográfico:**
- **Referencia:** Drive (2011) / Ryan Gosling - Nicolas Winding Refn
- **Color grade:** Synthwave neo-noir: magenta y cyan, purples
- **Imperfecciones:** Gotas de lluvia en vidrio, anamorphic flares

```text
Nicolas Winding Refn Drive 2011 cinematic style, interior POV from inside car at night on rain-wet highway, rain droplets on windshield refracting passing car lights into streaks, purple and magenta neon reflections on wet road surface, anamorphic horizontal lens flare from oncoming headlights, moody neo-synthwave color grade, cyan and magenta dominant palette, driver silhouette visible in rear-view mirror, atmospheric melancholy, light bokeh streaks, --ar 21:9
```

---

### PROMPT 18 — El Amanecer del Explorador (Épica Aventura)

**Escena:** Explorador en cima de montaña nevada, primer rayo de sol. Épica total. IMAX.

**Análisis Cinematográfico:**
- **Referencia:** The Revenant (Iñárritu) / Lubezki
- **Color grade:** Frío azul-plata en sombras, dorado en punta de montaña
- **Iluminación:** Sol naciente lateral rasante

```text
Alejandro Iñárritu The Revenant cinematic style, Emmanuel Lubezki cinematography, lone explorer figure standing on snow-covered mountain summit at exact moment of sunrise, first golden light rays hitting snow peak from right, cold blue-grey shadows on left face and mountain, breath visible as white cloud in frozen air, handheld intimate camera despite epic scale, anamorphic lens flare across frame from rising sun, 65mm large format grain, vast wilderness extending in all directions, survival epic atmosphere, --ar 21:9
```

---

### PROMPT 19 — La Reunión en el Café (Drama Europeo)

**Escena:** Dos personas en un café parisino, tarde lluviosa. Conversación tensa. Enfoque en quien escucha, no quien habla.

**Análisis Cinematográfico:**
- **Referencia:** Claude Sautet / Éric Rohmer — Nueva Ola Francesa tardía
- **Color grade:** Natural, desgastado, vintage 1970s color science
- **Composición:** Over-the-shoulder, enfoque en rostro que reacciona

```text
French New Wave late period cinematic style, Claude Sautet atmospheric drama, intimate over-the-shoulder medium shot in Parisian café, listening character's face in sharp focus showing subtle emotional reaction, speaking figure as blurred foreground shoulder, rainy afternoon light through condensation-fogged window, muted natural 1970s color palette, warm amber café interior light, vintage 35mm Kodachrome color science, two-shot dramatic tension, ambient café noise suggested, slight film gate texture, --ar 3:2
```

---

### PROMPT 20 — El Final de la Película (Plano Final / Freeze Frame)

**Escena:** Figura caminando hacia el horizonte en camino rural. Luz del atardecer final. Composición icónica de fin de película.

**Análisis Cinematográfico:**
- **Referencia:** Butch Cassidy / Paris, Texas / Los 400 Golpes
- **Técnica:** Freeze frame implícito, composición conclusiva
- **Color grade:** Golden late-afternoon, desaturación vintage

```text
classic film ending cinematic composition, long shot of solitary figure walking away down rural dirt road toward distant horizon, last golden light of late afternoon sun backlighting the scene, road converging to single vanishing point, figure small against vast landscape, warm amber and dusty ochre color palette, slight film fading vintage color shift, 35mm Kodachrome expired film aesthetic, nostalgic melancholy atmosphere, static locked-off camera respecting the departure, cinematic closure visual grammar, film grain and vignette, --ar 21:9
```

---

## 📋 Tabla de Referencia Rápida: Tokens por Director

| Director | Color Grade | Lente | Iluminación | Token Principal |
|:---|:---|:---|:---|:---|
| **Nolan** | Steel blue, cold | IMAX wide | Practical + overcast | `IMAX large format, Hoyte van Hoytema, cold steel-blue` |
| **Villeneuve** | Amber + violet | 1.85:1 flat | Hard side-sun | `Greig Fraser, desolate atmosphere, vast negative space` |
| **Fincher** | Olive green shadows | 40mm | Single hard source | `Jeff Cronenweth, desaturated olive tones, static camera` |
| **Kubrick** | Clinical white | 18mm ultra-wide | Fluorescent/practical | `one-point perspective, perfect symmetry, cold institutional` |
| **Wong Kar-wai** | Magenta + amber | 28mm f/1.4 | 100% practical neon | `Christopher Doyle, step-printing blur, neon practical lights` |
| **A24** | Warm muted indie | 16mm Super16 | Available light | `16mm film grain, naturalistic lighting, A24 prestige` |
| **Wes Anderson** | Pastel balanced | Normal focal | Flat studio-style | `symmetrical centered, pastel palette, dollhouse perspective` |
| **Malick** | Extreme golden hour | 21mm wide | Sun direct source | `Emmanuel Lubezki, golden backlight, shooting into sun` |
| **Park Chan-wook** | Saturated complementary | Variable | Hard theatrical | `crimson and forest green, Park Chan-wook, graphic intensity` |
| **Cuarón** | B&W silver / natural | Normal wide | Available | `neorealist available light, Roma aesthetic, deep focus` |

---

## 🔑 Tokens Maestros Anti-AI-Look (Usar Siempre)

```text
organic 35mm film grain, photochemical color process, analog film scan, shot on location, 
halation on highlight sources, subtle chromatic aberration on edges, natural skin texture 
with pores visible, motivated practical lighting only, slight optical vignette, 
unmanipulated color science, raw film negative aesthetic, Kodak Vision3 stock
```

---

#cinematografia #promptengineering #aicinema #flux #midjourney #filmmaking #colorgrading #directores #esteticasvisuales
