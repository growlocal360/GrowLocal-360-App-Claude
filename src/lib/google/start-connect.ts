import { createClient } from '@/lib/supabase/client';

/**
 * Kicks off the per-site GBP OAuth flow. After Google consent, the callback
 * lands at /oauth2callback?siteId=X&next=<returnPath>, which persists the
 * per-site social_connections row AND upserts the org-level connection so
 * future sites can reuse it without re-authing.
 *
 * Use anywhere we need a one-click "Connect / Reconnect Google Business
 * Profile" action — most notably as a toast Action button after publish-gbp
 * fails with "No GBP location linked."
 */
export async function startGbpConnect(siteId: string, returnPath: string): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes:
        'https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/webmasters.readonly',
      redirectTo: `${window.location.origin}/oauth2callback?siteId=${encodeURIComponent(siteId)}&next=${encodeURIComponent(returnPath)}`,
      queryParams: { prompt: 'consent', access_type: 'offline' },
    },
  });
}
