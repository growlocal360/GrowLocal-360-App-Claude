import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/sites/[siteId]/connect-gbp
 *
 * Saves the GBP account/location IDs to the site's primary location
 * and persists the Google OAuth token to social_connections.
 *
 * Body: { accountName: string, locationName: string, locationTitle: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;

    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Get session token ────────────────────────────────────────────────────
    const { data: { session } } = await supabase.auth.getSession();
    const providerToken = session?.provider_token;
    const providerRefreshToken = session?.provider_refresh_token;

    if (!providerToken) {
      return NextResponse.json(
        { error: 'No Google token available. Please re-authenticate with Google first.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { accountName, locationName, locationTitle } = body;

    if (!accountName || !locationName) {
      return NextResponse.json(
        { error: 'accountName and locationName are required' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // ── Verify org access ────────────────────────────────────────────────────
    const { data: profiles } = await admin
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id);
    const userOrgIds = (profiles || []).map((p: { organization_id: string }) => p.organization_id);

    const { data: site } = await admin
      .from('sites')
      .select('id, organization_id')
      .eq('id', siteId)
      .single();

    if (!site || !userOrgIds.includes(site.organization_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Save GBP IDs to primary location ─────────────────────────────────────
    const { error: locationError } = await admin
      .from('locations')
      .update({
        gbp_account_id: accountName,
        gbp_location_id: locationName,
      })
      .eq('site_id', siteId)
      .eq('is_primary', true);

    if (locationError) {
      console.error('Failed to update location GBP IDs:', locationError);
      return NextResponse.json({ error: 'Failed to save GBP location' }, { status: 500 });
    }

    // ── Persist token to social_connections ───────────────────────────────────
    // Extract account ID from "accounts/123456789" format
    const accountId = accountName.replace('accounts/', '');

    const { error: tokenError } = await admin
      .from('social_connections')
      .upsert(
        {
          site_id: siteId,
          platform: 'google_business',
          account_id: accountId,
          account_name: locationTitle || accountName,
          access_token: providerToken,
          refresh_token: providerRefreshToken || null,
          token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour
          is_active: true,
        },
        { onConflict: 'site_id,platform,account_id' }
      );

    if (tokenError) {
      console.error('Failed to save social connection:', tokenError);
      // Non-fatal — GBP IDs are saved, token can be re-saved later
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Connect GBP failed:', error);
    return NextResponse.json(
      { error: 'Failed to connect GBP. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sites/[siteId]/connect-gbp
 *
 * Returns the current GBP connection status for a site.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: location } = await admin
      .from('locations')
      .select('gbp_account_id, gbp_location_id')
      .eq('site_id', siteId)
      .eq('is_primary', true)
      .single();

    const { data: connection } = await admin
      .from('social_connections')
      .select('account_name, is_active, token_expires_at')
      .eq('site_id', siteId)
      .eq('platform', 'google_business')
      .single();

    const isConnected = !!(location?.gbp_account_id && location?.gbp_location_id);
    const hasToken = !!(connection?.is_active);

    return NextResponse.json({
      isConnected,
      hasToken,
      accountName: connection?.account_name || null,
      gbpAccountId: location?.gbp_account_id || null,
      gbpLocationId: location?.gbp_location_id || null,
    });
  } catch {
    return NextResponse.json({ isConnected: false, hasToken: false });
  }
}
