/**
 * Secciones del portal de cliente (Fase D).
 *
 * Fuente de verdad única de los slugs que pueden vivir en
 * `clients.enabled_features`. Los `slug` DEBEN coincidir EXACTO con el
 * `CHECK constraint` `clients_enabled_features_check` (migración
 * `0006_portal_cliente.sql`):
 *
 *   check (enabled_features <@ array[
 *     'reportes','guiones','calendario','competencia','instagram',
 *     'investigacion','generar_ia'
 *   ]::text[])
 *
 * ⚠️ REGLA DURA (CLAUDE.md): agregar, renombrar o borrar un slug de acá
 * OBLIGA a entregar en el MISMO cambio el `ALTER TABLE clients DROP/ADD
 * CONSTRAINT clients_enabled_features_check` correspondiente. Si no, el primer
 * `update` que use el slug nuevo revienta con error de servidor en runtime.
 * Misma disciplina que `lib/competencia/taxonomy.ts`.
 *
 * Se consume en:
 *  - `app/(app)/clientes/[id]/PortalSection.tsx` — los toggles del panel de Paco.
 *  - `app/(app)/clientes/portalActions.ts` — `sanitizeFeatures` antes de escribir.
 *  - (etapa 4) el layout de `/portal`, para armar el sidebar del cliente.
 *
 * Este módulo es puro: no importa Supabase ni nada de servidor, así que puede
 * usarse desde componentes `"use client"` sin arrastrar secretos.
 */

/**
 * Unión cerrada a propósito: si alguien renombra un slug sin actualizar el
 * CHECK, el error aparece en `tsc` y no en producción.
 */
export type PortalFeatureSlug =
  | "reportes"
  | "guiones"
  | "calendario"
  | "competencia"
  | "instagram"
  | "investigacion"
  | "generar_ia";

export type PortalFeature = {
  slug: PortalFeatureSlug;
  /** Cómo se llama la sección en la UI (la del portal y la del panel). */
  label: string;
  /** Qué ve el cliente si se prende. Es el texto de ayuda del toggle. */
  description: string;
  /**
   * Add-on de pago: nace apagado y tiene tope de uso. Hoy solo `generar_ia`,
   * porque gasta la API key de Anthropic de Paco (a diferencia de Apify, no hay
   * key por cliente).
   */
  paid: boolean;
  /**
   * Ruta dentro de `/portal/[clientId]` que habilita este flag. `null` = todavía
   * no tiene pantalla propia (se resuelve en las etapas 4-6).
   */
  path: string | null;
};

export const PORTAL_FEATURES: PortalFeature[] = [
  {
    slug: "reportes",
    label: "Reportes",
    description:
      "Los reportes de competencia que le generas: plan de grabación, hallazgos y guiones, en .xlsx y .pdf.",
    paid: false,
    path: "reportes",
  },
  {
    slug: "guiones",
    label: "Guiones",
    description:
      "Los guiones de su marca. Puede leerlos, comentarlos y —si su rol es colaborador— editarlos.",
    paid: false,
    path: "guiones",
  },
  {
    slug: "calendario",
    label: "Calendario",
    description: "El calendario de contenido de su marca: qué se publica y cuándo.",
    paid: false,
    path: "calendario",
  },
  {
    slug: "competencia",
    label: "Competencia",
    description:
      "Los posts de sus competidores con métricas y clasificación. Solo lectura: buscar competencia sigue siendo tuyo.",
    paid: false,
    path: "competencia",
  },
  {
    slug: "instagram",
    label: "Instagram",
    description: "Las métricas de la cuenta de Instagram conectada a su marca.",
    paid: false,
    path: "instagram",
  },
  {
    slug: "investigacion",
    label: "Investigación",
    description:
      "El perfil de marca y la investigación que cargaste: qué vende, cliente ideal, dolor, deseo y tono.",
    paid: false,
    path: "investigacion",
  },
  {
    slug: "generar_ia",
    label: "Generación con IA",
    description:
      "Deja que el cliente genere guiones nuevos con IA desde el portal. Gasta tu API key de Anthropic: por eso nace apagado y admite un tope mensual.",
    paid: true,
    path: "generar",
  },
];

/** El add-on de pago vive aparte en la UI del panel. */
export const AI_FEATURE_SLUG: PortalFeatureSlug = "generar_ia";

/** Las secciones incluidas (todo lo que no es add-on de pago). */
export const FREE_PORTAL_FEATURES: PortalFeature[] = PORTAL_FEATURES.filter((f) => !f.paid);

/** Las de pago, hoy solo Generación con IA. */
export const PAID_PORTAL_FEATURES: PortalFeature[] = PORTAL_FEATURES.filter((f) => f.paid);

export const PORTAL_FEATURE_SLUGS: PortalFeatureSlug[] = PORTAL_FEATURES.map((f) => f.slug);

/**
 * Chequeo de compilación: el array de arriba tiene que cubrir EXACTAMENTE la
 * unión `PortalFeatureSlug`. Si se agrega un slug al tipo y se olvida la fila
 * (o al revés), esto no compila.
 */
const _coverage: Record<PortalFeatureSlug, true> = {
  reportes: true,
  guiones: true,
  calendario: true,
  competencia: true,
  instagram: true,
  investigacion: true,
  generar_ia: true,
};
void _coverage;

const BY_SLUG = new Map<string, PortalFeature>(PORTAL_FEATURES.map((f) => [f.slug, f]));

export function isPortalFeatureSlug(value: string): value is PortalFeatureSlug {
  return BY_SLUG.has(value);
}

export function getPortalFeature(slug: string): PortalFeature | null {
  return BY_SLUG.get(slug) ?? null;
}

export function portalFeatureLabel(slug: string): string {
  return BY_SLUG.get(slug)?.label ?? slug;
}

/**
 * Deja el array listo para escribir en `clients.enabled_features`: descarta
 * cualquier valor desconocido, deduplica y ordena en el orden canónico de
 * `PORTAL_FEATURES`.
 *
 * Es el único lugar que garantiza que nunca se mande a Postgres un array que
 * viole `clients_enabled_features_check`. Toda escritura pasa por acá.
 */
export function sanitizeFeatures(input: readonly string[]): PortalFeatureSlug[] {
  const wanted = new Set(input.filter(isPortalFeatureSlug));
  return PORTAL_FEATURE_SLUGS.filter((slug) => wanted.has(slug));
}

/** ¿Esta marca tiene habilitada esta sección? */
export function hasFeature(
  enabled: readonly string[] | null | undefined,
  slug: PortalFeatureSlug,
): boolean {
  return Boolean(enabled?.includes(slug));
}
