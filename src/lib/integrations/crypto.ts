import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto';

/**
 * Symmetric encryption for third-party integration tokens (HighLevel,
 * Meta, etc.) stored in the database.
 *
 * Algorithm: AES-256-GCM — authenticated encryption, prevents tampering.
 *
 * Key derivation: SHA-256 of INTEGRATION_TOKEN_ENCRYPTION_KEY (any length
 * env var input becomes a fixed 32-byte key). Generate the env value with:
 *
 *     openssl rand -base64 48
 *
 * Stored format: base64( iv (12 bytes) || authTag (16 bytes) || ciphertext )
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'INTEGRATION_TOKEN_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 48` and add it to .env.local + Vercel.'
    );
  }
  // Hash to a 32-byte key — accepts any input length.
  return createHash('sha256').update(raw).digest();
}

export function encrypt(plain: string): string {
  if (!plain) throw new Error('encrypt: plaintext is empty');
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decrypt(payload: string): string {
  if (!payload) throw new Error('decrypt: ciphertext is empty');
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('decrypt: payload too short to be valid');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}
