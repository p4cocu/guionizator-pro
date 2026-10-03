/**
 * Estrategia de contenido por marca (migración `0017`): el cliente ideal y los
 * pilares. Fuente de verdad de la forma de `content_strategies.pillars` (jsonb)
 * y de los valores de texto de `content_ideas` (sin CHECK en la base).
 *
 * `sanitizeStrategy` es el ÚNICO camino de escritura: recorta, descarta lo que
 * no reconoce y nunca lanza. Así un pilar mal formado que venga de la IA o del
 * browser no termina guardado.
 *
 * Módulo puro (no importa Supabase): lo usan la pantalla y las server actions.
 */

// ─── Método Andrea Estratega (2026-10-02) ────────────────────────────────────
// Fuente: "Tu estrategia de contenido está rota (3 pilares)" y "4 niveles de
// consciencia de un Reel". Una pieza = pilar + línea narrativa + PROPÓSITO +
// FORMATO, dirigida a UN nivel de consciencia, con un reparto que depende de la
// ETAPA de la cuenta.

/** Los 3 pilares de Andrea: el camino del cliente hasta la compra. */
export type AndreaPillar = "problema" | "solucion" | "resultado";

export const ANDREA_PILLARS: { id: AndreaPillar; label: string; hint: string }[] = [
  { id: "problema", label: "Problema", hint: "Hacer consciente al cliente de lo que le pasa (y de lo que de verdad quiere)" },
  { id: "solucion", label: "Solución única", hint: "Tu diferencial: tu método, tu sistema, cómo lo haces tú" },
  { id: "resultado", label: "Resultado", hint: "El fruto: resultados, casos, el estilo de vida después" },
];

export function isAndreaPillar(v: unknown): v is AndreaPillar {
  return v === "problema" || v === "solucion" || v === "resultado";
}

/** Los 5 niveles de consciencia (el video dice 4, explica 5). */
export type AwarenessLevel = "inconsciente" | "emocional" | "racional" | "oportunidad" | "solucion_unica";

export const AWARENESS_LEVELS: { id: AwarenessLevel; label: string; hint: string }[] = [
  {
    id: "inconsciente",
    label: "Inconsciente",
    hint: "Siente la frustración pero no sabe nombrarla. Videos de síntomas, errores, 'te pasa esto', escenas actuadas.",
  },
  {
    id: "emocional",
    label: "Emocional",
    hint: "Ya ve el problema; ahora qué le hace sentir (culpa, cansancio). Storytelling, reflexión, acompañar sin juzgar.",
  },
  {
    id: "racional",
    label: "Racional",
    hint: "Puede nombrarlo y quiere entenderlo. Mostrar el patrón que lo frena, contenido explicativo.",
  },
  {
    id: "oportunidad",
    label: "Oportunidad",
    hint: "Sabe que hay solución. Tutoriales profundos con tu experiencia: te posicionan como autoridad.",
  },
  {
    id: "solucion_unica",
    label: "Solución única",
    hint: "Quiere TU solución. Método, resultados, testimonios, promesa y CTA directo.",
  },
];

/** Las etapas viejas (atraer/nutrir/convertir) se leen mapeadas. */
export function toAwarenessLevel(v: unknown): AwarenessLevel {
  if (AWARENESS_LEVELS.some((l) => l.id === v)) return v as AwarenessLevel;
  if (v === "nutrir") return "racional";
  if (v === "convertir") return "solucion_unica";
  return "inconsciente";
}

export type Purpose = "viral" | "valor" | "venta";

export const PURPOSES: { id: Purpose; label: string; hint: string; cta: "frio" | "tibio" | "caliente" }[] = [
  { id: "viral", label: "Viral", hint: "Tratamiento simple y digerible, para gente nueva", cta: "frio" },
  { id: "valor", label: "Valor", hint: "Tratamiento profundo, con ejemplos y experiencia propia", cta: "tibio" },
  { id: "venta", label: "Venta", hint: "Formato viral + llamado a la acción directo", cta: "caliente" },
];

export function isPurpose(v: unknown): v is Purpose {
  return v === "viral" || v === "valor" || v === "venta";
}

