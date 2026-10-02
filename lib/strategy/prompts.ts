/**
 * Los dos prompts de `/estrategia` (migración `0017`):
 *
 *   1. **Generador de ideas** — pilar × cliente ideal × fuente × taxonomía de
 *      Andrea Estratega (gancho, estructura, pilar de valor).
 *   2. **Borrador de estrategia** — propone cliente ideal + 5 pilares a partir
 *      del perfil de la marca y sus servicios. Propone, NO guarda: mismo
 *      principio que "Llenar desde landing" (un dato mal inferido que se
 *      guardara solo terminaría en todas las ideas).
 *
 * Módulo puro: prompts + normalizadores que nunca lanzan. Las llamadas viven en
 * `app/(app)/estrategia/actions.ts`.
 */

import {
  HOOK_TYPES,
  SCRIPT_STRUCTURES,
  VALUE_PILLARS,
  HOOK_TYPE_SLUGS,
  SCRIPT_STRUCTURE_SLUGS,
  VALUE_PILLAR_SLUGS,
  type TaxonomyItem,
} from "@/lib/competencia/taxonomy";
import { HOOK_RULES_PROMPT } from "@/lib/hooks/criteria";
import {
  ANDREA_PILLARS,
  AWARENESS_LEVELS,
  FORMAT_STYLES,
  IDEA_SOURCES,
  PURPOSES,
  STRATEGY_FIELDS,
  WEEK_DAYS,
  isPurpose,
  sanitizePillars,
  toAwarenessLevel,
  type AwarenessLevel,
  type ContentIdea,
  type IdeaSource,
  type Pillar,
  type Purpose,
  type StrategyFieldKey,
} from "./pillars";

const TUTEO_RULE =
  "Escribes en español latinoamericano con TUTEO (tú, quieres, tienes). Nada de voseo (vos, querés, tenés).";

const taxonomyList = (items: TaxonomyItem[]) =>
  items.map((i) => `- \`${i.slug}\` (${i.label}): ${i.definition}`).join("\n");

// ─── 1. Generador de ideas ───────────────────────────────────────────────────

// Era 6: con 6 ideas se midieron 23.4s (2026-10-02), al borde del límite de
// Netlify (~26s). Volver a subirlo después de la mudanza a Vercel.
export const IDEAS_COUNT = 5;

export const STRATEGY_IDEAS_SYSTEM = `Eres estratega de contenido para Instagram en LATAM, formado en el método de Andrea Estratega: cada pieza nace de un pilar y una línea narrativa, le habla a UN nivel de consciencia, tiene un propósito (viral, valor o venta), un formato que la empaqueta, y abre con un gancho de 3 capas. No eres profesor: eres guía hacia la solución única de la marca.
Tus ideas son ESPECÍFICAS de la marca: nunca propones algo que serviría igual para cualquier cuenta.
${TUTEO_RULE}
Siempre devuelves un JSON válido con la estructura indicada, sin markdown y sin explicaciones.`;

export type IdeaFilters = {
  pillar: Pillar | null;
  level: AwarenessLevel | null;
  purpose: Purpose | null;
  format: "reel" | "carousel" | null;
  format_style: string | null;
  value_pillar: string | null;
  hook_type: string | null;
  script_structure: string | null;
};

