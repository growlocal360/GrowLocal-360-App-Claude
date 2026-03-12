import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GSCClient } from '@/lib/google/gsc-client';

// POST - Fetch GSC query data for a property (no siteId needed, for wizard use)
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { propertyUrl } = body;

  if (!propertyUrl) {
    return NextResponse.json({ error: 'propertyUrl is required' }, { status: 400 });
  }

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

    // Fetch last 28 days of data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const rows = await gscClient.querySearchAnalytics(propertyUrl, {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: ['query', 'page'],
      rowLimit: 1000,
    });

    // Transform to a simpler format for the wizard store
    const queries = rows.map((row) => ({
      query: row.keys[0],
      pageUrl: row.keys[1] || null,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      dateRangeStart: formatDate(startDate),
      dateRangeEnd: formatDate(endDate),
    }));

    return NextResponse.json({
      queries,
      dateRangeStart: formatDate(startDate),
      dateRangeEnd: formatDate(endDate),
    });
  } catch (error) {
    console.error('Failed to fetch GSC queries:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch queries';

    if (message.includes('403') || message.includes('401')) {
      return NextResponse.json(
        { error: 'Google token expired or lacks Search Console permission.' },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