/** El "empaque" del mensaje. Variar formatos evita que todo se vea igual. */
export const FORMAT_STYLES: { id: string; label: string; purpose: Purpose[] }[] = [
  { id: "camara_claim", label: "A cámara con claim fuerte en pantalla", purpose: ["viral", "venta"] },
  { id: "objeto_en_mano", label: "Cara + objeto en mano", purpose: ["viral"] },
  { id: "pov", label: "POV / escena actuada", purpose: ["viral"] },
  { id: "errores", label: "Errores comunes / 'deja de…'", purpose: ["viral"] },
  { id: "versus", label: "Versus / comparación", purpose: ["viral", "valor"] },
  { id: "numero_lista", label: "Número + lista ('3 señales de…')", purpose: ["viral", "valor"] },
  { id: "pizarra", label: "Pizarra / esquema explicado", purpose: ["valor"] },
  { id: "pantalla", label: "Grabación de pantalla con voz", purpose: ["valor", "venta"] },
  { id: "storytelling", label: "Storytelling a cámara", purpose: ["valor"] },
  { id: "caso_real", label: "Caso real / prueba en vivo", purpose: ["valor", "venta"] },
  { id: "investigacion", label: "Investigación ('analicé N…')", purpose: ["viral", "valor"] },
  { id: "contracorriente", label: "Contracorriente (rompe una creencia)", purpose: ["viral", "venta"] },
  { id: "demo", label: "Demo del producto/servicio", purpose: ["venta"] },
  { id: "carrusel_pasos", label: "Carrusel paso a paso", purpose: ["valor"] },
  { id: "carrusel_antes_despues", label: "Carrusel antes / después", purpose: ["valor", "venta"] },
];

export function formatStyleLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return FORMAT_STYLES.find((f) => f.id === id)?.label ?? id;
}

/** Etapa de la cuenta → qué pilares y propósitos priorizar en el mes. */
export type AccountPhase = "freshman" | "sophomore" | "junior" | "senior";

export const ACCOUNT_PHASES: {
  id: AccountPhase;
  label: string;
  hint: string;
  /** Lo que se le dice al modelo al repartir el mes. */
  mix: string;
}[] = [
  {
    id: "freshman",
    label: "Freshman — sin audiencia",
    hint: "Casi no hay leads ni audiencia. Objetivo: que te vean y empezar conversaciones.",
    mix: "Prioriza el pilar PROBLEMA (el más viral). Propósitos: mayoría viral, algo de valor, venta solo sutil e indirecta (viral + CTA suave a un recurso o a escribir).",
  },
  {
    id: "sophomore",
    label: "Sophomore — oferta en construcción",
    hint: "Ya crea contenido pero la oferta todavía no está clara. Objetivo: posicionarse y hacer visible qué vende.",
    mix: "Prioriza SOLUCIÓN ÚNICA y luego PROBLEMA conectado con tu diferencial. Propósitos: viral y valor por igual, una de venta por semana.",
  },
  {
    id: "junior",
    label: "Junior — leads pero pocas ventas",
    hint: "Tiene leads y producto, pero todavía no le confían. Objetivo: confianza y primeras ventas.",
    mix: "Prioriza SOLUCIÓN ÚNICA y RESULTADO. Propósitos: prioridad valor (educar a quien ya te sigue), menos viral, una de venta.",
  },
  {
    id: "senior",
    label: "Senior — escalar ventas",
    hint: "Ya vende y quiere escalar. Objetivo: escalar con sistema.",
    mix: "Todos los pilares con foco en diferenciación, autoridad, casos y testimonios. Viral enfocado en diferenciación (gancho viral, cierre con tu método), dos de valor, una de venta.",
  },
];

export function isAccountPhase(v: unknown): v is AccountPhase {
  return ACCOUNT_PHASES.some((p) => p.id === v);
}

/**
 * La semana por niveles de consciencia (Andrea): lun-mar inconsciencia, mié
 * emocional, jue racional, vie-sáb oportunidad, dom solución única. Si no se
 * publica diario, se recorta empezando por lo que menos mueve.
 */
