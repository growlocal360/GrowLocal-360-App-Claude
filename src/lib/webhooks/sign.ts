import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Generate a webhook signing secret. Customers store this on their server
 * and use it to verify incoming webhook payloads.
 */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('base64url')}`;
}

/**
 * Compute HMAC-SHA256 signature over `timestamp.body`.
 * Format matches Stripe's webhook signing: "t=<ts>,v1=<sig>"
 */
export function signWebhookPayload(payload: string, secret: string, timestamp: number): string {
  const signedPayload = `${timestamp}.${payload}`;
  const sig = createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

/**
 * Verify a signature header against a payload + secret.
 * Used in customer-side documentation examples and (future) for inbound
 * verification if we ever accept webhooks from external systems.
 */
export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300
): boolean {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k, v];
    })
  );

  const ts = Number(parts.t);
  const provided = parts.v1;
  if (!ts || !provided) return false;
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSeconds) return false;

  const expected = createHmac('sha256', secret)
    .update(`${ts}.${payload}`)
    .digest('hex');

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
