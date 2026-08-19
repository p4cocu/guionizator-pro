/**
 * Recuperación de contraseña (etapa 9). Módulo **puro**: solo constantes, para
 * que lo puedan importar el route handler de `/auth/callback`, la página y la
 * server action sin arrastrarse nada entre ellos.
 *
 * Vive acá y no en `app/nueva-contrasena/actions.ts` porque en un módulo
 * `"use server"` solo se pueden exportar funciones async: un `export const`
 * rompe el build.
 */

/** Cookie que habilita `/nueva-contrasena`. La pone `/auth/callback`. */
export const RECOVERY_COOKIE = "gz_pwd_recovery";

/** Ruta a la que apuntan los links de recuperación, vía `/auth/callback?next=`. */
export const RECOVERY_PATH = "/nueva-contrasena";

/** Cuánto vale la cookie. Corto a propósito: es para usarla en el momento. */
export const RECOVERY_COOKIE_MAX_AGE = 15 * 60;
