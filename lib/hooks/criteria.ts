/**
 * Gancho de 3 capas + los 7 criterios del análisis de 1000 ganchos de Andrea
 * Estratega (2026). Fuente de verdad de:
 *   - las capas (`text_overlay` = lo que se lee, `visual` = lo que se ve,
 *     `verbal` = lo que se dice — en `script_hooks` es `hook_text`),
 *   - los criterios del checklist (`HOOK_CRITERIA`) y su puntaje,
 *   - las reglas que se pegan a TODO prompt que escriba ganchos
 *     (`HOOK_RULES_PROMPT`): guiones, ideas de /estrategia y el revisor.
 *
 * Hallazgos que justifican cada regla (videos ganadores): 88% abre con texto en
 * pantalla, 87% se entiende sin audio, 77% muestra un rostro, 73% cámara fija,
 * texto de 8-12 palabras (sweet spot ~8), solo 27% usa audio en tendencia.
 * En negocios/ventas/emprendimiento el gancho lo carga el TEXTO; en cocina,
 * belleza y relaciones lo visual sube a ~44%.
 *
 * Módulo puro: lo usan server actions y componentes.
 */

export type HookCriterionId =
  | "texto_pantalla"
  | "abre_declarando"
  | "camara_fija"
  | "algo_concreto"
  | "sin_audio"
  | "largo_texto"
  | "portador_nicho";

export const HOOK_CRITERIA: { id: HookCriterionId; label: string; hint: string }[] = [
  {
    id: "texto_pantalla",
    label: "Texto gancho en pantalla",
    hint: "Hay un texto en pantalla en los primeros 3 segundos (88% de los ganadores).",
  },
  {
    id: "abre_declarando",
    label: "Abre declarando",
    hint: "Afirmación directa o número desde el primer segundo. Nada de divagar ('hace tiempo…', '¿sabías que…?') ni preguntas débiles.",
  },
  {
    id: "camara_fija",
    label: "Cámara fija, el cuerpo se mueve",
    hint: "Cámara fija y sin cortes en los primeros 3s; el movimiento lo pone la persona (entra al cuadro, gesto), no la edición.",
  },
  {
    id: "algo_concreto",
    label: "Algo concreto en el primer segundo",
    hint: "Un objeto, una acción, un resultado o una escena real que ejemplifica el gancho.",
  },
  {
    id: "sin_audio",
    label: "Se entiende sin sonido",
    hint: "Con el volumen apagado se entiende de qué va (87% de los ganadores). No depende de un audio de moda.",
  },
  {
    id: "largo_texto",
    label: "Texto de 8 a 12 palabras",
    hint: "La primera línea de texto tiene entre 8 y 12 palabras (ideal ~8).",
  },
  {
    id: "portador_nicho",
    label: "Portador correcto para el nicho",
    hint: "En negocios, ventas, marca personal y tecnología manda un claim fuerte en TEXTO; en cocina, belleza, viajes o relaciones pesa más lo VISUAL.",
  },
];

export type HookCheckStatus = "ok" | "falla" | "na";

export type HookCheck = { id: HookCriterionId; status: HookCheckStatus; note: string };

export function isCriterionId(v: unknown): v is HookCriterionId {
  return HOOK_CRITERIA.some((c) => c.id === v);
}

/** Normaliza el checklist que devuelve la IA: siempre los 7, en orden. */
export function normalizeChecks(raw: unknown): HookCheck[] {
  const list = Array.isArray(raw) ? raw : [];
  return HOOK_CRITERIA.map((c) => {
    const found = list.find((x) => (x as { id?: unknown })?.id === c.id) as
      | { status?: unknown; note?: unknown }
      | undefined;
    const status: HookCheckStatus =
      found?.status === "ok" || found?.status === "falla" ? found.status : "na";
    const note = typeof found?.note === "string" ? found.note.trim().slice(0, 200) : "";
    return { id: c.id, status, note };
  });
}

/** Puntaje = criterios que pasan, sobre los evaluables. */
export function scoreChecks(checks: HookCheck[]): { ok: number; total: number } {
  const evaluables = checks.filter((c) => c.status !== "na");
  return { ok: evaluables.filter((c) => c.status === "ok").length, total: evaluables.length };
}

export function wordCount(s: string | null | undefined): number {
  return (s ?? "").trim().split(/\s+/).filter(Boolean).length;
}

/** Reglas que se pegan a cualquier prompt que escriba ganchos. */
export const HOOK_RULES_PROMPT = `## Reglas del gancho (análisis de 1000 videos virales — Andrea Estratega)
Un gancho son los primeros 3 segundos y tiene TRES capas:
- **Texto en pantalla** (lo que se lee): 8 a 12 palabras, idealmente ~8. Es la capa más importante en negocios, ventas, marca personal y tecnología.
- **Visual** (lo que se ve en el primer segundo): algo CONCRETO que ejemplifica el gancho — un objeto en mano, una acción, una pantalla con un resultado, una escena real. Cámara fija; el movimiento lo pone la persona (entra al cuadro, señala, muestra), no la edición.
- **Verbal** (lo que se dice): abre DECLARANDO — una afirmación directa o un número. El número tiene que ser REAL: si no está escrito en el contexto, deja el hueco "[N]" para que la marca ponga su dato; nunca inventes un porcentaje ni una estadística ("el 40% de…"). Prohibido divagar ("hace mucho tiempo…", "mucha gente…", "¿sabías que…?") y prohibidas las preguntas débiles ("¿te pasa?", "¿verdad?").
Además: se tiene que entender sin sonido; la claridad le gana a la creatividad; el gancho vende el siguiente segundo, no el tema completo.`;

/**
 * Los criterios que se pueden medir sin IA se pisan en código: el modelo
 * cuenta mal las palabras (probado: marcó "falla" un texto de 8 palabras).
 * `texto_pantalla` y `largo_texto` dependen solo de que exista el texto y de
 * su largo.
 */
export function withMeasuredChecks(checks: HookCheck[], textOverlay: string | null | undefined): HookCheck[] {
  const words = wordCount(textOverlay);
  return checks.map((c) => {
    if (c.id === "texto_pantalla" && words === 0) return { ...c, status: "falla", note: "No hay texto en pantalla" };
    if (c.id === "largo_texto") {
      const ok = words >= 8 && words <= 12;
      return { ...c, status: ok ? "ok" : "falla", note: words === 0 ? "Sin texto" : `${words} palabras` };
    }
    return c;
  });
}