export function buildStrategyIdeasPrompt(input: {
  brandContext: string;
  strategyContext: string;
  source: IdeaSource;
  /** Texto de la fuente: notas de build, preguntas pegadas, tendencias, patrones de competencia. */
  sourceMaterial: string | null;
  filters: IdeaFilters;
  /** Ganchos ya guardados en el banco, para no repetir. */
  previousHooks: string[];
  /** "Mi semana": una idea por casilla, en este orden. Pisa `level`. */
  weekSlots?: { day: number; level: AwarenessLevel }[] | null;
}): string {
  const { brandContext, strategyContext, source, sourceMaterial, filters, previousHooks, weekSlots } = input;
  const src = IDEA_SOURCES.find((s) => s.id === source)!;

  const sourceBlock: Record<IdeaSource, string> = {
    matriz:
      "Fuente: **la matriz pilar × cliente ideal**. Cruza el pilar con UN dolor, deseo u objeción concreto del cliente ideal por idea. Nombra en el brief cuál usaste.",
    tendencias:
      "Fuente: **noticias y tendencias** (abajo). Cada idea toma UNA noticia y la traduce a qué significa para el cliente ideal de esta marca, en su idioma. Si una noticia no le importa al cliente ideal, no la uses. Prohibido inventar datos de la noticia que no estén en el resumen.",
    build:
      "Fuente: **lo que la marca construyó/vivió esta semana** (abajo). Build in public: cada idea cuenta un pedazo real (un avance, un error, un número). Prohibido inventar resultados o cifras que no estén en las notas.",
    preguntas:
      "Fuente: **preguntas y mensajes reales de clientes** (abajo). Cada idea responde una pregunta o duda que aparece ahí; el gancho puede citarla casi literal.",
    competencia:
      "Fuente: **patrones que están funcionando en la competencia** (abajo). Copia el PATRÓN (tipo de gancho, estructura, pilar de valor, ángulo), NUNCA el tema, los datos ni las frases. Las ideas son de esta marca.",
    investigacion:
      "Fuente: **una investigación real sobre reels del nicho** (abajo, números YA calculados). Cada idea es un post de autoridad tipo \"analicé N reels de …\": el gancho y el brief usan esos números TAL CUAL (mismo N, mismos %, mismas medianas) — prohibido redondear hacia arriba, inventar otros números o atribuir resultados que no estén ahí. El hallazgo es de PATRONES (qué ganchos y estructuras usan los que más se ven), no de lo que dice cada reel. No nombres las cuentas (@): habla del nicho. Cierra llevando el hallazgo a lo que hace esta marca. Formato sugerido: `investigacion`.",
    contracorriente:
      "Fuente: **contracorriente**. TODAS las ideas son contracorriente (formato `contracorriente`): ni demos, ni casos, ni tutoriales sueltos. Cada idea rompe UNA creencia común del nicho del cliente ideal (las objeciones y miedos de la estrategia son la mina: \"un arquitecto sale caro\", \"eso lo hago yo solo\"). Abre declarando lo contrario de lo que todos repiten, sostenlo con un argumento o mecanismo concreto (no con cifras inventadas) y conecta con la solución única de la marca. Polariza sin insultar al cliente. Formato sugerido: `contracorriente`.",
  };

  const constraints = [
    filters.pillar
      ? `- Todas las ideas son del pilar \`${filters.pillar.key}\` (${filters.pillar.name}).`
      : "- Reparte las ideas entre los pilares respetando su % y el reparto de la etapa de la cuenta.",
    !weekSlots &&
      (filters.level
        ? `- Todas son del nivel de consciencia **${filters.level}**.`
        : "- Mezcla niveles de consciencia; máximo una de solucion_unica."),
    filters.purpose ? `- Propósito: todas \`${filters.purpose}\`.` : "- Elige el propósito según el nivel y la etapa de la cuenta.",
    filters.format ? `- Formato: todas ${filters.format}.` : "- Mezcla reels y carruseles según lo que le sirva a cada ángulo.",
    filters.format_style && `- Estilo de formato obligatorio: \`${filters.format_style}\`.`,
    filters.value_pillar && `- Pilar de valor obligatorio: \`${filters.value_pillar}\`.`,
    filters.hook_type && `- Tipo de gancho obligatorio: \`${filters.hook_type}\`.`,
    filters.script_structure && `- Estructura obligatoria: \`${filters.script_structure}\`.`,
  ]
    .filter(Boolean)
    .join("\n");

  const count = weekSlots?.length ?? IDEAS_COUNT;
  const weekBlock = weekSlots
    ? `\n### Es el plan de UNA SEMANA (método niveles de consciencia)\nDevuelve exactamente ${weekSlots.length} ideas, una por casilla y en este orden, con su \`day\` y \`stage\` tal cual:\n${weekSlots
        .map((sl, i) => `${i + 1}. day=${sl.day} (${WEEK_DAYS[sl.day]}) · stage=${sl.level}`)
        .join("\n")}\nQue la semana cuente un arco: las ideas se encadenan (lo que el lunes nombra como síntoma, el jueves lo explica y el domingo lo resuelve con la oferta). Usa pilares distintos.\n`
    : "";

  return `${brandContext}

${strategyContext}

---

## Taxonomía (método Andrea Estratega)

### Tipos de gancho (\`hook_type\`)
${taxonomyList(HOOK_TYPES)}

### Estructuras de guion (\`script_structure\`)
${taxonomyList(SCRIPT_STRUCTURES)}

### Pilares de valor (\`value_pillar\`)
${taxonomyList(VALUE_PILLARS)}

### Niveles de consciencia (\`stage\`)
${AWARENESS_LEVELS.map((l) => `- \`${l.id}\`: ${l.hint}`).join("\n")}

