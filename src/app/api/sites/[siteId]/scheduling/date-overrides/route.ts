import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';

interface RouteParams {
  params: Promise<{ siteId: string }>;
}

/**
 * GET /api/sites/[siteId]/scheduling/date-overrides
 * List date overrides (blocked dates, capacity changes)
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { siteId } = await params;

  const authClient = await createClient();
  const access = await verifySiteAccess(authClient, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const supabase = createAdminClient();

    const { data: config } = await supabase
      .from('scheduling_configs')
      .select('id')
      .eq('site_id', siteId)
      .single();

    if (!config) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from('date_overrides')
      .select('*')
      .eq('scheduling_config_id', config.id)
      .order('override_date');

    if (error) {
      console.error('Failed to fetch date overrides:', error);
      return NextResponse.json({ error: 'Failed to fetch overrides' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching date overrides:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/sites/[siteId]/scheduling/date-overrides
 * Add a date override (block a date or modify capacity)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { siteId } = await params;

  const authClient = await createClient();
  const access = await verifySiteAccess(authClient, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();
    const { override_date, is_blocked = true, reason } = body;

    if (!override_date) {
      return NextResponse.json({ error: 'override_date is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: config } = await supabase
      .from('scheduling_configs')
      .select('id')
      .eq('site_id', siteId)
      .single();

    if (!config) {
      return NextResponse.json({ error: 'Scheduling not configured' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('date_overrides')
      .upsert(
        {
          scheduling_config_id: config.id,
          override_date,
          is_blocked,
          reason: reason || null,
        },
        { onConflict: 'scheduling_config_id,override_date' }
      )
      .select()
      .single();

    if (error) {
      console.error('Failed to create date override:', error);
      return NextResponse.json({ error: 'Failed to create override' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating date override:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/sites/[siteId]/scheduling/date-overrides
 * Remove a date override by ID
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { siteId } = await params;

  const authClient = await createClient();
  const access = await verifySiteAccess(authClient, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { searchParams } = new URL(request.url);
  const overrideId = searchParams.get('overrideId');

  if (!overrideId) {
    return NextResponse.json({ error: 'overrideId is required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    // Verify the override belongs to this site's config
    const { data: config } = await supabase
      .from('scheduling_configs')
      .select('id')
      .eq('site_id', siteId)
      .single();

    if (!config) {
      return NextResponse.json({ error: 'Scheduling not configured' }, { status: 404 });
    }

    const { error } = await supabase
      .from('date_overrides')
      .delete()
      .eq('id', overrideId)
      .eq('scheduling_config_id', config.id);

    if (error) {
      console.error('Failed to delete date override:', error);
      return NextResponse.json({ error: 'Failed to delete override' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting date override:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
