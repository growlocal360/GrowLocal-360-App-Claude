import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveOrgId } from '@/lib/auth/active-org';
import { getOrgGoogleToken, getGoogleToken } from '@/lib/google/get-google-token';
import { GBPClient, gbpLocationToAppLocation } from '@/lib/google/gbp-client';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const siteId = searchParams.get('siteId');

    // Get current user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Resolve a Google token. When a siteId is provided, use the full resolver
    // (fresh session token → site-level connection WITH auto-refresh → org
    // fallback) so a returning user whose stored token merely EXPIRED is silently
    // refreshed instead of getting stuck. Without a siteId, fall back to the
    // session token then the org-level connection.
    let providerToken: string | null = null;
    if (siteId) {
      providerToken = await getGoogleToken(siteId);
    } else {
      providerToken = session.provider_token || null;
      if (!providerToken) {
        const cookieOrg = await getActiveOrgId();
        let orgId = cookieOrg;
        if (!orgId) {
          const admin = createAdminClient();
          const { data: profile } = await admin
            .from('profiles')
            .select('organization_id')
            .eq('user_id', session.user.id)
            .limit(1)
            .maybeSingle();
          orgId = profile?.organization_id || null;
        }
        if (orgId) {
          providerToken = await getOrgGoogleToken(orgId);
        }
      }
    }

    if (!providerToken) {
      return NextResponse.json(
        { error: 'No Google connection found. Please reconnect your Google account.' },
        { status: 400 }
      );
    }

    const gbpClient = new GBPClient(providerToken);

    // If accountId is provided, get locations for that account
    // Otherwise, get all locations across all accounts
    if (accountId) {
      const locations = await gbpClient.getAllLocationsForAccount(accountId);
      const formattedLocations = locations.map(gbpLocationToAppLocation);
      return NextResponse.json({ locations: formattedLocations });
    }

    // Get all locations across all accounts
    const allResults = await gbpClient.getAllLocations();
    const allLocations = allResults.flatMap((result) =>
      result.locations.map((loc) => ({
        ...gbpLocationToAppLocation(loc),
        accountName: result.account.accountName,
        accountId: result.account.name,
      }))
    );

    return NextResponse.json({ locations: allLocations });
  } catch (error) {
    console.error('Error fetching GBP locations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}
