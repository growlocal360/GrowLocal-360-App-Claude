import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveOrgId } from '@/lib/auth/active-org';

/**
 * Org-level Google Business Profile connection.
 *
 * POST — persist the connection captured on the Job Snaps signup form (before
 * any site exists). The Stripe webhook later clones it into a per-site
 * social_connections row, and "Add a New Site" reuses it.
 *
 * GET — return the current org's connection (for the reuse shortcut in the
 * wizard connect step).
 */

async function resolveActiveOrg(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from('profiles')
    .select('organization_id')
    .eq('user_id', userId);

  if (!profiles || profiles.length === 0) return null;

  const cookieOrg = await getActiveOrgId();
  if (cookieOrg && profiles.some((p) => p.organization_id === cookieOrg)) {
    return cookieOrg;
  }
  return profiles[0].organization_id as string;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await resolveActiveOrg(user.id);
  if (!orgId) return NextResponse.json({ connection: null });

  const admin = createAdminClient();
  const { data } = await admin
    .from('org_google_connections')
    .select('account_name, default_location_resource, default_location_json, is_active')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .maybeSingle();

  return NextResponse.json({ connection: data || null });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = await resolveActiveOrg(user.id);
  if (!orgId) {
    return NextResponse.json({ error: 'No organization for this user' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const { accessToken, refreshToken, expiresIn, accountId, accountName, location } = body;

  if (!accessToken) {
    return NextResponse.json({ error: 'accessToken is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Build update payload. Never overwrite an existing refresh_token with null —
  // Google only returns it on the first consent, and we want to keep the durable one.
  const payload: Record<string, unknown> = {
    organization_id: orgId,
    account_id: accountId || null,
    account_name: accountName || null,
    access_token: accessToken,
    token_expires_at: expiresIn
      ? new Date(Date.now() + Number(expiresIn) * 1000).toISOString()
      : null,
    default_location_resource: location?.gbpLocationId || null,
    default_location_json: location || null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
  if (refreshToken) payload.refresh_token = refreshToken;

  const { error } = await admin
    .from('org_google_connections')
    .upsert(payload, { onConflict: 'organization_id' });

  if (error) {
    console.error('[google/connect] Failed to persist org connection:', error);
    return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
