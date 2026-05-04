import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiKey } from '@/types/database';

const KEY_PREFIX = 'js_live_';
const RANDOM_BYTES = 24; // 24 bytes → ~32 char base64url

export interface GeneratedKey {
  fullKey: string;     // shown to user ONCE at creation
  keyPrefix: string;   // safe to display in UI list
  keyHash: string;     // stored in DB
}

/**
 * Generate a fresh API key. Returns the full key (show to user once),
 * the prefix (for display), and the SHA-256 hash (stored in DB).
 */
export function generateApiKey(): GeneratedKey {
  const random = randomBytes(RANDOM_BYTES).toString('base64url');
  const fullKey = `${KEY_PREFIX}${random}`;
  const keyPrefix = fullKey.slice(0, KEY_PREFIX.length + 6); // js_live_a8f3k2
  const keyHash = hashApiKey(fullKey);
  return { fullKey, keyPrefix, keyHash };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Look up an API key by its raw value. Returns the key record if active,
 * null if not found or revoked. Updates last_used_at on success.
 */
export async function verifyApiKey(rawKey: string): Promise<ApiKey | null> {
  if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) return null;

  const expectedHash = hashApiKey(rawKey);
  const admin = createAdminClient();

  const { data: key } = await admin
    .from('api_keys')
    .select('*')
    .eq('key_hash', expectedHash)
    .is('revoked_at', null)
    .maybeSingle();

  if (!key) return null;

  // Constant-time double-check (defence-in-depth against query-side bugs)
  const a = Buffer.from(key.key_hash);
  const b = Buffer.from(expectedHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // Best-effort last_used_at update — don't await failure path
  admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', key.id)
    .then(() => {});

  return key as ApiKey;
}

/**
 * Extract API key from request headers. Supports both:
 *   X-API-Key: js_live_xxx
 *   Authorization: Bearer js_live_xxx
 */
export function extractApiKey(headers: Headers): string | null {
  const direct = headers.get('x-api-key');
  if (direct) return direct.trim();

  const auth = headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  return null;
}
