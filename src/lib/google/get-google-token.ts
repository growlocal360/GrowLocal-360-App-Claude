/**
 * Retrieves a valid Google OAuth access token for a site.
 *
 * Priority:
 * 1. Fresh session provider_token (if user just authenticated)
 * 2. Stored token from social_connections table
 * 3. Refresh using stored refresh_token if access token expired
 *
 * Returns null if no token is available (user needs to reconnect Google).
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function getGoogleToken(siteId: string): Promise<string | null> {
  // 1. Try session provider_token first (fresh after OAuth)
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.provider_token) {
    return session.provider_token;
  }

  // 2. Fall back to stored token in social_connections
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from('social_connections')
    .select('access_token, refresh_token, token_expires_at')
    .eq('site_id', siteId)
    .eq('platform', 'google_business')
    .eq('is_active', true)
    .single();

  if (!connection) return null;

  // 3. Check if stored token is still valid (with 5-minute buffer)
  if (connection.token_expires_at) {
    const expiresAt = new Date(connection.token_expires_at);
    const now = new Date();
    const bufferMs = 5 * 60 * 1000; // 5 minutes

    if (expiresAt.getTime() - bufferMs > now.getTime()) {
      // Token still valid
      return connection.access_token;
    }
  }

  // 4. Token expired — try to refresh
  if (connection.refresh_token) {
    try {
      const refreshed = await refreshGoogleToken(connection.refresh_token);
      if (refreshed) {
        // Update stored token
        await admin
          .from('social_connections')
          .update({
            access_token: refreshed.access_token,
            token_expires_at: new Date(
              Date.now() + refreshed.expires_in * 1000
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('site_id', siteId)
          .eq('platform', 'google_business');

        return refreshed.access_token;
      }
    } catch (error) {
      console.error('Google token refresh failed:', error);
    }
  }

  // No valid token available
  return null;
}

/**
 * Refreshes a Google access token using the refresh token.
 */
async function refreshGoogleToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET env vars');
    return null;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('Google token refresh error:', error);
    return null;
  }

  return response.json();
}
