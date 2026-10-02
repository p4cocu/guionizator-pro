-- ============================================================================
-- Semilla — estrategia de contenido de FLUIA y Paco Cuevas IA (2026-10-01)
-- ============================================================================
-- Correr DESPUÉS de 0017 y 0018 (account_phase y andrea_pillar son de 0018). No es migración: son datos
-- de las marcas de Paco (owner e0b465fe…). `on conflict do nothing`: si ya
-- editaste la estrategia en /estrategia, esto no la pisa.
-- ============================================================================

insert into content_strategies
  (client_id, owner_id, avatar, dolores, deseos, objeciones, transformacion, diferenciador, fuentes, account_phase, pillars)
values
-- ─── FLUIA ──────────────────────────────────────────────────────────────────
(
  '21294465-52d5-4c0d-b4f2-a5ecba0d3984',
  'e0b465fe-48b8-4417-9022-7dc9744894fc',
  'Dueño/a de clínica dental (y después estética o bienestar) en México, 30-55 años, con 1 a 5 sillones. Atiende pacientes Y dirige el negocio. Su canal principal es WhatsApp y lo contesta una recepcionista saturada o el propio dentista entre pacientes. Ya invierte algo en Meta/Google o vive de recomendaciones. No es técnico: no quiere aprender "IA", quiere la agenda llena y menos caos. Segundo círculo: otros negocios de servicios con muchos mensajes (inmobiliarias, academias, consultorios).',
  'Me escriben a las 10pm preguntando precio y para mañana ya se fueron con otro
Mi recepcionista contesta lo mismo 50 veces al día (precio, horario, ubicación)
Los pacientes no llegan a la cita y no me avisan
Tengo cientos de pacientes que no han vuelto a su limpieza y nadie les escribe
No sé cuántos mensajes llegan ni cuántos se vuelven citas
Contesto WhatsApp entre paciente y paciente, con los guantes puestos',
  'Que la agenda se llene sin estar pegado al celular
Que ningún paciente se quede sin respuesta, aunque escriba a medianoche
Que mi equipo se dedique a atender, no a copiar y pegar
Saber de dónde vienen mis pacientes y cuánto me cuesta cada uno
Una página web que sí traiga citas, no solo que se vea bonita',
  'Un bot suena frío, mis pacientes quieren trato humano
Mis pacientes son mayores, no van a hablar con un robot
Ya probé un chatbot de botones y fue horrible
¿Y si contesta algo mal sobre un tratamiento o un precio?
No tengo tiempo de configurar nada
Seguro es carísimo / otra suscripción más',
  'De un WhatsApp caótico que depende de que alguien esté libre → a un sistema que responde en segundos, agenda, recuerda la cita, reactiva pacientes y te avisa cuando hace falta un humano.',
  'No vendo IA: muestro mi propio sistema funcionando. El CRM + bot de WhatsApp con el que opero FLUIA es el mismo que instalo, y hoy ya corre en una clínica dental real. Lo construyo yo (Claude Code), así que se adapta al negocio en días, no en meses. Digo lo que la IA NO debe hacer.',
  'Conversaciones reales del bot de la clínica (anonimizadas): qué preguntan los pacientes, dónde se equivocó el bot
Métricas semanales del caso dental (mensajes atendidos, citas, horario en que escriben)
Preguntas de dueños de clínicas en DMs, llamadas y diagnósticos
Grupos y comentarios de dentistas (Facebook, foros, reels de dentistas)
/tendencias: novedades de WhatsApp Business, Meta y agentes de IA
Lo que construyo cada semana (CRM, SonrIA, páginas con bot)',
  'freshman',
  '[
    {"key":"consultorio_por_dentro","name":"El consultorio por dentro","objective":"Que el dueño de la clínica se reconozca en el problema antes de oír la palabra IA.","andrea_pillar":"problema","share":25,"topics":"El paciente que escribe a las 11pm y nadie contesta\nLa recepcionista que responde lo mismo 50 veces\nLas citas a las que nadie llega\nLos pacientes que no regresan a su limpieza\nCuánto dinero se va en mensajes sin responder","formats":"Reel a cámara con escena dramatizada, carrusel espejo"},
    {"key":"caso_en_vivo","name":"Caso en vivo: la clínica","objective":"Probar que funciona mostrando un sistema real con números, errores y ajustes semana a semana.","andrea_pillar":"resultado","share":25,"topics":"Semana 1, 2, 3 del bot en la clínica dental\nLas preguntas reales que hacen los pacientes\nEl error del bot y cómo lo corregí\nNúmeros: mensajes atendidos, citas agendadas, horario\nAntes y después del WhatsApp de la clínica","formats":"Cámara + grabación de pantalla, carrusel de resultados"},
    {"key":"ia_sin_miedo_negocio","name":"IA sin miedo para tu negocio","objective":"Explicar sin jerga qué puede y qué no puede hacer la IA en un consultorio, para bajar el miedo y la desconfianza.","andrea_pillar":"problema","share":20,"topics":"Qué es un agente de IA (explicado como un empleado)\nChatbot de botones vs agente que entiende\nQué se automatiza primero en una clínica\nCuánto cuesta de verdad automatizar\nPágina web bonita vs página que trae citas","formats":"Reel a cámara con analogías, carrusel explicativo"},
    {"key":"esto_no_se_automatiza","name":"Esto no se automatiza","objective":"Ganar autoridad diciendo lo que otros callan: los límites de la IA y los errores de implementación.","andrea_pillar":"solucion","share":15,"topics":"Lo que nunca dejaría en manos de un bot\nPor qué un bot malo es peor que no tener bot\nErrores comunes al poner un chatbot\nMitos de la IA que venden las agencias\nCuándo te digo que NO necesitas un bot","formats":"Reel opinión a cámara, gancho controversial"},
    {"key":"trabajar_con_fluia","name":"Trabajar con FLUIA","objective":"Convertir: mostrar cómo es el proceso, qué se entrega y cómo empezar por WhatsApp.","andrea_pillar":"solucion","share":15,"topics":"Cómo es el diagnóstico de tu WhatsApp\nDemo en vivo: escríbele al bot\nQué incluye: bot + CRM + página web con bot\nSonrIA: el sistema para clínicas dentales\nQué pasa después de que me escribes","formats":"Reel demo con pantalla, story con CTA a WhatsApp"}
  ]'::jsonb
),
-- ─── Paco Cuevas IA ─────────────────────────────────────────────────────────
(
  '026c7c08-b5d0-4bae-99c9-26efd2b7c983',
  'e0b465fe-48b8-4417-9022-7dc9744894fc',
  'Persona no técnica de 25-50 años en LATAM —emprendedor, coach, dueño de negocio pequeño o creador que empieza— que sabe que debería usar IA y publicar contenido, pero la IA le da miedo o lo abruma. Probó ChatGPT un par de veces y le salieron textos genéricos. Consume contenido en Instagram y YouTube, no lee en inglés y no quiere aprender a programar. Segundo círculo (el que compra): creadores y negocios que ya publican y quieren un sistema para hacerlo más rápido y con su voz → Guionizator y mentorías.',
  'Cada semana sale una IA nueva y siento que voy tarde
No sé por dónde empezar ni qué herramienta usar
Lo que me da la IA suena a robot, no a mí
Me quedo en blanco cuando tengo que publicar
Quiero que todo me quede perfecto y por eso no publico
No tengo tiempo de grabar, editar y escribir copy',
  'Usar la IA sin sentirme tonto ni técnico
Publicar seguido con mi propia voz
Que mi contenido se vea profesional, de cine, sin un equipo
Tener un sistema: saber qué publicar cada semana
Que el contenido me traiga clientes, no solo likes',
  'No soy de tecnología, eso no es para mí
La IA hace contenido genérico, me va a quitar autenticidad
Son muchas suscripciones, me sale caro
Todo está en inglés
Lo que veo en redes es humo: "hazte viral con este prompt"',
  'De "la IA me da miedo y no sé qué publicar" → a "tengo un sistema con IA que me ayuda a crear y publicar contenido con mi voz cada semana".',
  'Construyo mis propias herramientas (Claude Code, Weavy AI, Guionizator) en vez de solo recomendar apps. Tengo ojo de detalle visual y storytelling cinematográfico. Enseño desde cero con analogías, sin hype, y muestro lo real: errores, números y a veces cuánto cobro.',
  '/tendencias + skill last30days: noticias de IA de la semana (filtrar solo lo que un no técnico puede usar ya)
Mis propios proyectos: videos cinematográficos, de producto, animados, portadas (el detrás de cámaras)
Lo que construyo en Guionizator y con Claude Code
Preguntas de alumnos, clientes y comentarios ("¿con qué hiciste esto?")
Competencia: creadores de IA en español (Competencia, para patrones)
Mis errores: perfeccionismo, lo que no funcionó',
  'sophomore',
  '[
    {"key":"ia_sin_miedo","name":"IA sin miedo","objective":"Que alguien que no entiende nada de IA pierda el miedo y haga su primer experimento esta misma semana.","andrea_pillar":"problema","share":30,"topics":"Tu primer video/imagen con IA en 5 minutos\nConceptos explicados con analogías (qué es un prompt, un modelo, un agente)\nErrores de principiante con ChatGPT y Claude\nQué herramienta usar para qué (sin abrumar)\nCómo hacer que la IA suene a ti","formats":"Reel a cámara + pantalla, carrusel paso a paso"},
    {"key":"noticias_ia","name":"Noticias de IA que sí te importan","objective":"Posicionarme como alguien que sabe de lo que habla, traduciendo la noticia a qué puedes hacer con ella hoy.","andrea_pillar":"problema","share":20,"topics":"La noticia de la semana + qué significa para ti\nLo probé: ¿sirve o es humo?\nHerramientas nuevas gratis para creadores\nCambios de Instagram/Meta con IA\nLo que NO tienes que aprender (filtro)","formats":"Reel corto a cámara con pantalla verde/captura, carrusel resumen"},
    {"key":"asi_lo_hice","name":"Así lo hice","objective":"Mostrar mi habilidad (cine, producto, storytelling) y desarmar el proceso para que se vea alcanzable.","andrea_pillar":"resultado","share":20,"topics":"Video cinematográfico hecho con IA + el detrás\nVideo de producto: de foto de celular a anuncio\nEl prompt y el flujo en Weavy AI\nAntes y después de una portada / un reel\nStorytelling: por qué este video retiene","formats":"Reel showcase + breakdown, carrusel antes/después"},
    {"key":"construyendo_en_publico","name":"Construyendo en público","objective":"Generar confianza y cercanía con el proceso real: herramientas propias, números, errores y el perfeccionismo.","andrea_pillar":"solucion","share":15,"topics":"Construyendo Guionizator con Claude Code\nCuánto cobré / cuánto gané / cuánto gasté en IA\nEl error que me costó tiempo\nPerfeccionismo vs publicar: mi reto\nMi sistema de contenido de esta semana","formats":"Reel a cámara estilo diario, stories"},
    {"key":"tu_sistema_de_contenido","name":"Tu sistema de contenido","objective":"Convertir: enseñar el método (pilares, ganchos, guiones) y ofrecer Guionizator y mentorías como el atajo.","andrea_pillar":"solucion","share":15,"topics":"Cómo saco ideas para un mes en una tarde\nGanchos y estructuras que uso (método Andrea Estratega aplicado)\nDemo de Guionizator: de idea a guion\nMentoría: cómo trabajo contigo\nResultados de alumnos/clientes (cuando existan)","formats":"Reel demo, carrusel método, story con CTA"}
  ]'::jsonb
)
on conflict (client_id) do nothing;
