import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || searchParams.get('redirect') || '/dashboard';
  const siteId = searchParams.get('siteId');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // If siteId was passed, persist the Google token to social_connections
      if (siteId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.provider_token) {
            const admin = createAdminClient();

            // Get the GBP account ID to use as the account_id key
            const { data: location } = await admin
              .from('locations')
              .select('gbp_account_id')
              .eq('site_id', siteId)
              .eq('is_primary', true)
              .single();

            const accountId = location?.gbp_account_id?.replace('accounts/', '') || 'default';

            await admin
              .from('social_connections')
              .upsert(
                {
                  site_id: siteId,
                  platform: 'google_business',
                  account_id: accountId,
                  account_name: 'Google Business Profile',
                  access_token: session.provider_token,
                  refresh_token: session.provider_refresh_token || null,
                  token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                  is_active: true,
                },
                { onConflict: 'site_id,platform,account_id' }
              );
          }
        } catch (err) {
          // Non-fatal — token save failure shouldn't block the redirect
          console.error('Failed to persist Google token on callback:', err);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