### Propósitos (\`purpose\`)
${PURPOSES.map((p) => `- \`${p.id}\`: ${p.hint}`).join("\n")}

### Estilos de formato (\`format_style\`)
${FORMAT_STYLES.map((f) => `- \`${f.id}\`: ${f.label}`).join("\n")}

${HOOK_RULES_PROMPT}

---

## Tu tarea
Propón **${count} ideas** de contenido para Instagram.

${sourceBlock[source]}
${weekBlock}
${sourceMaterial?.trim() ? `\n### Material de la fuente (${src.label})\n"""\n${sourceMaterial.trim().slice(0, 6000)}\n"""\n` : ""}
Restricciones:
${constraints}

${previousHooks.length ? `Estos ganchos YA están en el banco; propón ángulos distintos:\n${previousHooks.map((h) => `- ${h}`).join("\n")}\n\n` : ""}Reglas:
- Variedad: no repitas el mismo tipo de gancho más de 2 veces si no es obligatorio.
- Habla al cliente ideal con SUS palabras (las de dolores/deseos), no con jerga técnica.
- Prohibido inventar cifras, casos, clientes o resultados que no estén en el contexto. Si la idea necesita un número que no tienes, deja un hueco entre corchetes para que la marca ponga su dato real: "[N] mensajes", "[X]%".
- Prohibido inventar ofertas: nada de pruebas gratis, descuentos, cupos, garantías, fechas límite ni plazos de entrega ("en 48 horas") que no estén escritos arriba. Si es de convertir, el cierre invita a escribir/agendar, sin condiciones inventadas. Tampoco inventes recursos (plantilla, guía, "link en bio") que la marca no tenga.
- No nombres noticias, lanzamientos ni empresas concretas salvo que vengan en el material de la fuente.
- Ideas que la marca pueda grabar esta semana: concretas, filmables, sin producción imposible.
- El gancho va en 3 capas: \`hook\` = lo que se DICE (máx 14 palabras, abre declarando, sin preguntas débiles); \`hook_text\` = texto en pantalla de 8 a 12 palabras — CUÉNTALAS, menos de 8 es un error; \`hook_visual\` = qué se ve en el primer segundo (máx 20 palabras, filmable con un celular).
- \`angle\`: el ángulo en máximo 8 palabras.
- \`brief\`: 2-3 oraciones: de qué trata, qué dolor/deseo/dato usa y a qué invita el cierre. Es lo que se le pasa al guionista.
- \`why\`: por qué funciona para ESTE cliente ideal, máximo 18 palabras.
- \`pillar_key\` debe ser uno de los keys de los pilares de arriba.

Devuelve ÚNICAMENTE este JSON:
{"ideas": [{${weekSlots ? '"day": 0, ' : ""}"pillar_key": "...", "stage": "inconsciente|emocional|racional|oportunidad|solucion_unica", "purpose": "viral|valor|venta", "format": "reel|carousel", "format_style": "...", "value_pillar": "...", "hook_type": "...", "script_structure": "...", "hook": "...", "hook_text": "...", "hook_visual": "...", "angle": "...", "brief": "...", "why": "..."}]}`;
}