export const WEEK_PLANS: Record<number, { day: number; level: AwarenessLevel }[]> = {
  3: [
    { day: 0, level: "inconsciente" },
    { day: 3, level: "oportunidad" },
    { day: 5, level: "solucion_unica" },
  ],
  4: [
    { day: 0, level: "inconsciente" },
    { day: 2, level: "racional" },
    { day: 4, level: "oportunidad" },
    { day: 6, level: "solucion_unica" },
  ],
  5: [
    { day: 0, level: "inconsciente" },
    { day: 2, level: "emocional" },
    { day: 3, level: "racional" },
    { day: 4, level: "oportunidad" },
    { day: 6, level: "solucion_unica" },
  ],
  7: [
    { day: 0, level: "inconsciente" },
    { day: 1, level: "inconsciente" },
    { day: 2, level: "emocional" },
    { day: 3, level: "racional" },
    { day: 4, level: "oportunidad" },
    { day: 5, level: "oportunidad" },
    { day: 6, level: "solucion_unica" },
  ],
};

export const WEEK_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// ─── Pilares ─────────────────────────────────────────────────────────────────
// Se quedan los 5 pilares TEMÁTICOS de cada marca (lo específico) y cada uno
// se etiqueta con su pilar de Andrea (la lógica de venta). Decisión de Paco,
// 2026-10-02.

export type Pillar = {
  /** Estable: es lo que guarda `content_ideas.pillar_key`. */
  key: string;
  name: string;
  /** Qué hace este pilar por la marca, en una frase. */
  objective: string;
  /** A cuál de los 3 pilares de Andrea pertenece (problema/solución/resultado). */
  andrea_pillar: AndreaPillar;
  /** % del contenido del mes que debería ocupar. */
  share: number;
  /** Líneas narrativas (subtemas / objeciones), una por línea. */
  topics: string;
  /** Formatos que mejor le quedan ("cámara + pantalla", "carrusel"…). */
  formats: string;
};

export const MAX_PILLARS = 6;

// ─── Perfil del cliente ideal ────────────────────────────────────────────────

export type StrategyFieldKey =
  | "avatar"
  | "dolores"
  | "deseos"
  | "objeciones"
  | "transformacion"
  | "diferenciador"
  | "fuentes";

export const STRATEGY_FIELDS: {
  key: StrategyFieldKey;
  label: string;
  placeholder: string;
}[] = [
  {
    key: "avatar",
    label: "Cliente ideal",
    placeholder: "Quién es, qué hace, en qué etapa está, dónde vive su atención…",
  },
  { key: "dolores", label: "Dolores", placeholder: "Uno por línea, con SUS palabras" },
  { key: "deseos", label: "Deseos", placeholder: "Qué quiere lograr, uno por línea" },
  { key: "objeciones", label: "Objeciones / miedos", placeholder: "Por qué no compra o no se anima, uno por línea" },
  {
    key: "transformacion",
    label: "Transformación (de → a)",
    placeholder: "De dónde sale y a dónde llega gracias a ti",
  },
  { key: "diferenciador", label: "Por qué tú", placeholder: "Lo que solo tú puedes enseñar o mostrar" },
  {
    key: "fuentes",
    label: "Fuentes de ideas",
    placeholder: "De dónde sacar material: conversaciones, proyectos, noticias, comentarios…",
  },
];

export type Strategy = Record<StrategyFieldKey, string | null> & {
  client_id: string;
  account_phase: AccountPhase | null;
  pillars: Pillar[];
  updated_at: string | null;
};

export const STRATEGY_COLUMNS =
  "client_id, avatar, dolores, deseos, objeciones, transformacion, diferenciador, fuentes, account_phase, pillars, updated_at";

export function emptyStrategy(clientId: string): Strategy {
  return {
    client_id: clientId,
    avatar: null,
    dolores: null,
    deseos: null,
    objeciones: null,
    transformacion: null,
    diferenciador: null,
    fuentes: null,
    account_phase: null,
    pillars: [],
    updated_at: null,
  };
}

const str = (v: unknown, max = 4000) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "pilar"
  );
}

