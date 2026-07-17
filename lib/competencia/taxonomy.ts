/**
 * Taxonomía de clasificación de contenido de competencia.
 *
 * Fuente de verdad única para las 3 dimensiones con las que se etiqueta cada
 * post transcrito: tipo de gancho verbal, estructura de guion y pilar de valor.
 * Las definiciones están destiladas de los playbooks de Andrea Estratega
 * (Fórmula 100K: "Playbook Ganchos", "Estructuras de Guion", "Estructura para
 * aportar Valor"). Los `slug` DEBEN coincidir con el `CHECK constraint` de las
 * columnas `hook_type` / `script_structure` / `value_pillar` en `competitor_posts`.
 *
 * Se consume en dos lugares:
 *  - El prompt del clasificador (`classifyPost` en actions.ts) arma las
 *    instrucciones a partir de estas definiciones.
 *  - La UI (badges en las tarjetas + subvista de Análisis) usa `label` y `color`.
 */

export type TaxonomyItem = {
  slug: string;
  label: string;
  /** Definición corta para que la IA acierte al clasificar. */
  definition: string;
  /** Ejemplo textual representativo. */
  example: string;
  /** Color de acento para el badge/gráfica (var CSS o hex). */
  color: string;
};

// ── Tipo de gancho verbal (primeros ~3 s) ────────────────────────────────────
// Basado en "Playbook Ganchos" → Clasificación de hooks por emoción + los 12 moldes.
export const HOOK_TYPES: TaxonomyItem[] = [
  {
    slug: "resultado",
    label: "De resultado",
    definition:
      "Abre mostrando un logro, transformación o promesa de resultado concreto (autoridad / fórmula de éxito). Suele usar cifras, antes/después o 'así conseguí X'.",
    example: "“Así conseguí 100,000 seguidores sin gastar en publicidad.”",
    color: "#34d399",
  },
  {
    slug: "vacio_info",
    label: "Vacío de información",
    definition:
      "Crea una brecha de curiosidad: insinúa una revelación sin darla, prometiendo que lo importante viene si te quedas. 'Lo que nunca te dijeron sobre…'.",
    example: "“Nadie te dijo esto sobre cómo funciona el algoritmo…”",
    color: "#60a5fa",
  },
  {
    slug: "error",
    label: "De error",
    definition:
      "Señala un error que la audiencia está cometiendo (o que costó caro) y promete corregirlo. Activa miedo/urgencia a través de la equivocación.",
    example: "“El error que mata tus ventas y ni lo notas.”",
    color: "#f59e0b",
  },
  {
    slug: "controversia",
    label: "De controversia",
    definition:
      "Afirmación polémica o de debate que desafía una creencia común y busca polarizar / generar discusión.",
    example: "“Android es superior al iPhone. Te explico por qué.”",
    color: "#f472b6",
  },
  {
    slug: "dolor_comun",
    label: "Dolor común",
    definition:
      "Nombra un dolor, síntoma o frustración compartida por la audiencia para generar empatía e identificación ('¿te pasa que…?').",
    example: "“¿Trabajas 10 horas y sigues sin ver resultados? No es tu culpa.”",
    color: "#fb7185",
  },
  {
    slug: "filtrante",
    label: "Filtrante (tribu)",
    definition:
      "Filtra a un avatar específico llamándolo directo ('señal de tribu'), para que quien pertenece sienta que el contenido es para él.",
    example: "“Fundadores que odian bailar frente a la cámara: esto es para ustedes.”",
    color: "#a78bfa",
  },
  {
    slug: "negativo",
    label: "Negativo / prohibición",
    definition:
      "Enmarca en negativo: prohibición, advertencia o CTA invertida ('no hagas', 'deja de', 'si sigues así…'). Empuja por evitación de pérdida.",
    example: "“Deja de publicar así o vas a perder a tu mejor audiencia.”",
    color: "#f87171",
  },
];

