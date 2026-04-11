import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';

interface RouteParams {
  params: Promise<{ siteId: string; staffId: string }>;
}

/**
 * GET /api/sites/[siteId]/scheduling/staff/[staffId]/blocks
 * Get time blocks for a staff member (optionally filtered by date range)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { siteId, staffId } = await params;

  const authClient = await createClient();
  const access = await verifySiteAccess(authClient, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    const supabase = createAdminClient();

    let query = supabase
      .from('staff_time_blocks')
      .select('*')
      .eq('staff_member_id', staffId)
      .order('block_date')
      .order('start_time', { nullsFirst: true });

    if (startDate) query = query.gte('block_date', startDate);
    if (endDate) query = query.lte('block_date', endDate);

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch time blocks:', error);
      return NextResponse.json({ error: 'Failed to fetch blocks' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching time blocks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/sites/[siteId]/scheduling/staff/[staffId]/blocks
 * Add a time block for a staff member
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { siteId, staffId } = await params;

  const authClient = await createClient();
  const access = await verifySiteAccess(authClient, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();
    const { block_date, start_time, end_time, reason } = body;

    if (!block_date) {
      return NextResponse.json({ error: 'block_date is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('staff_time_blocks')
      .insert({
        staff_member_id: staffId,
        block_date,
        start_time: start_time || null,
        end_time: end_time || null,
        reason: reason || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create time block:', error);
      return NextResponse.json({ error: 'Failed to create block' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating time block:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/sites/[siteId]/scheduling/staff/[staffId]/blocks
 * Delete a time block by ID (passed as query param)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { siteId, staffId } = await params;

  const authClient = await createClient();
  const access = await verifySiteAccess(authClient, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { searchParams } = new URL(request.url);
  const blockId = searchParams.get('blockId');

  if (!blockId) {
    return NextResponse.json({ error: 'blockId is required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('staff_time_blocks')
      .delete()
      .eq('id', blockId)
      .eq('staff_member_id', staffId);

    if (error) {
      console.error('Failed to delete time block:', error);
      return NextResponse.json({ error: 'Failed to delete block' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting time block:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
