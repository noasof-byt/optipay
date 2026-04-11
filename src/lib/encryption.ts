/**
 * AES-256-GCM encryption for PII stored in the database.
 *
 * The key is a 32-byte (64 hex char) value from ENCRYPTION_KEY env var.
 * Every encryption call generates a fresh 12-byte IV and appends the
 * 16-byte auth-tag, producing the stored format:
 *
 *   base64( iv[12] + ciphertext[n] + tag[16] )
 *
 * This means identical plaintexts produce different ciphertexts on every
 * call — safe for card numbers / membership IDs.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LEN    = 12; // bytes — recommended for GCM
const TAG_LEN   = 16; // bytes

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes)"
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string.
 * @returns base64-encoded string containing IV + ciphertext + auth-tag.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv  = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LEN,
  }) as crypto.CipherGCM;

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Layout: [ IV (12) | ciphertext (n) | tag (16) ]
  const payload = Buffer.concat([iv, encrypted, tag]);
  return payload.toString("base64");
}

/**
 * Decrypt a base64 payload produced by `encrypt`.
 * Throws if the auth-tag is invalid (tamper detection).
 */
export function decrypt(encoded: string): string {
  const key     = getKey();
  const payload = Buffer.from(encoded, "base64");

  const iv         = payload.subarray(0, IV_LEN);
  const tag        = payload.subarray(payload.length - TAG_LEN);
  const ciphertext = payload.subarray(IV_LEN, payload.length - TAG_LEN);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LEN,
  }) as crypto.DecipherGCM;
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Returns the last `n` characters of the decrypted value for display hints.
 * Does NOT decrypt the full value — works from the already-decrypted string
 * to avoid double-decryption overhead.
 */
export function lastNChars(plaintext: string, n = 4): string {
  return plaintext.slice(-n);
}