// ── Estructura de guion ──────────────────────────────────────────────────────
// Basado en "Estructuras de Guion" + "Estructura para aportar Valor".
export const SCRIPT_STRUCTURES: TaxonomyItem[] = [
  {
    slug: "how_to",
    label: "How-to / Tutorial",
    definition:
      "Enseña a hacer algo paso a paso. Gancho con la meta + 1-3 tips accionables secuenciales + promesa del resultado (Regla de 3 / tips accionables).",
    example: "“3 pasos para escribir un hook que retenga en los primeros 3 segundos.”",
    color: "#34d399",
  },
  {
    slug: "golpe_valor",
    label: "Golpe de valor gratis",
    definition:
      "Regala valor accionable de inmediato y sin rodeos (recurso, plantilla, checklist, hack listo para usar). El foco es la utilidad entregada ya, no la narrativa.",
    example: "“Guárdate estos 5 prompts que uso para guionizar en minutos.”",
    color: "#22d3ee",
  },
  {
    slug: "vacio_info",
    label: "Vacío de información",
    definition:
      "Construye toda la pieza sobre una brecha de curiosidad: abre un bucle de información y lo va sosteniendo, revelando la respuesta al final.",
    example: "“Hay una razón por la que tus reels no despegan. Te la digo al final.”",
    color: "#60a5fa",
  },
  {
    slug: "espejo",
    label: "El espejo",
    definition:
      "Refleja al espectador: historia personal o paradoja propia con la que se identifica (neuronas espejo), mostrando una transformación replicable. 'Yo también pensaba así'.",
    example: "“Yo también creía que necesitaba salir en cámara para vender. Me equivoqué.”",
    color: "#a78bfa",
  },
  {
    slug: "controversial",
    label: "Gancho controversial",
    definition:
      "Afirmación controversial + argumento/postura + prueba social + CTA a debatir. Toda la estructura gira en torno a defender una opinión polémica.",
    example: "“Los cursos de marketing son una estafa. Y trabajo en marketing.”",
    color: "#f472b6",
  },
  {
    slug: "momento_wtf",
    label: "El momento WTF",
    definition:
      "Declaración falsa / contraintuitiva que provoca disonancia cognitiva ('¿qué?'), luego la explica y la resuelve con lógica. Rompe el esquema mental de entrada.",
    example: "“Deja de intentar dar valor. En serio.” (y luego lo justifica)",
    color: "#fbbf24",
  },
  {
    slug: "problema_invisible",
    label: "El problema invisible",
    definition:
      "Revela un problema que la audiencia tiene pero no había notado + evidencia/síntomas + solución simple. 'Esto te está pasando y no lo sabes'.",
    example: "“Tu contenido no falla por el algoritmo. Falla por algo que no ves.”",
    color: "#fb923c",
  },
];

