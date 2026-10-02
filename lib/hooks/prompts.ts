/**
 * Los dos prompts de ganchos de 3 capas (migración `0018`):
 *
 *   1. **Generar** — 3 opciones de gancho para un guion ya escrito, cada una
 *      con texto en pantalla + visual + verbal, su tipo (taxonomía de Andrea)
 *      y el checklist de 7 criterios. Panel "Ganchos" de `/guiones/[id]`.
 *   2. **Revisar** — califica un gancho escrito a mano (o del baúl) con los
 *      mismos 7 criterios y propone una versión mejorada. Panel "Ganchos" y
 *      `/ganchos`.
 *
 * Módulo puro: prompts + normalizadores que nunca lanzan.
 */

import { HOOK_TYPES, HOOK_TYPE_SLUGS } from "@/lib/competencia/taxonomy";
import { HOOK_CRITERIA, HOOK_RULES_PROMPT, normalizeChecks, withMeasuredChecks, type HookCheck } from "./criteria";

const TUTEO_RULE =
  "Escribes en español latinoamericano con TUTEO (tú, quieres, tienes). Nada de voseo (vos, querés, tenés).";

export type LayeredHook = {
  verbal: string;
  text_overlay: string;
  visual: string;
  hook_type: string | null;
  why: string;
  checks: HookCheck[];
};

const criteriaList = HOOK_CRITERIA.map((c) => `- \`${c.id}\`: ${c.label} — ${c.hint}`).join("\n");
const hookTypeList = HOOK_TYPES.map((t) => `- \`${t.slug}\` (${t.label}): ${t.definition}`).join("\n");

const CHECKS_SHAPE = `"checks": [{"id": "texto_pantalla", "status": "ok|falla|na", "note": "máx 12 palabras"}, …los 7 criterios en orden]`;

// ─── 1. Generar 3 ganchos para un guion ──────────────────────────────────────

export const LAYERED_HOOKS_SYSTEM = `Eres director creativo de Reels y carruseles para Instagram en LATAM, formado en el método de Andrea Estratega. Escribes ganchos que se ENTIENDEN en un segundo y sin sonido.
${TUTEO_RULE}
Siempre devuelves un JSON válido con la estructura indicada, sin markdown y sin explicaciones.`;

export function buildLayeredHooksPrompt(input: {
  brandContext: string;
  type: "reel" | "carousel";
  brief: string;
  scriptText: string;
}): string {
  const { brandContext, type, brief, scriptText } = input;
  const piece =
    type === "carousel"
      ? "un CARRUSEL. El 'texto en pantalla' es el titular del slide 1; el 'visual' es la imagen/diseño del slide 1; el 'verbal' es la primera línea del caption."
      : "un REEL. El 'verbal' reemplaza la primera frase de la voz en off y tiene que empalmar con lo que sigue del guion.";

  return `${brandContext}

---

${HOOK_RULES_PROMPT}

### Tipos de gancho (\`hook_type\`)
${hookTypeList}

### Checklist (7 criterios)
${criteriaList}

---

## La pieza
Es ${piece}

**Brief:** ${brief}

**Guion:**
"""
${scriptText.slice(0, 5000)}
"""

## Tu tarea
Escribe **3 ganchos distintos** para esta pieza, cada uno de un \`hook_type\` diferente. Cada gancho cumple la promesa que el guion resuelve: no prometas algo que el guion no entrega.

Para cada uno:
- \`text_overlay\`: el texto en pantalla, 8-12 palabras.
- \`visual\`: qué se ve en el PRIMER segundo, filmable por una persona con su celular (objeto, acción, pantalla, escena). Máximo 25 palabras.
- \`verbal\`: la primera frase dicha, máximo 18 palabras, abre declarando.
- \`why\`: por qué detiene el scroll de ESTE cliente ideal, máximo 15 palabras.
- \`checks\`: evalúa tu propio gancho con los 7 criterios. Sé honesto: si algo falla, márcalo "falla". Usa "na" solo si de verdad no se puede saber.

Prohibido inventar cifras o resultados que no estén en el guion o el brief.

Devuelve ÚNICAMENTE este JSON:
{"hooks": [{"text_overlay": "...", "visual": "...", "verbal": "...", "hook_type": "...", "why": "...", ${CHECKS_SHAPE}}]}`;
}

