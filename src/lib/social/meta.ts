import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Meta Graph API: Facebook Login, Page listing, Page + Instagram publishing.
 *
 * One Meta app (META_APP_ID / META_APP_SECRET) serves every site. A business
 * owner signs in with Facebook once; we keep a Page access token per Page
 * (never expires when minted from a long-lived user token) and the Instagram
 * Business account linked to that Page publishes with the same token.
 *
 * In Development mode only people with a role on the Meta app can connect;
 * App Review for pages_manage_posts + instagram_content_publish unlocks Live.
 */

const VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const GRAPH = `https://graph.facebook.com/${VERSION}`;

/** Minimum set for reading Pages and posting to Page + linked Instagram account. */
export const META_SCOPES = (process.env.META_SCOPES || 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export function metaConfigured(): boolean {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

function appId(): string {
  const v = process.env.META_APP_ID;
  if (!v) throw new Error('META_APP_ID is not set');
  return v;
}
function appSecret(): string {
  const v = process.env.META_APP_SECRET;
  if (!v) throw new Error('META_APP_SECRET is not set');
  return v;
}

export function metaRedirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.growlocal360.com').replace(/\/+$/, '');
  return `${base}/api/social/meta/callback`;
}

// ── OAuth ───────────────────────────────────────────────────────────────────

/** Facebook Login dialog URL. With META_LOGIN_CONFIG_ID set, uses Facebook Login for Business (config picks the permissions). */
export function metaAuthUrl(state: string): string {
  const p = new URLSearchParams({ client_id: appId(), redirect_uri: metaRedirectUri(), state, response_type: 'code' });
  const configId = process.env.META_LOGIN_CONFIG_ID;
  if (configId) {
    p.set('config_id', configId);
    p.set('override_default_response_type', 'true');
  } else {
    p.set('scope', META_SCOPES.join(','));
  }
  return `https://www.facebook.com/${VERSION}/dialog/oauth?${p.toString()}`;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export interface MetaState { siteId: string; userId: string; next: string; ts: number }

/** HMAC-signed OAuth state so the callback can trust the site/user it came from. */
export function signState(state: MetaState): string {
  const payload = b64url(Buffer.from(JSON.stringify(state)));
  const sig = b64url(createHmac('sha256', appSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function readState(raw: string | null, maxAgeMs = 15 * 60 * 1000): MetaState | null {
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  const expected = b64url(createHmac('sha256', appSecret()).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const state = JSON.parse(fromB64url(payload).toString('utf8')) as MetaState;
    if (!state.siteId || !state.userId || typeof state.ts !== 'number') return null;
    if (Date.now() - state.ts > maxAgeMs) return null;
    return state;
  } catch {
    return null;
  }
}

interface GraphError { error?: { message?: string; type?: string; code?: number; error_subcode?: number; error_user_msg?: string } }

async function graph<T>(path: string, init: { method?: 'GET' | 'POST' | 'DELETE'; params?: Record<string, string>; token?: string } = {}): Promise<T> {
  const params = new URLSearchParams(init.params || {});
  if (init.token) params.set('access_token', init.token);
  const method = init.method || 'GET';
  const url = method === 'GET' ? `${GRAPH}${path}?${params.toString()}` : `${GRAPH}${path}`;
  const res = await fetch(url, {
    method,
    ...(method === 'GET' ? {} : { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() }),
  });
  const json = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || json.error) {
    const e = json.error;
    const msg = e?.error_user_msg || e?.message || `Meta HTTP ${res.status}`;
    const err = new Error(`Meta: ${msg}`) as Error & { code?: number; subcode?: number };
    err.code = e?.code;
    err.subcode = e?.error_subcode;
    throw err;
  }
  return json;
}

/** Code → short-lived user token → long-lived (about 60 days) user token. */
export async function exchangeCode(code: string): Promise<{ accessToken: string; expiresAt: string | null }> {
  const short = await graph<{ access_token: string }>('/oauth/access_token', {
    params: { client_id: appId(), client_secret: appSecret(), redirect_uri: metaRedirectUri(), code },
  });
  const long = await graph<{ access_token: string; expires_in?: number }>('/oauth/access_token', {
    params: { grant_type: 'fb_exchange_token', client_id: appId(), client_secret: appSecret(), fb_exchange_token: short.access_token },
  });
  return {
    accessToken: long.access_token,
    expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null,
  };
}

export interface MetaPage {
  id: string;
  name: string;
  accessToken: string;
  picture: string | null;
  instagram: { id: string; username: string; picture: string | null } | null;
}

export async function metaUser(userToken: string): Promise<{ id: string; name: string }> {
  return graph<{ id: string; name: string }>('/me', { params: { fields: 'id,name' }, token: userToken });
}

/** Pages this user manages, each with its Page token and linked Instagram Business account. */
export async function listPages(userToken: string): Promise<MetaPage[]> {
  type Row = {
    id: string; name: string; access_token: string;
    picture?: { data?: { url?: string } };
    instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
  };
  const out: MetaPage[] = [];
  let url: string | null = '/me/accounts';
  let params: Record<string, string> | undefined = { fields: 'id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}', limit: '100' };
  for (let i = 0; i < 5 && url; i++) {
    const res: { data?: Row[]; paging?: { next?: string } } = params
      ? await graph<{ data?: Row[]; paging?: { next?: string } }>(url, { params, token: userToken })
      : await (async () => { const r = await fetch(url as string); return (await r.json()) as { data?: Row[]; paging?: { next?: string } }; })();
    for (const p of res.data || []) {
      out.push({
        id: p.id,
        name: p.name,
        accessToken: p.access_token,
        picture: p.picture?.data?.url || null,
        instagram: p.instagram_business_account
          ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username || '', picture: p.instagram_business_account.profile_picture_url || null }
          : null,
      });
    }
    url = res.paging?.next || null;
    params = undefined;
  }
  return out;
}

// ── Publishing ──────────────────────────────────────────────────────────────

export interface PublishInput { message: string; link?: string | null; imageUrls: string[] }
export interface PublishOutput { id: string; url: string | null }

/** Post to a Facebook Page: text + link, one photo with caption, or a multi-photo post. */
export async function publishToPage(pageId: string, pageToken: string, input: PublishInput): Promise<PublishOutput> {
  const images = input.imageUrls.filter(Boolean);
  if (images.length === 0) {
    const r = await graph<{ id: string }>(`/${pageId}/feed`, { method: 'POST', token: pageToken, params: { message: input.message, ...(input.link ? { link: input.link } : {}) } });
    return { id: r.id, url: `https://www.facebook.com/${r.id}` };
  }
  const caption = input.link ? `${input.message}\n\n${input.link}` : input.message;
  if (images.length === 1) {
    const r = await graph<{ id: string; post_id?: string }>(`/${pageId}/photos`, { method: 'POST', token: pageToken, params: { url: images[0], caption } });
    const id = r.post_id || r.id;
    return { id, url: `https://www.facebook.com/${id}` };
  }
  const ids: string[] = [];
  for (const url of images.slice(0, 10)) {
    const r = await graph<{ id: string }>(`/${pageId}/photos`, { method: 'POST', token: pageToken, params: { url, published: 'false' } });
    ids.push(r.id);
  }
  const params: Record<string, string> = { message: caption };
  ids.forEach((id, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
  const r = await graph<{ id: string }>(`/${pageId}/feed`, { method: 'POST', token: pageToken, params });
  return { id: r.id, url: `https://www.facebook.com/${r.id}` };
}

async function waitForContainer(creationId: string, token: string): Promise<void> {
  for (let i = 0; i < 15; i++) {
    const r = await graph<{ status_code?: string; status?: string }>(`/${creationId}`, { params: { fields: 'status_code,status' }, token });
    if (r.status_code === 'FINISHED') return;
    if (r.status_code === 'ERROR' || r.status_code === 'EXPIRED') throw new Error(`Meta: Instagram could not process the image (${r.status || r.status_code})`);
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error('Meta: Instagram took too long to process the image');
}

/** Publish a single image or a carousel (2–10 images) to an Instagram Business account. Images must be public JPEGs. */
export async function publishToInstagram(igUserId: string, pageToken: string, input: PublishInput): Promise<PublishOutput> {
  const images = input.imageUrls.filter(Boolean).slice(0, 10);
  if (images.length === 0) throw new Error('Instagram posts need at least one photo');
  let creationId: string;
  if (images.length === 1) {
    const r = await graph<{ id: string }>(`/${igUserId}/media`, { method: 'POST', token: pageToken, params: { image_url: images[0], caption: input.message } });
    creationId = r.id;
  } else {
    const children: string[] = [];
    for (const url of images) {
      const r = await graph<{ id: string }>(`/${igUserId}/media`, { method: 'POST', token: pageToken, params: { image_url: url, is_carousel_item: 'true' } });
      children.push(r.id);
    }
    for (const id of children) await waitForContainer(id, pageToken);
    const r = await graph<{ id: string }>(`/${igUserId}/media`, { method: 'POST', token: pageToken, params: { media_type: 'CAROUSEL', children: children.join(','), caption: input.message } });
    creationId = r.id;
  }
  await waitForContainer(creationId, pageToken);
  const pub = await graph<{ id: string }>(`/${igUserId}/media_publish`, { method: 'POST', token: pageToken, params: { creation_id: creationId } });
  let url: string | null = null;
  try {
    const info = await graph<{ permalink?: string }>(`/${pub.id}`, { params: { fields: 'permalink' }, token: pageToken });
    url = info.permalink || null;
  } catch { /* permalink is cosmetic */ }
  return { id: pub.id, url };
}

// ── Callbacks from Meta (deauthorize, data deletion) ────────────────────────

/** Verify and decode Meta's `signed_request` (base64url signature . base64url JSON). */
export function parseSignedRequest(signedRequest: string | null | undefined): { user_id?: string; algorithm?: string; issued_at?: number } | null {
  if (!signedRequest) return null;
  const [sig, payload] = signedRequest.split('.', 2);
  if (!sig || !payload) return null;
  const expected = createHmac('sha256', appSecret()).update(payload).digest();
  const given = fromB64url(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(fromB64url(payload).toString('utf8'));
  } catch {
    return null;
  }
}

/** True when the error means the token is dead and the owner must reconnect. */
export function isMetaAuthError(err: unknown): boolean {
  const e = err as { code?: number; subcode?: number; message?: string } | null;
  if (!e) return false;
  if (e.code === 190 || e.code === 102) return true;
  if (e.code === 10 || (typeof e.code === 'number' && e.code >= 200 && e.code <= 299)) return true;
  return /session has expired|access token|permission/i.test(e.message || '');
}

export const META_RECONNECT_MESSAGE = 'Facebook access has expired or was revoked. Reconnect Facebook under Automation.';
