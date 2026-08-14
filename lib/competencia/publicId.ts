/**
 * ID público de los posts de competencia (`competitor_posts.public_id`).
 *
 * Código de 6 caracteres pensado para decirse por WhatsApp y escribirse a mano:
 * el cliente dice "cambiame el Q7F2M9" y Paco lo encuentra en /competencia.
 *
 * El alfabeto excluye los pares que se confunden al leer o dictar (0/O y 1/I/L)
 * y **tiene que coincidir con el de la función `gen_competitor_public_id()`**
 * de la migración `0008` — ahí se generan los IDs; acá solo se validan y
 * normalizan los que escribe una persona.
 *
 * Módulo puro (sin Supabase, sin "use server"): lo usan tanto el buscador del
 * cliente como la server action `findPostByPublicId`.
 */

export const PUBLIC_ID_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const PUBLIC_ID_LENGTH = 6;

/**
 * Normaliza lo que una persona pega o teclea: mayúsculas y sin nada que no sea
 * alfanumérico (espacios, `#`, guiones, el `@` de una cuenta).
 */
export function normalizePublicId(input: string): string {
  return input.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/**
 * ¿Es un ID completo y bien formado? Se usa para decidir si vale la pena ir al
 * servidor a buscarlo en las otras marcas: con 2 o 3 letras sueltas, no.
 */
export function looksLikePublicId(value: string): boolean {
  const v = normalizePublicId(value);
  return (
    v.length === PUBLIC_ID_LENGTH &&
    [...v].every((c) => PUBLIC_ID_ALPHABET.includes(c))
  );
}