export function sanitizePillars(raw: unknown): Pillar[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Pillar[] = [];
  for (const item of raw) {
    const p = (item ?? {}) as Record<string, unknown>;
    const name = str(p.name, 80);
    if (!name) continue;
    let key = str(p.key, 40) || slugify(name);
    while (seen.has(key)) key = `${key}_2`;
    seen.add(key);
    const share = Math.round(Number(p.share));
    // Pilares viejos traían `stage` (atraer/nutrir/convertir): se mapean.
    const andrea: AndreaPillar = isAndreaPillar(p.andrea_pillar)
      ? p.andrea_pillar
      : p.stage === "convertir"
        ? "solucion"
        : p.stage === "nutrir"
          ? "resultado"
          : "problema";
    out.push({
      key,
      name,
      objective: str(p.objective, 400),
      andrea_pillar: andrea,
      share: Number.isFinite(share) ? Math.min(100, Math.max(0, share)) : 0,
      topics: str(p.topics, 2000),
      formats: str(p.formats, 300),
    });
    if (out.length >= MAX_PILLARS) break;
  }
  return out;
}

/** Lo que se escribe en `content_strategies` (sin `client_id`/`owner_id`). */
export function sanitizeStrategy(raw: Record<string, unknown>) {
  const fields = Object.fromEntries(
    STRATEGY_FIELDS.map((f) => [f.key, str(raw[f.key]) || null]),
  ) as Record<StrategyFieldKey, string | null>;
  return {
    ...fields,
    account_phase: isAccountPhase(raw.account_phase) ? raw.account_phase : null,
    pillars: sanitizePillars(raw.pillars),
  };
}

