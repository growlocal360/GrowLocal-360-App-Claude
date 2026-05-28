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

    // ── Save GBP IDs ─────────────────────────────────────────────────────────
    // Full GL360 sites: write to the primary location row (existing behavior).
    // Job Snaps workspace sites have no locations row — so we ALSO write the
    // GBP target onto sites.settings.gbp_location_resource. The publish-gbp
    // route's fallback chain reads either source, so both site shapes work.
    const { error: locationError, count: locationCount } = await admin
      .from('locations')
      .update({
        gbp_account_id: accountName,
        gbp_location_id: locationName,
      }, { count: 'exact' })
      .eq('site_id', siteId)
      .eq('is_primary', true);

    if (locationError) {
      console.error('Failed to update location GBP IDs:', locationError);
      return NextResponse.json({ error: 'Failed to save GBP location' }, { status: 500 });
    }

    // Always stash on sites.settings too — single source of truth for workspaces,
    // belt-and-suspenders for GL360 sites.
    const { data: currentSite } = await admin
      .from('sites')
      .select('settings')
      .eq('id', siteId)
      .single();
    const settings = (currentSite?.settings || {}) as Record<string, unknown>;
    const accIdOnly = (accountName as string).replace(/^accounts\//, '');
    const locIdOnly = (locationName as string).replace(/^locations\//, '');
    const resourcePath = `accounts/${accIdOnly}/locations/${locIdOnly}`;
    await admin
      .from('sites')
      .update({
        settings: {
          ...settings,
          gbp_location_resource: resourcePath,
          gbp_location: { name: locationTitle || null, gbpLocationId: resourcePath, accountId: `accounts/${accIdOnly}` },
        },
      })
      .eq('id', siteId);

    if ((locationCount ?? 0) === 0) {
      console.log('[connect-gbp] No primary location row to update (workspace site); persisted to sites.settings instead.', { siteId });
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

    // ── Also upsert the org-level connection ─────────────────────────────────
    // Repairs any org where the Job Snaps signup connect failed (e.g. before
    // migration 052 was applied) and lets a future "Add a New Site" reuse it
    // without re-authing. Non-fatal — site-level publishing still works without it.
    try {
      await admin
        .from('org_google_connections')
        .upsert(
          {
            organization_id: site.organization_id,
            account_id: accountName,
            account_name: locationTitle || accountName,
            access_token: providerToken,
            refresh_token: providerRefreshToken || null,
            token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            default_location_resource: `accounts/${accIdOnly}/locations/${locIdOnly}`,
            default_location_json: { name: locationTitle || null, gbpLocationId: `accounts/${accIdOnly}/locations/${locIdOnly}`, accountId: `accounts/${accIdOnly}` },
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id' }
        );
    } catch (e) {
      console.warn('[connect-gbp] org_google_connections upsert skipped:', e);
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
      .maybeSingle();

    // Take the most recent row — defensive against duplicates from older
    // connect flows. .maybeSingle() would 406 if more than one row matched.
    const { data: connections } = await admin
      .from('social_connections')
      .select('account_name, is_active, token_expires_at')
      .eq('site_id', siteId)
      .eq('platform', 'google_business')
      .order('updated_at', { ascending: false })
      .limit(1);
    const connection = connections?.[0] || null;

    // Workspace sites store the GBP target on sites.settings instead of a
    // locations row — treat that as connected too.
    const { data: site } = await admin
      .from('sites')
      .select('settings')
      .eq('id', siteId)
      .maybeSingle();
    const settings = (site?.settings || {}) as { gbp_location_resource?: string | null };

    const isConnected =
      !!(location?.gbp_account_id && location?.gbp_location_id) ||
      !!settings.gbp_location_resource;
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
