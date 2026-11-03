import { describe, it, expect, beforeAll } from 'vitest';
import { createHmac } from 'crypto';

beforeAll(() => {
  process.env.META_APP_ID = '123';
  process.env.META_APP_SECRET = 'shh';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
});

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('meta state + signed requests', () => {
  it('round-trips a signed state and rejects tampering', async () => {
    const { signState, readState } = await import('./meta');
    const raw = signState({ siteId: 's1', userId: 'u1', next: '/dashboard/x', ts: Date.now() });
    expect(readState(raw)).toMatchObject({ siteId: 's1', userId: 'u1', next: '/dashboard/x' });
    const [payload, sig] = raw.split('.');
    expect(readState(`${payload}x.${sig}`)).toBeNull();
    expect(readState(null)).toBeNull();
  });
  it('expires old state', async () => {
    const { signState, readState } = await import('./meta');
    expect(readState(signState({ siteId: 's', userId: 'u', next: '/', ts: Date.now() - 60 * 60 * 1000 }))).toBeNull();
  });
  it('verifies a Meta signed_request and rejects a bad signature', async () => {
    const { parseSignedRequest } = await import('./meta');
    const payload = b64url(Buffer.from(JSON.stringify({ user_id: '42', algorithm: 'HMAC-SHA256' })));
    const sig = b64url(createHmac('sha256', 'shh').update(payload).digest());
    expect(parseSignedRequest(`${sig}.${payload}`)).toMatchObject({ user_id: '42' });
    expect(parseSignedRequest(`${b64url(Buffer.from('nope'))}.${payload}`)).toBeNull();
    expect(parseSignedRequest('')).toBeNull();
  });
  it('builds the login URL with scopes, or a config id when set', async () => {
    const { metaAuthUrl } = await import('./meta');
    const u = new URL(metaAuthUrl('st'));
    expect(u.searchParams.get('client_id')).toBe('123');
    expect(u.searchParams.get('redirect_uri')).toBe('https://app.example.com/api/social/meta/callback');
    expect(u.searchParams.get('scope')).toContain('pages_manage_posts');
    process.env.META_LOGIN_CONFIG_ID = 'cfg';
    expect(new URL(metaAuthUrl('st')).searchParams.get('config_id')).toBe('cfg');
    delete process.env.META_LOGIN_CONFIG_ID;
  });
});