export function normalizeLayeredHooks(raw: unknown): LayeredHook[] {
  const list = (raw as { hooks?: unknown })?.hooks;
  if (!Array.isArray(list)) return [];
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  return list
    .map((item) => {
      const h = (item ?? {}) as Record<string, unknown>;
      return {
        verbal: s(h.verbal, 300),
        text_overlay: s(h.text_overlay, 200),
        visual: s(h.visual, 300),
        hook_type: typeof h.hook_type === "string" && HOOK_TYPE_SLUGS.includes(h.hook_type) ? h.hook_type : null,
        why: s(h.why, 200),
        checks: withMeasuredChecks(normalizeChecks(h.checks), s(h.text_overlay, 200)),
      };
    })
    .filter((h) => h.verbal || h.text_overlay)
    .slice(0, 3);
}

// ─── 2. Revisar un gancho ────────────────────────────────────────────────────

export const HOOK_REVIEW_SYSTEM = `Eres un editor exigente de ganchos para Reels de Instagram, formado en el análisis de 1000 ganchos virales de Andrea Estratega. Calificas con criterio, sin adular, y reescribes para que pase los 7 criterios.
${TUTEO_RULE}
Siempre devuelves un JSON válido con la estructura indicada, sin markdown y sin explicaciones.`;

export type HookReview = {
  checks: HookCheck[];
  verdict: string;
  improved: Omit<LayeredHook, "checks" | "why"> & { why: string };
};

export function buildHookReviewPrompt(input: {
  brandContext: string | null;
  verbal: string;
  textOverlay: string | null;
  visual: string | null;
  context: string | null;
}): string {
  const { brandContext, verbal, textOverlay, visual, context } = input;
  return `${brandContext ? `${brandContext}\n\n---\n\n` : ""}${HOOK_RULES_PROMPT}

### Checklist (7 criterios)
${criteriaList}

### Tipos de gancho (\`hook_type\`)
${hookTypeList}

---

## El gancho a revisar
- Verbal (lo que se dice): ${verbal ? `"${verbal}"` : "(no lo escribió)"}
- Texto en pantalla: ${textOverlay ? `"${textOverlay}"` : "(no lo escribió)"}
- Visual del primer segundo: ${visual ? visual : "(no lo describió)"}
${context ? `\nDe qué trata el video: ${context.slice(0, 2000)}\n` : ""}
## Tu tarea
1. \`checks\`: evalúa los 7 criterios TAL COMO ESTÁ. Si una capa no está escrita, los criterios que dependen de ella son "falla" (no "na"): un gancho sin texto en pantalla falla \`texto_pantalla\` y \`largo_texto\`. Usa "na" solo para lo que de verdad no se puede saber.
2. \`verdict\`: el problema principal en una frase (máx 20 palabras).
3. \`improved\`: reescribe el gancho completo en 3 capas para que pase los 7, conservando la idea y la promesa. Mismas reglas de largo: texto 8-12 palabras, verbal máx 18, visual máx 25.

Prohibido inventar cifras o resultados que no estén en el gancho o el contexto (si hace falta un número, deja "[N]").

Devuelve ÚNICAMENTE este JSON:
{${CHECKS_SHAPE}, "verdict": "...", "improved": {"text_overlay": "...", "visual": "...", "verbal": "...", "hook_type": "...", "why": "..."}}`;
}

/** `originalText` = el texto en pantalla del gancho revisado (para medir largo). */
export function normalizeHookReview(raw: unknown, originalText: string | null): HookReview | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const imp = (r.improved ?? {}) as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const improved = {
    verbal: s(imp.verbal, 300),
    text_overlay: s(imp.text_overlay, 200),
    visual: s(imp.visual, 300),
    hook_type: typeof imp.hook_type === "string" && HOOK_TYPE_SLUGS.includes(imp.hook_type) ? imp.hook_type : null,
    why: s(imp.why, 200),
  };
  if (!improved.verbal && !improved.text_overlay) return null;
  return { checks: withMeasuredChecks(normalizeChecks(r.checks), originalText), verdict: s(r.verdict, 300), improved };
}
