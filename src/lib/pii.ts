import crypto from "node:crypto";

/**
 * Field-level PII encryption.
 *
 *   - `encryptPII` produces randomized AES-256-GCM ciphertext: each call
 *     yields a different output for the same plaintext, defeating ciphertext
 *     equality attacks.
 *   - `hashPII` produces a deterministic HMAC-SHA256 — used for unique
 *     constraints and equality lookups (sign-in, dedup) on encrypted fields.
 *   - `tryDecrypt` handles legacy plaintext rows by falling back to the input.
 *
 * The same key is used for encrypt/decrypt and the HMAC. If you ever rotate
 * it, every encrypted row becomes unreadable — plan a re-encryption migration
 * before changing the key.
 */

const ALGO = "aes-256-gcm";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const hex = process.env.PII_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("PII_ENCRYPTION_KEY is not set");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "PII_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)",
    );
  }
  cachedKey = Buffer.from(hex, "hex");
  return cachedKey;
}

export function encryptPII(plaintext: string): string {
  const key = getKey();
  const nonce = crypto.randomBytes(NONCE_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, nonce);
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, ct, tag]).toString("base64");
}

export function decryptPII(ciphertext: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertext, "base64");
  if (buf.length < NONCE_BYTES + TAG_BYTES) {
    throw new Error("ciphertext too short");
  }
  const nonce = buf.subarray(0, NONCE_BYTES);
  const tag = buf.subarray(buf.length - TAG_BYTES);
  const ct = buf.subarray(NONCE_BYTES, buf.length - TAG_BYTES);
  const decipher = crypto.createDecipheriv(ALGO, key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
    "utf8",
  );
}

/**
 * Tries to decrypt a value. If decryption fails (e.g. legacy plaintext data
 * from before Phase 3), returns the input unchanged. This lets us roll out
 * encryption without forcing a one-shot migration.
 */
export function tryDecrypt(maybeCiphertext: string): string {
  try {
    return decryptPII(maybeCiphertext);
  } catch {
    return maybeCiphertext;
  }
}

/** Deterministic HMAC for equality lookups on encrypted fields. */
export function hashPII(plaintext: string): string {
  const key = getKey();
  return crypto
    .createHmac("sha256", key)
    .update(plaintext, "utf8")
    .digest("hex");
}