export function normalizeStrategyRow(row: Record<string, unknown> | null, clientId: string): Strategy {
  if (!row) return emptyStrategy(clientId);
  return {
    ...emptyStrategy(clientId),
    ...sanitizeStrategy(row),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

/** La estrategia en markdown, lista para meter en un prompt. */
export function buildStrategyContext(s: Strategy): string {
  const fields = STRATEGY_FIELDS.filter((f) => f.key !== "fuentes")
    .map((f) => (s[f.key] ? `**${f.label}:**\n${s[f.key]}` : null))
    .filter(Boolean)
    .join("\n\n");
  const andreaLabel = (id: AndreaPillar) => ANDREA_PILLARS.find((a) => a.id === id)?.label ?? id;
  const pillars = s.pillars
    .map(
      (p) =>
        `- \`${p.key}\` **${p.name}** (pilar de Andrea: ${andreaLabel(p.andrea_pillar)}, ${p.share}% del mes): ${p.objective}` +
        (p.topics ? `\n  Líneas narrativas: ${p.topics.replace(/\n+/g, " · ")}` : "") +
        (p.formats ? `\n  Formatos: ${p.formats}` : ""),
    )
    .join("\n");
  const phase = ACCOUNT_PHASES.find((ph) => ph.id === s.account_phase);
  return [
    "## Estrategia de contenido de la marca",
    fields,
    phase && `### Etapa de la cuenta: ${phase.label}\n${phase.hint}\nReparto: ${phase.mix}`,
    pillars && `### Pilares de contenido\n${pillars}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ─── Fuentes del generador de ideas ──────────────────────────────────────────

export type IdeaSource = "matriz" | "tendencias" | "build" | "preguntas" | "competencia" | "investigacion" | "contracorriente";

export const IDEA_SOURCES: {
  id: IdeaSource;
  label: string;
  hint: string;
  /** Si pide texto libre al usuario. */
  needsText: boolean;
  placeholder?: string;
}[] = [
  {
    id: "matriz",
    label: "Matriz pilar × cliente ideal",
    hint: "Cruza el pilar con los dolores, deseos y objeciones. Ideas desde cero, sin depender de nadie.",
    needsText: false,
  },
  {
    id: "tendencias",
    label: "Noticias y tendencias",
    hint: "Toma lo pendiente de /tendencias y lo baja a lo que le importa a tu cliente ideal.",
    needsText: false,
  },
  {
    id: "build",
    label: "Lo que hice esta semana",
    hint: "Build in public: cuéntale qué construiste, qué falló, qué número salió.",
    needsText: true,
    placeholder: "Ej: el bot de la clínica respondió 140 mensajes en 10 días; se equivocó con los precios de ortodoncia y lo corregí…",
  },
  {
    id: "preguntas",
    label: "Preguntas reales de clientes",
    hint: "Pega mensajes de WhatsApp, DMs o comentarios. Cada pregunta repetida es un contenido.",
    needsText: true,
    placeholder: "Pega aquí las preguntas o mensajes tal cual llegaron…",
  },
  {
    id: "competencia",
    label: "Lo que funciona en Competencia",
    hint: "Toma el patrón (gancho, estructura, pilar de valor) de los posts destacados ya clasificados — no el tema.",
    needsText: false,
  },
  {
    // 0020. Los números los calcula `lib/competencia/research.ts`, nunca la IA.
    id: "investigacion",
    label: "Post de investigación",
    hint: "\"Analicé N reels de cuentas de…\": con los datos reales de Competencia por nicho (y tema). Te posiciona como autoridad.",
    needsText: false,
  },
  {
    id: "contracorriente",
    label: "Contracorriente",
    hint: "Rompe una creencia común de tu nicho (sale de las objeciones de tu cliente ideal). Polariza y te posiciona.",
    needsText: false,
  },
];

export function isIdeaSource(v: unknown): v is IdeaSource {
  return IDEA_SOURCES.some((s) => s.id === v);
}

// ─── Ideas ───────────────────────────────────────────────────────────────────

export type ContentIdea = {
  id: string;
  pillar_key: string | null;
  source: IdeaSource | null;
  /** Nivel de consciencia (columna `stage`, reusada en 0018). */
  stage: AwarenessLevel;
  purpose: Purpose | null;
  format: "reel" | "carousel";
  /** Id de `FORMAT_STYLES` (o texto libre si la IA propuso otro). */
  format_style: string | null;
  value_pillar: string | null;
  hook_type: string | null;
  script_structure: string | null;
  /** Capa verbal del gancho. */
  hook: string;
  /** Capa de texto en pantalla. */
  hook_text: string | null;
  /** Capa visual del primer segundo. */
  hook_visual: string | null;
  angle: string | null;
  brief: string;
  why: string | null;
  used_at?: string | null;
  created_at?: string;
  /** Quién la guardó desde el portal (0024). null = el dueño. */
  generated_by?: string | null;
};

export const IDEA_COLUMNS =
  "id, pillar_key, source, stage, purpose, format, format_style, value_pillar, hook_type, script_structure, hook, hook_text, hook_visual, angle, brief, why, used_at, created_at, generated_by";

/**
 * La fila de `content_ideas` a partir de una idea que viene del browser. Único
 * camino de escritura del banco (estudio y portal): recorta largos, descarta
 * pilares que no son de la marca y normaliza los vocabularios. `null` = vacía.
 * No incluye `owner_id`, `client_id` ni `generated_by`: los pone quien llama.
 */
export function ideaInsertRow(idea: Partial<ContentIdea>, pillars: Pillar[]) {
  const pillarKeys = new Set(sanitizePillars(pillars).map((p) => p.key));
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const hook = s(idea.hook, 300);
  const brief = s(idea.brief, 1500);
  if (!hook || !brief) return null;
  return {
    pillar_key: idea.pillar_key && pillarKeys.has(idea.pillar_key) ? idea.pillar_key : null,
    source: isIdeaSource(idea.source) ? idea.source : null,
    stage: toAwarenessLevel(idea.stage),
    purpose: isPurpose(idea.purpose) ? idea.purpose : null,
    format: idea.format === "carousel" ? "carousel" : "reel",
    format_style: s(idea.format_style, 60) || null,
    hook_text: s(idea.hook_text, 200) || null,
    hook_visual: s(idea.hook_visual, 300) || null,
    value_pillar: s(idea.value_pillar, 40) || null,
    hook_type: s(idea.hook_type, 40) || null,
    script_structure: s(idea.script_structure, 40) || null,
    hook,
    angle: s(idea.angle, 200) || null,
    brief,
    why: s(idea.why, 300) || null,
  };
}
