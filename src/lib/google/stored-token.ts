import type { SupabaseClient } from '@supabase/supabase-js';

/** What to tell an owner when the stored Google connection cannot be used any more. */
export const GOOGLE_RECONNECT_MESSAGE = 'Google connection expired. Open the site page and click Reconnect on the Google Business Profile card.';

/** True for the errors Google returns when an access token is dead or missing. */
export function isGoogleAuthError(message: string): boolean {
  return /invalid authentication credentials|UNAUTHENTICATED|invalid_grant|401/i.test(message);
}

/**
 * Server-side Google access token for a site, with refresh. For background
 * jobs (Inngest) where there is no user session to borrow a provider_token
 * from. Prefers a real GBP connection over a leftover "default" placeholder,
 * then falls back to the organization's connection.
 */
export async function getStoredGoogleToken(
  supabase: SupabaseClient,
  siteId: string
): Promise<string | null> {
  const { data: connections } = await supabase
    .from('social_connections')
    .select('id, access_token, refresh_token, token_expires_at, account_id')
    .eq('site_id', siteId)
    .eq('platform', 'google_business')
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  const connection =
    (connections || []).find((c) => c.account_id && c.account_id !== 'default') ?? connections?.[0];

  if (connection) {
    const fresh = await freshOrRefreshed(connection, async (access_token, expiresAt) => {
      await supabase
        .from('social_connections')
        .update({ access_token, token_expires_at: expiresAt, updated_at: new Date().toISOString() })
        .eq('id', connection.id);
    });
    if (fresh) return fresh;
  }

  // Org-level connection (captured at Job Snaps signup)
  const { data: siteRow } = await supabase.from('sites').select('organization_id').eq('id', siteId).maybeSingle();
  if (!siteRow?.organization_id) return null;
  const { data: orgConn } = await supabase
    .from('org_google_connections')
    .select('id, access_token, refresh_token, token_expires_at')
    .eq('organization_id', siteRow.organization_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!orgConn) return null;
  return freshOrRefreshed(orgConn, async (access_token, expiresAt) => {
    await supabase
      .from('org_google_connections')
      .update({ access_token, token_expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq('id', orgConn.id);
  });
}

async function freshOrRefreshed(
  conn: { access_token: string | null; refresh_token: string | null; token_expires_at: string | null },
  persist: (accessToken: string, expiresAt: string) => Promise<void>
): Promise<string | null> {
  if (conn.token_expires_at && conn.access_token) {
    const bufferMs = 5 * 60 * 1000;
    if (new Date(conn.token_expires_at).getTime() - bufferMs > Date.now()) return conn.access_token;
  }
  // No refresh token: an expired access token is useless, so say so (null) rather
  // than hand back a dead one that fails every call with a cryptic auth error.
  // Only when the expiry is unknown do we try the token we have.
  if (!conn.refresh_token) return conn.token_expires_at ? null : conn.access_token || null;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) return null;
    const { access_token, expires_in } = await res.json();
    await persist(access_token, new Date(Date.now() + expires_in * 1000).toISOString());
    return access_token;
  } catch {
    return null;
  }
}
