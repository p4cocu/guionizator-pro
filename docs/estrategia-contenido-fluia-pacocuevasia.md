# Estrategia de contenido — FLUIA y Paco Cuevas IA (oct 2026)

El detalle completo (cliente ideal, dolores, objeciones, temas por pilar) vive en
la app, en `/estrategia`, y se carga con la semilla
`supabase/seeds/0017_estrategia_fluia_pacocuevasia.sql`. Este documento explica
**por qué** quedó así.

## 1. La división de las dos marcas

| | **FLUIA** | **pacocuevas.ia** |
|---|---|---|
| Qué es | Agencia: te lo hago yo | Creador: te enseño a hacerlo |
| Vende | Bot WhatsApp + CRM, automatizaciones, **páginas web**, Sonría | Guionizator ($400/mes; $300 amigos) + mentorías |
| Le habla a | Dueño de clínica dental (nicho único por 3 meses) | Persona no técnica que le tiene miedo a la IA y quiere crear contenido |
| CTA | "Escríbeme por WhatsApp" | Seguir → probar → Guionizator / mentoría |
| Cara | Tú a cámara + pantalla del sistema | Tú a cámara + tus videos cinematográficos |

**Páginas web → FLUIA**, pero no como "hago páginas bonitas" sino como parte del
sistema de captación: *página que trae citas + bot que las agenda*. Vender web
suelta en FLUIA te mete a competir con miles de diseñadores; vendida como pieza
del sistema, es una razón más para contratarte.

## 2. Pilares

### FLUIA — cliente ideal: dueño de clínica dental en México

| # | Pilar | Etapa | % | Para qué |
|---|---|---|---|---|
| 1 | El consultorio por dentro | Atraer | 25 | Que se reconozca en el problema antes de oír "IA" |
| 2 | Caso en vivo: la clínica | Nutrir | 25 | Probar con el bot real: semanas, números, errores |
| 3 | IA sin miedo para tu negocio | Atraer | 20 | Explicar sin jerga qué puede y qué no |
| 4 | Esto no se automatiza | Nutrir | 15 | Autoridad: decir los límites que otros callan |
| 5 | Trabajar con FLUIA | Convertir | 15 | Proceso, demo, Sonría → WhatsApp |

Tu activo más valioso ahora mismo es **el bot de la clínica, que lleva menos de
2 semanas**. Documéntalo desde ya (capturas, conversaciones anonimizadas,
números cada viernes): el pilar 2 se alimenta solo durante meses. Pide permiso a
la clínica para mostrarlo y, si se puede, un testimonio en video al mes 1.

### pacocuevas.ia — cliente ideal: no técnico que quiere perderle el miedo a la IA

| # | Pilar | Etapa | % | Para qué |
|---|---|---|---|---|
| 1 | IA sin miedo | Atraer | 30 | Que haga su primer experimento esta semana |
| 2 | Noticias de IA que sí te importan | Atraer | 20 | Que te ubiquen como alguien que sabe |
| 3 | Así lo hice | Nutrir | 20 | Lucir tu cine/producto/storytelling y desarmarlo |
| 4 | Construyendo en público | Nutrir | 15 | Herramientas propias, números, errores |
| 5 | Tu sistema de contenido | Convertir | 15 | El método → Guionizator y mentorías |

**Regla para las noticias:** noticia → qué significa para alguien no técnico →
lo probé. Si no la puedes bajar a "esto lo puedes usar hoy", no la publiques:
tu público no es el que sigue cada lanzamiento, es el que se siente abrumado.

## 3. Tu cuello de botella no es de ideas, es el perfeccionismo

Lo dijiste tú. Propuesta concreta:

- **Dos niveles de producción.** "Cine" (pilar 3, 1 por semana como máximo) y
  "diario" (todo lo demás: cámara + pantalla, una toma, subtítulos y listo). El
  nivel cine es la vitrina; el diario es lo que construye la constancia.
- **Ritmo mínimo:** 3 piezas por semana por marca. Más vale sostener 3 durante
  3 meses que hacer 7 durante 2 semanas.
- **El perfeccionismo como contenido:** está dentro del pilar 4 de
  pacocuevas.ia. Contarlo te quita presión y conecta con el mismo dolor de tu
  cliente ideal.

## 4. De dónde salen las ideas (lo que hace `/estrategia`)

| Fuente | Qué hace | Cuándo |
|---|---|---|
| Matriz pilar × cliente ideal | Cruza pilar con un dolor/deseo/objeción | Siempre: es la base |
| Noticias y tendencias | Lee lo pendiente de `/tendencias` | 1-2 por semana (pilar Noticias) |
| Lo que hice esta semana | Build in public con tus notas | Cada viernes, 5 min |
| Preguntas reales | Pegas mensajes de WhatsApp/DMs | Cada vez que se repite una pregunta |
| Lo que funciona en Competencia | Toma el patrón, nunca el tema | Para variar ganchos y estructuras |

Cada idea trae pilar, etapa, formato y la clasificación de Andrea (tipo de
gancho, estructura, pilar de valor). "Hacer guion" la manda a `/guiones/nuevo`.

**Rutina sugerida:** lunes, 20 minutos en `/estrategia` por marca → 6-12 ideas
al banco → eliges 3 → guiones. Viernes: notas de build in public.

## 5. Videos de Andrea Estratega para transcribir

Los elegí por cómo encajan con lo que acabamos de armar:

1. **Your Content Strategy is broken (Fix it with your 3 Content Pillars)** —
   `IZdbcZvEj1w`. Contrasta su versión de 3 pilares con nuestros 5; si su
   método pide menos, ajustamos.
2. **4 Levels of Audience Awareness for REELS: Views vs. Sales** —
   `Z_GhTMrhP5A`. Hoy el generador usa 3 etapas (atraer/nutrir/convertir); con
   sus 4 niveles se puede refinar el campo `stage`.
3. **How to Turn Claude Into Your Content Strategist and Create Addictive
   Scripts** — `s4GfyBD5RyY`. Es lo mismo que construimos; sirve para ver qué
   pasos de su flujo nos faltan.
4. **The Strategy to Sell on Instagram with 0 Followers** — `D4eyQF2PgPw`.
   FLUIA vende con poca audiencia y a un nicho chico; el pilar de convertir se
   puede afinar con esto.
5. **With this free AI, you can find viral ideas for Instagram and TikTok** —
   `7W0RHx6KP70`. Otra fuente de ideas que podría sumarse al generador.

Alternativa al 4 si quieres el embudo completo: *The Top Social Media Funnel
Explained in 16 Minutes* (`g7WU8DtG4gk`).
