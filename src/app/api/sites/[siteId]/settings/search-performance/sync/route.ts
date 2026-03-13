import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { GSCClient } from '@/lib/google/gsc-client';

// POST - Sync GSC data for this site
export async function POST(
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
  const gscPropertyUrl = settings.gsc_property_url;

  if (!gscPropertyUrl) {
    return NextResponse.json(
      { error: 'No GSC property configured. Select a property first.' },
      { status: 400 }
    );
  }

  // Get provider token
  const { data: { session } } = await supabase.auth.getSession();
  const providerToken = session?.provider_token;

  if (!providerToken) {
    return NextResponse.json(
      { error: 'No Google token available. Please re-authenticate with Google.' },
      { status: 401 }
    );
  }

  try {
    const gscClient = new GSCClient(providerToken);

    // Fetch last 28 days of data with query + page dimensions
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const rows = await gscClient.querySearchAnalytics(gscPropertyUrl, {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: ['query', 'page'],
      rowLimit: 1000,
    });

    const adminSupabase = createAdminClient();
    const dateRangeStart = formatDate(startDate);
    const dateRangeEnd = formatDate(endDate);

    // Clear old data for this date range and insert fresh
    await adminSupabase
      .from('gsc_queries')
      .delete()
      .eq('site_id', siteId)
      .eq('date_range_start', dateRangeStart)
      .eq('date_range_end', dateRangeEnd);

    if (rows.length > 0) {
      const records = rows.map((row) => ({
        site_id: siteId,
        query: row.keys[0],
        page_url: row.keys[1] || null,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
      }));

      // Insert in batches of 200
      for (let i = 0; i < records.length; i += 200) {
        const batch = records.slice(i, i + 200);
        const { error: insertError } = await adminSupabase
          .from('gsc_queries')
          .insert(batch);

        if (insertError) {
          console.error('Failed to insert GSC batch:', insertError);
        }
      }
    }

    // Update last synced timestamp
    const { error: updateError } = await adminSupabase
      .from('sites')
      .update({
        settings: {
          ...settings,
          gsc_last_synced_at: new Date().toISOString(),
          gsc_connected: true,
        },
      })
      .eq('id', siteId);

    if (updateError) {
      console.error('Failed to update sync timestamp:', updateError);
    }

    return NextResponse.json({
      success: true,
      queriesImported: rows.length,
    });
  } catch (error) {
    console.error('GSC sync failed:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';

    if (message.includes('403') || message.includes('401')) {
      return NextResponse.json(
        { error: 'Google token expired or lacks Search Console permission. Please re-authenticate.' },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
