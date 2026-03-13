import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

// GET - Fetch GSC connection state + top queries
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Fetch site data (no org join needed — access already verified)
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, settings')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = (site.settings || {}) as any;

  const adminSupabase = createAdminClient();
  const { data: queries } = await adminSupabase
    .from('gsc_queries')
    .select('*')
    .eq('site_id', siteId)
    .order('impressions', { ascending: false })
    .limit(100);

  return NextResponse.json({
    gscPropertyUrl: settings.gsc_property_url || null,
    gscConnected: settings.gsc_connected || false,
    gscLastSyncedAt: settings.gsc_last_synced_at || null,
    queries: queries || [],
  });
}

// PATCH - Update GSC property URL
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const supabase = await createClient();

  const access = await verifySiteAccess(supabase, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Fetch site data (no org join needed — access already verified)
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, settings')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const body = await request.json();
  const { gscPropertyUrl } = body;

  const adminSupabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentSettings = (site.settings || {}) as any;

  const { error: updateError } = await adminSupabase
    .from('sites')
    .update({
      settings: {
        ...currentSettings,
        gsc_property_url: gscPropertyUrl || null,
        gsc_connected: !!gscPropertyUrl,
      },
    })
    .eq('id', siteId);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