export function normalizeStrategyIdeas(
  raw: unknown,
  ctx: { pillarKeys: string[]; source: IdeaSource },
): (ContentIdea & { day: number | null })[] {
  const list = (raw as { ideas?: unknown })?.ideas;
  if (!Array.isArray(list)) return [];
  const s = (v: unknown, max = 1200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const oneOf = (v: unknown, allowed: string[]) => (typeof v === "string" && allowed.includes(v) ? v : null);
  const styleIds = FORMAT_STYLES.map((f) => f.id);

  return list
    .map((item, idx) => {
      const i = (item ?? {}) as Record<string, unknown>;
      const day = Number(i.day);
      return {
        id: `new${idx + 1}`,
        day: Number.isInteger(day) && day >= 0 && day <= 6 ? day : null,
        pillar_key: oneOf(i.pillar_key, ctx.pillarKeys),
        source: ctx.source,
        stage: toAwarenessLevel(i.stage),
        purpose: isPurpose(i.purpose) ? i.purpose : null,
        format: i.format === "carousel" ? ("carousel" as const) : ("reel" as const),
        format_style: oneOf(i.format_style, styleIds),
        value_pillar: oneOf(i.value_pillar, VALUE_PILLAR_SLUGS),
        hook_type: oneOf(i.hook_type, HOOK_TYPE_SLUGS),
        script_structure: oneOf(i.script_structure, SCRIPT_STRUCTURE_SLUGS),
        hook: s(i.hook, 300),
        hook_text: s(i.hook_text, 200) || null,
        hook_visual: s(i.hook_visual, 300) || null,
        angle: s(i.angle, 200) || null,
        brief: s(i.brief),
        why: s(i.why, 300) || null,
      };
    })
    .filter((i) => i.hook && i.brief)
    .slice(0, 8);
}

// ─── 2. Borrador de estrategia ───────────────────────────────────────────────

export const STRATEGY_DRAFT_SYSTEM = `Eres estratega de marca y contenido para Instagram en LATAM (método Andrea Estratega: pilares temáticos propios de la marca, cada uno etiquetado como Problema, Solución única o Resultado).
Defines al cliente ideal con el lenguaje que ÉL usaría y diseñas pilares que solo esta marca puede sostener.
${TUTEO_RULE}
Siempre devuelves un JSON válido con la estructura indicada, sin markdown y sin explicaciones.`;

export function buildStrategyDraftPrompt(input: {
  brandContext: string;
  productsContext: string;
  /** Lo que ya está escrito en la estrategia: se respeta y se completa. */
  currentContext: string | null;
}): string {
  const { brandContext, productsContext, currentContext } = input;
  const fieldList = STRATEGY_FIELDS.map((f) => `- \`${f.key}\`: ${f.label} — ${f.placeholder}`).join("\n");
  return `${brandContext}

${productsContext || "(La marca todavía no cargó productos o servicios.)"}

${currentContext ? `## Lo que ya está escrito (respétalo y complétalo, no lo contradigas)\n${currentContext}\n` : ""}
---

## Tu tarea
Propón la estrategia de contenido de esta marca.

1. Los campos del cliente ideal:
${fieldList}
   Dolores, deseos y objeciones: 4-6 renglones cada uno, uno por línea, en primera persona del cliente cuando se pueda ("no sé por dónde empezar").

2. **Exactamente 5 pilares**. Para cada uno:
   - \`name\`: 2-5 palabras, memorable, de la marca (no "Educación" a secas).
   - \`objective\`: qué hace por la marca, una frase.
   - \`andrea_pillar\`: a cuál de los 3 pilares de Andrea pertenece —
${ANDREA_PILLARS.map((a) => `     - \`${a.id}\` (${a.label}): ${a.hint}`).join("\n")}
     Los 3 tienen que estar representados.
   - \`share\`: % del mes; los 5 suman 100.
   - \`topics\`: 4-6 LÍNEAS NARRATIVAS concretas (subtemas, objeciones, ideas fuerza), una por línea.
   - \`formats\`: los formatos que mejor le quedan.

Reglas:
- Prohibido inventar clientes, casos, cifras o resultados.
- Si el perfil no alcanza para un campo, déjalo en "".

Devuelve ÚNICAMENTE este JSON:
{"avatar": "...", "dolores": "...", "deseos": "...", "objeciones": "...", "transformacion": "...", "diferenciador": "...", "fuentes": "...", "pillars": [{"name": "...", "objective": "...", "andrea_pillar": "problema|solucion|resultado", "share": 25, "topics": "...", "formats": "..."}]}`;
}

export function normalizeStrategyDraft(raw: unknown): {
  fields: Partial<Record<StrategyFieldKey, string>>;
  pillars: Pillar[];
} {
  const r = (raw ?? {}) as Record<string, unknown>;
  const fields: Partial<Record<StrategyFieldKey, string>> = {};
  for (const f of STRATEGY_FIELDS) {
    const v = r[f.key];
    if (typeof v === "string" && v.trim()) fields[f.key] = v.trim().slice(0, 4000);
  }
  return { fields, pillars: sanitizePillars(r.pillars) };
}

// ─── 3. Test de estrategia (0019) ────────────────────────────────────────────
// Mismo formato de salida que el borrador (se normaliza con
// `normalizeStrategyDraft`), pero la fuente son las respuestas del cliente con
// SUS palabras, no el perfil que cargó Paco. La etapa NO se le pide al modelo:
// la decide `phaseFromAnswers` en código.

