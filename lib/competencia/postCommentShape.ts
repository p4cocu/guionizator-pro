/**
 * La forma de una nota de competencia y su tope de largo. **Módulo puro**: no
 * importa Supabase ni nada del servidor.
 *
 * ⚠️ Existe separado de `postComments.ts` por una razón concreta, no por orden:
 * ese módulo importa `lib/portal/profiles.ts` → `createServiceClient()`, que es
 * SERVER-ONLY. Las dos pantallas de competencia son `"use client"` y necesitan
 * el tipo y el `maxLength` del textarea; importar un **valor** desde
 * `postComments.ts` arrastraría el cliente de service role al bundle del
 * browser. Los tipos solos se borran al compilar, el `const` no.
 *
 * Mismo patrón que `PASSWORD_MIN` en `lib/portal/profiles.ts`, por el mismo
 * motivo de fondo: dónde vive una constante no es cosmético.
 */

export const MAX_POST_COMMENT_LENGTH = 2000;

export type PostComment = {
  id: string;
  postId: string;
  /**
   * Ya resuelto en el servidor: nombre elegido, o etiqueta de respaldo. La
   * pantalla no tiene que conocer `portal_profiles` ni sus constantes.
   */
  authorLabel: string;
  /** ¿Lo escribió quien está mirando? Para poner "Tú" en vez del nombre. */
  isMine: boolean;
  /** ¿Lo escribió el dueño de la marca? El estudio lo usa para marcar la voz del cliente. */
  isOwner: boolean;
  body: string;
  createdAt: string;
};

/** Las notas de todos los posts de una marca, agrupadas por post. */
export type PostCommentsByPost = Record<string, PostComment[]>;
