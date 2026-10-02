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

// ─── Etapa del embudo / nivel de consciencia ─────────────────────────────────

export type FunnelStage = "atraer" | "nutrir" | "convertir";

export const FUNNEL_STAGES: { id: FunnelStage; label: string; hint: string }[] = [
  { id: "atraer", label: "Atraer", hint: "Todavía no sabe que tiene el problema: alcance, gente nueva" },
  { id: "nutrir", label: "Nutrir", hint: "Ya lo sabe y compara: confianza, autoridad, prueba" },
  { id: "convertir", label: "Convertir", hint: "Está listo: oferta, proceso, CTA directo" },
];

export function isFunnelStage(v: unknown): v is FunnelStage {
  return v === "atraer" || v === "nutrir" || v === "convertir";
}

// ─── Pilares ─────────────────────────────────────────────────────────────────

export type Pillar = {
  /** Estable: es lo que guarda `content_ideas.pillar_key`. */
  key: string;
  name: string;
  /** Qué hace este pilar por la marca, en una frase. */
  objective: string;
  stage: FunnelStage;
  /** % del contenido del mes que debería ocupar. */
  share: number;
  /** Temas / sub-temas que entran acá, uno por línea. */
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
  pillars: Pillar[];
  updated_at: string | null;
};

export const STRATEGY_COLUMNS =
  "client_id, avatar, dolores, deseos, objeciones, transformacion, diferenciador, fuentes, pillars, updated_at";

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
    out.push({
      key,
      name,
      objective: str(p.objective, 400),
      stage: isFunnelStage(p.stage) ? p.stage : "atraer",
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
  return { ...fields, pillars: sanitizePillars(raw.pillars) };
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
  const pillars = s.pillars
    .map(
      (p) =>
        `- \`${p.key}\` **${p.name}** (${p.stage}, ${p.share}%): ${p.objective}` +
        (p.topics ? `\n  Temas: ${p.topics.replace(/\n+/g, " · ")}` : "") +
        (p.formats ? `\n  Formatos: ${p.formats}` : ""),
    )
    .join("\n");
  return [
    "## Estrategia de contenido de la marca",
    fields,
    pillars && `### Pilares de contenido\n${pillars}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ─── Fuentes del generador de ideas ──────────────────────────────────────────

export type IdeaSource = "matriz" | "tendencias" | "build" | "preguntas" | "competencia";

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
];

export function isIdeaSource(v: unknown): v is IdeaSource {
  return IDEA_SOURCES.some((s) => s.id === v);
}

// ─── Ideas ───────────────────────────────────────────────────────────────────

export type ContentIdea = {
  id: string;
  pillar_key: string | null;
  source: IdeaSource | null;
  stage: FunnelStage;
  format: "reel" | "carousel";
  value_pillar: string | null;
  hook_type: string | null;
  script_structure: string | null;
  hook: string;
  angle: string | null;
  brief: string;
  why: string | null;
  used_at?: string | null;
  created_at?: string;
};

export const IDEA_COLUMNS =
  "id, pillar_key, source, stage, format, value_pillar, hook_type, script_structure, hook, angle, brief, why, used_at, created_at";
