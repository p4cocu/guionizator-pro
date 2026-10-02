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
import {
  FUNNEL_STAGES,
  IDEA_SOURCES,
  STRATEGY_FIELDS,
  isFunnelStage,
  sanitizePillars,
  type ContentIdea,
  type IdeaSource,
  type Pillar,
  type StrategyFieldKey,
} from "./pillars";

const TUTEO_RULE =
  "Escribes en español latinoamericano con TUTEO (tú, quieres, tienes). Nada de voseo (vos, querés, tenés).";

const taxonomyList = (items: TaxonomyItem[]) =>
  items.map((i) => `- \`${i.slug}\` (${i.label}): ${i.definition}`).join("\n");

// ─── 1. Generador de ideas ───────────────────────────────────────────────────

export const IDEAS_COUNT = 6;

export const STRATEGY_IDEAS_SYSTEM = `Eres estratega de contenido para Instagram en LATAM, formado en el método de Andrea Estratega: cada pieza nace de un pilar, le habla a un nivel de consciencia concreto, abre con un gancho de un tipo definido y se cuenta con una estructura probada.
Tus ideas son ESPECÍFICAS de la marca: nunca propones algo que serviría igual para cualquier cuenta.
${TUTEO_RULE}
Siempre devuelves un JSON válido con la estructura indicada, sin markdown y sin explicaciones.`;

export type IdeaFilters = {
  pillar: Pillar | null;
  stage: ContentIdea["stage"] | null;
  format: "reel" | "carousel" | null;
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
}): string {
  const { brandContext, strategyContext, source, sourceMaterial, filters, previousHooks } = input;
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
  };

  const constraints = [
    filters.pillar
      ? `- Todas las ideas son del pilar \`${filters.pillar.key}\` (${filters.pillar.name}).`
      : "- Reparte las ideas entre los pilares, respetando más o menos su porcentaje.",
    filters.stage
      ? `- Todas son de la etapa **${filters.stage}** (${FUNNEL_STAGES.find((s) => s.id === filters.stage)?.hint}).`
      : "- Mezcla etapas: mayoría atraer, algunas nutrir, máximo una convertir.",
    filters.format ? `- Formato: todas ${filters.format}.` : "- Mezcla reels y carruseles según lo que le sirva a cada ángulo.",
    filters.value_pillar && `- Pilar de valor obligatorio: \`${filters.value_pillar}\`.`,
    filters.hook_type && `- Tipo de gancho obligatorio: \`${filters.hook_type}\`.`,
    filters.script_structure && `- Estructura obligatoria: \`${filters.script_structure}\`.`,
  ]
    .filter(Boolean)
    .join("\n");

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

### Etapas (\`stage\`)
${FUNNEL_STAGES.map((s) => `- \`${s.id}\`: ${s.hint}`).join("\n")}

---

## Tu tarea
Propón **${IDEAS_COUNT} ideas** de contenido para Instagram.

${sourceBlock[source]}
${sourceMaterial?.trim() ? `\n### Material de la fuente (${src.label})\n"""\n${sourceMaterial.trim().slice(0, 6000)}\n"""\n` : ""}
Restricciones:
${constraints}

${previousHooks.length ? `Estos ganchos YA están en el banco; propón ángulos distintos:\n${previousHooks.map((h) => `- ${h}`).join("\n")}\n\n` : ""}Reglas:
- Variedad: no repitas el mismo tipo de gancho más de 2 veces si no es obligatorio.
- Habla al cliente ideal con SUS palabras (las de dolores/deseos), no con jerga técnica.
- Prohibido inventar cifras, casos, clientes o resultados que no estén en el contexto. Si la idea necesita un número que no tienes, deja un hueco entre corchetes para que la marca ponga su dato real: "[N] mensajes", "[X]%".
- Prohibido inventar ofertas: nada de pruebas gratis, descuentos, cupos, garantías o fechas límite que no estén escritos arriba. Si es de convertir, el cierre invita a escribir/agendar, sin condiciones inventadas. Tampoco inventes recursos (plantilla, guía, "link en bio") que la marca no tenga.
- No nombres noticias, lanzamientos ni empresas concretas salvo que vengan en el material de la fuente.
- Ideas que la marca pueda grabar esta semana: concretas, filmables, sin producción imposible.
- \`hook\`: la primera frase tal como se diría, máximo 14 palabras.
- \`angle\`: el ángulo en máximo 8 palabras.
- \`brief\`: 2-3 oraciones: de qué trata, qué dolor/deseo/dato usa y a qué invita el cierre. Es lo que se le pasa al guionista.
- \`why\`: por qué funciona para ESTE cliente ideal, máximo 18 palabras.
- \`pillar_key\` debe ser uno de los keys de los pilares de arriba.

Devuelve ÚNICAMENTE este JSON:
{"ideas": [{"pillar_key": "...", "stage": "atraer|nutrir|convertir", "format": "reel|carousel", "value_pillar": "...", "hook_type": "...", "script_structure": "...", "hook": "...", "angle": "...", "brief": "...", "why": "..."}]}`;
}

export function normalizeStrategyIdeas(
  raw: unknown,
  ctx: { pillarKeys: string[]; source: IdeaSource },
): ContentIdea[] {
  const list = (raw as { ideas?: unknown })?.ideas;
  if (!Array.isArray(list)) return [];
  const s = (v: unknown, max = 1200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const oneOf = (v: unknown, allowed: string[]) => (typeof v === "string" && allowed.includes(v) ? v : null);

  return list
    .map((item, idx) => {
      const i = (item ?? {}) as Record<string, unknown>;
      return {
        id: `new${idx + 1}`,
        pillar_key: oneOf(i.pillar_key, ctx.pillarKeys),
        source: ctx.source,
        stage: isFunnelStage(i.stage) ? i.stage : "atraer",
        format: i.format === "carousel" ? "carousel" : "reel",
        value_pillar: oneOf(i.value_pillar, VALUE_PILLAR_SLUGS),
        hook_type: oneOf(i.hook_type, HOOK_TYPE_SLUGS),
        script_structure: oneOf(i.script_structure, SCRIPT_STRUCTURE_SLUGS),
        hook: s(i.hook, 300),
        angle: s(i.angle, 200) || null,
        brief: s(i.brief),
        why: s(i.why, 300) || null,
      } satisfies ContentIdea;
    })
    .filter((i) => i.hook && i.brief)
    .slice(0, IDEAS_COUNT + 2);
}

// ─── 2. Borrador de estrategia ───────────────────────────────────────────────

export const STRATEGY_DRAFT_SYSTEM = `Eres estratega de marca y contenido para Instagram en LATAM (método Andrea Estratega: pocos pilares, claros, cada uno con un trabajo en el embudo).
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
   - \`stage\`: atraer | nutrir | convertir. Al menos 2 de atraer y 1 de convertir.
   - \`share\`: % del mes; los 5 suman 100. Convertir no pasa de 20%.
   - \`topics\`: 4-6 temas concretos, uno por línea.
   - \`formats\`: los formatos que mejor le quedan.

Reglas:
- Prohibido inventar clientes, casos, cifras o resultados.
- Si el perfil no alcanza para un campo, déjalo en "".

Devuelve ÚNICAMENTE este JSON:
{"avatar": "...", "dolores": "...", "deseos": "...", "objeciones": "...", "transformacion": "...", "diferenciador": "...", "fuentes": "...", "pillars": [{"name": "...", "objective": "...", "stage": "...", "share": 25, "topics": "...", "formats": "..."}]}`;
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
