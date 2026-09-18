/**
 * Etiquetas y colores compartidos por las pantallas de Guiones.
 *
 * Viven acá y no en `page.tsx` porque los consumen tres lugares: la lista
 * principal (`/guiones`), la lista de hechos (`/guiones/hechos`) y el detalle
 * (`ScriptDetailClient`, que es un componente de cliente). Importarlos desde
 * una página server arrastraba esa página entera al bundle del cliente.
 *
 * ⚠️ Los valores de `STATUS_LABELS` espejan el `CHECK` de `scripts.status`
 * (ver CLAUDE.md): tocar uno exige el `ALTER TABLE` en la misma entrega.
 */

import type { RecordingType } from "./actions";

export const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  preproduccion: "Preproducción",
  produccion: "En producción",
  listo: "Listo",
  publicado: "Publicado",
  baul: "Baúl",
};

export const CARD_BORDER_BY_STATUS: Record<string, string> = {
  idea: "var(--glass-border)",
  preproduccion: "rgba(134, 220, 174, 0.45)",
  produccion: "rgba(255, 210, 58, 0.45)",
  listo: "rgba(255, 235, 150, 0.5)",
  publicado: "transparent",
  baul: "rgba(157, 142, 201, 0.45)",
};

export const RECORDING_TYPE_LABELS: Record<RecordingType, string> = {
  voz_off: "🎙 Voz en off",
  actuacion: "🎭 Actuación",
  actuacion_compu: "🎭💻 Actuación + compu",
  actuacion_cel: "🎭📱 Actuación + cel",
  compu: "💻 Compu",
  cel: "📱 Cel",
};

export const RECORDING_TYPE_COLORS: Record<
  RecordingType,
  { bg: string; color: string; border: string }
> = {
  voz_off:         { bg: "rgba(99,179,237,0.14)",  color: "#63b3ed", border: "rgba(99,179,237,0.3)" },
  actuacion:       { bg: "rgba(255,210,58,0.14)",  color: "var(--signal)", border: "rgba(255,210,58,0.3)" },
  actuacion_compu: { bg: "rgba(255,111,97,0.14)",  color: "var(--flare)", border: "rgba(255,111,97,0.3)" },
  actuacion_cel:   { bg: "rgba(183,148,244,0.14)", color: "#b794f4", border: "rgba(183,148,244,0.3)" },
  compu:           { bg: "rgba(0,159,125,0.14)",   color: "var(--emerald)", border: "rgba(0,159,125,0.3)" },
  cel:             { bg: "rgba(0,159,125,0.08)",   color: "var(--emerald)", border: "rgba(0,159,125,0.2)" },
};