// ── Pilar de valor ───────────────────────────────────────────────────────────
export const VALUE_PILLARS: TaxonomyItem[] = [
  {
    slug: "utilidad_practica",
    label: "Utilidad práctica",
    definition:
      "Entrega algo aplicable de inmediato: pasos, hacks, herramientas, plantillas. El espectador sale sabiendo hacer algo.",
    example: "Tutorial, checklist, mini-guía accionable.",
    color: "#34d399",
  },
  {
    slug: "validacion_emocional",
    label: "Validación emocional",
    definition:
      "Conecta desde la emoción y la identidad: valida un sentir, un dolor o una experiencia compartida ('no estás solo', 'no es tu culpa').",
    example: "Historia personal, mensaje de aliento, 'te entiendo'.",
    color: "#fb7185",
  },
  {
    slug: "revelacion",
    label: "Revelación (insight)",
    definition:
      "Aporta un insight o verdad no obvia que cambia la forma de ver algo ('el momento ajá'). Deja pensando.",
    example: "“La razón real por la que compramos no es el precio.”",
    color: "#60a5fa",
  },
  {
    slug: "curaduria",
    label: "Curaduría",
    definition:
      "Recopila y filtra lo mejor de un tema: listas de recursos, herramientas, referencias, ejemplos. El valor está en la selección hecha por ti.",
    example: "“7 cuentas que debes seguir si haces contenido.”",
    color: "#22d3ee",
  },
  {
    slug: "disrupcion",
    label: "Disrupción (anti-consejo)",
    definition:
      "Rompe con la creencia establecida: contrarian, anti-consejo, 'todos dicen X, yo hago lo contrario'. Reposiciona con autoridad diferenciada.",
    example: "“Deja de publicar todos los días. Te está perjudicando.”",
    color: "#f472b6",
  },
  {
    slug: "actualidad",
    label: "Actualidad (curiosidad)",
    definition:
      "Se apoya en lo nuevo, la tendencia o la novedad del momento para generar curiosidad y relevancia inmediata.",
    example: "“Lo nuevo de Instagram que casi nadie está usando aún.”",
    color: "#fbbf24",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

export type ClassificationDimension = "hook_type" | "script_structure" | "value_pillar";

export const DIMENSIONS: { key: ClassificationDimension; title: string; items: TaxonomyItem[] }[] = [
  { key: "hook_type", title: "Tipo de gancho", items: HOOK_TYPES },
  { key: "script_structure", title: "Estructura de guion", items: SCRIPT_STRUCTURES },
  { key: "value_pillar", title: "Pilar de valor", items: VALUE_PILLARS },
];

function toLabelMap(items: TaxonomyItem[]): Record<string, string> {
  return Object.fromEntries(items.map((i) => [i.slug, i.label]));
}
function toColorMap(items: TaxonomyItem[]): Record<string, string> {
  return Object.fromEntries(items.map((i) => [i.slug, i.color]));
}

export const HOOK_TYPE_LABELS = toLabelMap(HOOK_TYPES);
export const SCRIPT_STRUCTURE_LABELS = toLabelMap(SCRIPT_STRUCTURES);
export const VALUE_PILLAR_LABELS = toLabelMap(VALUE_PILLARS);

export const HOOK_TYPE_COLORS = toColorMap(HOOK_TYPES);
export const SCRIPT_STRUCTURE_COLORS = toColorMap(SCRIPT_STRUCTURES);
export const VALUE_PILLAR_COLORS = toColorMap(VALUE_PILLARS);

export const HOOK_TYPE_SLUGS = HOOK_TYPES.map((i) => i.slug);
export const SCRIPT_STRUCTURE_SLUGS = SCRIPT_STRUCTURES.map((i) => i.slug);
export const VALUE_PILLAR_SLUGS = VALUE_PILLARS.map((i) => i.slug);

export function labelFor(dim: ClassificationDimension, slug: string | null): string | null {
  if (!slug) return null;
  const map =
    dim === "hook_type"
      ? HOOK_TYPE_LABELS
      : dim === "script_structure"
        ? SCRIPT_STRUCTURE_LABELS
        : VALUE_PILLAR_LABELS;
  return map[slug] ?? slug;
}

export function colorFor(dim: ClassificationDimension, slug: string | null): string {
  if (!slug) return "var(--border)";
  const map =
    dim === "hook_type"
      ? HOOK_TYPE_COLORS
      : dim === "script_structure"
        ? SCRIPT_STRUCTURE_COLORS
        : VALUE_PILLAR_COLORS;
  return map[slug] ?? "var(--border)";
}

/** Bloque de instrucciones para el prompt del clasificador. */
export function buildTaxonomyPrompt(): string {
  const section = (title: string, items: TaxonomyItem[]) =>
    `${title}:\n` +
    items.map((i) => `- ${i.slug}: ${i.definition} Ej: ${i.example}`).join("\n");

  return [
    section("TIPO DE GANCHO (hook_type) — el gancho verbal de los primeros segundos", HOOK_TYPES),
    section("ESTRUCTURA DE GUION (script_structure) — la arquitectura narrativa de toda la pieza", SCRIPT_STRUCTURES),
    section("PILAR DE VALOR (value_pillar) — qué tipo de valor entrega al espectador", VALUE_PILLARS),
  ].join("\n\n");
}
