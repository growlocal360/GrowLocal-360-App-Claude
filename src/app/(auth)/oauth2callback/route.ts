import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GBPClient, gbpLocationToAppLocation } from '@/lib/google/gbp-client';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || searchParams.get('redirect') || '/dashboard';
  const siteId = searchParams.get('siteId');

  if (code) {
    const supabase = await createClient();
    // IMPORTANT: read the session from exchangeCodeForSession's return value, NOT
    // a subsequent getSession() — Supabase doesn't persist provider_token /
    // provider_refresh_token to cookies, so getSession() after this returns a
    // session WITHOUT the Google tokens. Reading them here is the only chance.
    const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // If siteId was passed, persist the Google token to social_connections
      if (siteId) {
        try {
          const session = exchangeData?.session;
          if (session?.provider_token) {
            const admin = createAdminClient();

            // Get the GBP account ID to use as the account_id key.
            // .maybeSingle() so workspace sites (no locations row at all) don't
            // throw out of the whole persistence block.
            const { data: location } = await admin
              .from('locations')
              .select('gbp_account_id')
              .eq('site_id', siteId)
              .eq('is_primary', true)
              .maybeSingle();

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

            // Workspace sites (Job Snaps only — no public website) have no
            // locations row, so the GBP target needs to live elsewhere:
            // sites.settings.gbp_location_resource + org_google_connections
            // .default_location_resource. Fetch the user's GBP listings now
            // (while we have the fresh access token) and auto-pick when there's
            // exactly one — that's the common case (single-business owner).
            let pickedLocation: ReturnType<typeof gbpLocationToAppLocation> | null = null;
            let pickedAccountId: string | null = location?.gbp_account_id || null;
            if (!pickedAccountId) {
              try {
                const gbp = new GBPClient(session.provider_token);
                const allResults = await gbp.getAllLocations();
                const flat = allResults.flatMap((r) =>
                  r.locations.map((l) => ({
                    mapped: gbpLocationToAppLocation(l),
                    accountId: r.account.name as string,
                  }))
                );
                if (flat.length === 1) {
                  pickedLocation = flat[0].mapped;
                  pickedAccountId = flat[0].accountId;
                  // Also persist on sites.settings so publish-gbp's workspace
                  // fallback chain finds the target on the very next click.
                  const { data: currentSite } = await admin
                    .from('sites')
                    .select('settings')
                    .eq('id', siteId)
                    .maybeSingle();
                  const settings = (currentSite?.settings || {}) as Record<string, unknown>;
                  await admin
                    .from('sites')
                    .update({
                      settings: {
                        ...settings,
                        gbp_location_resource: pickedLocation.gbpLocationId,
                        gbp_location: pickedLocation,
                      },
                    })
                    .eq('id', siteId);
                }
                // If flat.length > 1 we leave it un-picked; the snap page can
                // surface a picker. (Out of scope for this fix.)
              } catch (gbpErr) {
                console.warn('[oauth2callback] auto-pick GBP location skipped:', gbpErr);
              }
            }

            // Also upsert the org-level connection so future "Add a New Site"
            // can reuse it without re-authing, and so any org where the Job
            // Snaps signup connect failed (e.g. before migration 052 was
            // applied) gets repaired by this per-site reconnect.
            const { data: orgRow } = await admin
              .from('sites')
              .select('organization_id')
              .eq('id', siteId)
              .maybeSingle();
            if (orgRow?.organization_id) {
              await admin
                .from('org_google_connections')
                .upsert(
                  {
                    organization_id: orgRow.organization_id,
                    account_id: pickedAccountId,
                    account_name: 'Google Business Profile',
                    access_token: session.provider_token,
                    refresh_token: session.provider_refresh_token || null,
                    token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                    ...(pickedLocation && {
                      default_location_resource: pickedLocation.gbpLocationId,
                      default_location_json: pickedLocation,
                    }),
                    is_active: true,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: 'organization_id' }
                );
            }
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
