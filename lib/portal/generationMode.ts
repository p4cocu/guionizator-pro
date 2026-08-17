/**
 * Modo de generación con IA del portal (Fase D, etapa 6).
 *
 * Fuente de verdad única de los valores que pueden vivir en
 * `clients.ai_generation_mode`. Deben coincidir EXACTO con el `CHECK
 * constraint` `clients_ai_generation_mode_check` (migración
 * `0009_portal_generacion_ia.sql`):
 *
 *   check (ai_generation_mode in ('simple', 'completo'))
 *
 * ⚠️ REGLA DURA (CLAUDE.md): agregar, renombrar o borrar un valor de acá OBLIGA
 * a entregar en el MISMO cambio el `ALTER TABLE clients DROP/ADD CONSTRAINT`
 * correspondiente y a actualizar la tabla de columnas tipo-enum de `CLAUDE.md`.
 * Si no, el primer `update` con el valor nuevo revienta con error de servidor.
 * Misma disciplina que `lib/competencia/taxonomy.ts` y `lib/portal/features.ts`.
 *
 * Este módulo es puro (no importa Supabase): lo usan tanto el panel de Paco
 * (`"use client"`) como el servidor.
 */

/** Unión cerrada: renombrar un valor sin tocar el CHECK rompe el build, no producción. */
export type PortalGenerationMode = "simple" | "completo";

export const DEFAULT_GENERATION_MODE: PortalGenerationMode = "simple";

export type GenerationModeOption = {
  value: PortalGenerationMode;
  label: string;
  /** Qué pasos ve el cliente. Es el texto de ayuda del selector. */
  description: string;
  /** Los pasos, en orden, para dibujar el indicador de la pantalla del portal. */
  steps: string[];
};

export const GENERATION_MODES: GenerationModeOption[] = [
  {
    value: "simple",
    label: "Simple",
    description:
      "El cliente escribe el brief y recibe el guion. Una sola llamada a la IA: la estructura la elige ella.",
    steps: ["Brief", "Guion"],
  },
  {
    value: "completo",
    label: "Completo",
    description:
      "El mismo flujo que usas tú: brief → Big Idea → elegir entre 3 estructuras → guion. Más control, más pasos.",
    steps: ["Brief", "Big Idea", "Estructura", "Guion"],
  },
];

const BY_VALUE = new Map<string, GenerationModeOption>(
  GENERATION_MODES.map((m) => [m.value, m]),
);

/**
 * Chequeo de compilación: el array cubre EXACTAMENTE la unión. Si se agrega un
 * valor al tipo y se olvida la fila (o al revés), esto no compila.
 */
const _coverage: Record<PortalGenerationMode, true> = { simple: true, completo: true };
void _coverage;

export function isGenerationMode(value: string): value is PortalGenerationMode {
  return BY_VALUE.has(value);
}

/**
 * Único camino de escritura: lo desconocido cae al default en vez de viajar a
 * Postgres y violar el CHECK. Vale también para leer una fila vieja.
 */
export function sanitizeGenerationMode(
  value: string | null | undefined,
): PortalGenerationMode {
  return value && isGenerationMode(value) ? value : DEFAULT_GENERATION_MODE;
}

export function generationModeLabel(value: string): string {
  return BY_VALUE.get(value)?.label ?? value;
}

export function generationModeSteps(value: string): string[] {
  return BY_VALUE.get(value)?.steps ?? GENERATION_MODES[0].steps;
}