export const STRATEGY_TEST_SYSTEM = STRATEGY_DRAFT_SYSTEM;

export function buildStrategyTestPrompt(input: {
  brandContext: string;
  productsContext: string;
  answersText: string;
  phaseLabel: string;
}): string {
  const { brandContext, productsContext, answersText, phaseLabel } = input;
  const fieldList = STRATEGY_FIELDS.map((f) => `- \`${f.key}\`: ${f.label} — ${f.placeholder}`).join("\n");
  return `${brandContext}

${productsContext || "(La marca todavía no cargó productos o servicios.)"}

---

## Lo que respondió la marca en su test de estrategia
Es la fuente principal: manda sobre el perfil de arriba si se contradicen.

${answersText}

Etapa de su cuenta (ya decidida, no la cambies): ${phaseLabel}

---

## Tu tarea
Arma su estrategia de contenido a partir de SUS respuestas.

1. Los campos del cliente ideal:
${fieldList}
   \`avatar\`: en TERCERA persona ("Dueño de casa de…"), máximo 50 palabras.
   Dolores, deseos y objeciones: 3-4 renglones cada uno, uno por línea, en primera persona del cliente y con las palabras que usó la marca cuando se pueda.
   \`transformacion\` y \`diferenciador\`: máximo 40 palabras cada uno.
   \`fuentes\`: de dónde puede sacar material esta marca (sus conversaciones, las preguntas repetidas que mencionó), máximo 30 palabras.

2. **Exactamente 5 pilares**, repartidos según la etapa de la cuenta. Para cada uno:
   - \`name\`: 2-5 palabras, claro para alguien que no sabe de marketing, propio de esta marca.
   - \`objective\`: qué hace por la marca, una frase sencilla de máximo 15 palabras.
   - \`andrea_pillar\`:
${ANDREA_PILLARS.map((a) => `     - \`${a.id}\` (${a.label}): ${a.hint}`).join("\n")}
     Los 3 tienen que estar representados.
   - \`share\`: % del mes; los 5 suman 100.
   - \`topics\`: 4 temas concretos que salen de sus respuestas, uno por línea, cortos.
   - \`formats\`: 2-3 formatos sencillos que pueda grabar con su celular, en una línea.

Reglas:
- Prohibido inventar clientes, casos, cifras, resultados o servicios que no estén en las respuestas o en el perfil.
- Prohibido agregar superlativos o exclusividades que la marca no dijo ("el único", "el mejor", "el primero"): describe lo que hace, no lo compares.
- Nada de jerga de marketing (embudo, lead magnet, top of funnel, awareness): esto lo lee el dueño del negocio.
- Si una respuesta no alcanza para un campo, déjalo en "".

Devuelve ÚNICAMENTE este JSON:
{"avatar": "...", "dolores": "...", "deseos": "...", "objeciones": "...", "transformacion": "...", "diferenciador": "...", "fuentes": "...", "pillars": [{"name": "...", "objective": "...", "andrea_pillar": "problema|solucion|resultado", "share": 25, "topics": "...", "formats": "..."}]}`;
}

/**
 * Red de seguridad en código contra cifras inventadas (probado 2026-10-02: con
 * la regla en el prompt igual salían "47 veces", "200 pacientes olvidados").
 * Toda cifra de 10 o más que NO aparezca en el contexto que recibió el modelo
 * se cambia por "[N]" para que la marca ponga su dato real. Las de 1 a 9 se
 * dejan: son conteos de lista ("3 cosas que…"), no afirmaciones.
 */
export function maskInventedNumbers<T extends Record<string, unknown>>(idea: T, context: string, fields: (keyof T)[]): T {
  // Formato MX: coma de miles, punto decimal ("12,000", "1.5").
  const clean = (n: string) => n.replace(/,/g, "").replace(/\.$/, "");
  const known = new Set((context.match(/\d[\d.,]*/g) ?? []).map(clean));
  const out = { ...idea };
  for (const f of fields) {
    const v = out[f];
    if (typeof v !== "string") continue;
    out[f] = v.replace(/\d[\d.,]*\d|\d/g, (m, offset: number, whole: string) => {
      // Horas ("11:45pm") no son afirmaciones: se dejan.
      if (whole[offset - 1] === ":" || whole[offset + m.length] === ":") return m;
      const n = clean(m);
      return Number(n) >= 10 && !known.has(n) ? "[N]" : m;
    }) as T[keyof T];
  }
  return out;
}
