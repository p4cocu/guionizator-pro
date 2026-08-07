/**
 * Cifrado simétrico para secretos de terceros que guardamos en Postgres
 * (hoy: el token de Apify de cada cliente).
 *
 * SERVER-ONLY. Usa AES-256-GCM con `SECRETS_KEY` (32 bytes en base64).
 * GCM además de cifrar autentica: si alguien altera la fila en la base, el
 * descifrado falla en vez de devolver basura.
 *
 * Formato guardado en la columna:  v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
 * El prefijo de versión permite rotar el algoritmo más adelante sin adivinar
 * cómo se cifró cada fila vieja.
 *
 * Generar la clave:  openssl rand -base64 32
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const VERSION = "v1";
const IV_BYTES = 12; // recomendado para GCM

export class SecretsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretsError";
  }
}

function getKey(): Buffer {
  const raw = process.env.SECRETS_KEY;
  if (!raw) {
    throw new SecretsError(
      "Falta SECRETS_KEY en el servidor. Genérala con `openssl rand -base64 32`.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new SecretsError(
      "SECRETS_KEY inválida: debe ser de 32 bytes en base64 (`openssl rand -base64 32`).",
    );
  }
  return key;
}

/** ¿Está configurada la clave? Para avisar en la UI antes de intentar guardar. */
export function isSecretsKeyConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new SecretsError("El secreto guardado tiene un formato desconocido.");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const key = getKey();
  try {
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Caso típico: se cambió SECRETS_KEY después de guardar el secreto.
    throw new SecretsError(
      "No se pudo descifrar el secreto guardado (¿cambió SECRETS_KEY?). Vuelve a guardarlo.",
    );
  }
}

/** Últimos 4 caracteres, para mostrar el token enmascarado sin exponerlo. */
export function lastFour(secret: string): string {
  return secret.trim().slice(-4);
}
