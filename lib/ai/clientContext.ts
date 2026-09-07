/**
 * El perfil de la marca, en markdown, listo para meter en un prompt.
 *
 * Lo usan las rutas del estudio (`/api/ai/script`, `/api/ai/copy`). El portal
 * tiene su propia versión en `lib/portal/generate.ts` porque además lee con
 * service role y ahí `notas` NUNCA va.
 *
 * `includeNotes` existe justo por eso: `clients.notas` son apuntes internos
 * sobre la marca ("el dueño tarda en aprobar", "no le gusta el amarillo") y
 * todo lo que entra al prompt puede salir parafraseado en el copy. En el
 * estudio se incluye (es material de trabajo de Paco); fuera del estudio, no.
 *
 * Módulo puro.
 */

export type ClientProfileRow = Record<string, string | null | undefined>;

export function buildClientContext(
  c: ClientProfileRow,
  { includeNotes = true }: { includeNotes?: boolean } = {},
): string {
  return [
    `## Perfil del cliente: ${c.nombre ?? ""}`,
    c.marca && `**Marca:** ${c.marca}`,
    c.que_vende && `**Qué vende:** ${c.que_vende}`,
    c.cliente_ideal && `**Cliente ideal:** ${c.cliente_ideal}`,
    c.nicho && `**Nicho:** ${c.nicho}`,
    c.dolor && `**Dolor principal:** ${c.dolor}`,
    c.deseo && `**Deseo principal:** ${c.deseo}`,
    c.tono && `**Tono de voz:** ${c.tono}`,
    includeNotes && c.notas && `**Notas adicionales:** ${c.notas}`,
  ]
    .filter(Boolean)
    .join("\n");
}
