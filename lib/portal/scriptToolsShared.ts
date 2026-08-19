/**
 * La parte de Portadas / Copy Expert que puede cruzar al browser (etapa 8).
 *
 * `lib/portal/scriptTools.ts` importa `fs`, el SDK de Anthropic y el service
 * role: si el panel cliente le pidiera aunque sea la lista de plataformas, todo
 * eso terminaría en el bundle del navegador (y el build falla, que es
 * exactamente lo que pasó). Mismo corte que `roles.ts` con `members.ts`.
 *
 * Módulo puro: sin Supabase, sin `fs`, sin IA.
 */

export type PortalCoverIdea = {
  has_character: boolean;
  medium: string;
  subject: string;
  action: string;
  environment: string;
  style_vibe: string;
  technical_specs: string;
  prompt_en: string;
  cover_text: string;
  rationale_es: string;
};

export type PortalScriptCopy = { platform: string; copy: string; hashtags: string };

/** Plataformas que el portal ofrece. YouTube sigue fuera, como en el estudio. */
export const PORTAL_COPY_PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
] as const;

export function isPortalCopyPlatform(value: string): boolean {
  return PORTAL_COPY_PLATFORMS.some((p) => p.id === value);
}
