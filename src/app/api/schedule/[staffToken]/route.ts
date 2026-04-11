import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{ staffToken: string }>;
}

/**
 * GET /api/schedule/[staffToken]
 * Public endpoint for staff self-service calendar
 * Returns staff info, their appointments, and time blocks
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { staffToken } = await params;
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    const supabase = createAdminClient();

    // Look up staff member by schedule_token
    const { data: staffMember } = await supabase
      .from('staff_members')
      .select('id, full_name, organization_id')
      .eq('schedule_token', staffToken)
      .eq('is_active', true)
      .single();

    if (!staffMember) {
      return NextResponse.json({ error: 'Invalid schedule link' }, { status: 404 });
    }

    // Get site assignment for this staff member
    const { data: assignment } = await supabase
      .from('staff_site_assignments')
      .select('site_id, site:sites(id, name)')
      .eq('staff_member_id', staffMember.id)
      .limit(1)
      .single();

    const siteId = assignment?.site_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const siteObj = assignment?.site as any;
    const siteName = siteObj?.name || 'Unknown';

    // Get appointments for this staff member
    let apptQuery = supabase
      .from('appointments')
      .select('id, customer_name, customer_phone, service_type, scheduled_date, scheduled_time, time_window_start, time_window_end, status, notes')
      .eq('staff_member_id', staffMember.id)
      .order('scheduled_date')
      .order('scheduled_time', { nullsFirst: false });

    if (startDate) apptQuery = apptQuery.gte('scheduled_date', startDate);
    if (endDate) apptQuery = apptQuery.lte('scheduled_date', endDate);

    const { data: appointments } = await apptQuery;

    // Get time blocks
    let blockQuery = supabase
      .from('staff_time_blocks')
      .select('id, block_date, start_time, end_time, reason')
      .eq('staff_member_id', staffMember.id)
      .order('block_date');

    if (startDate) blockQuery = blockQuery.gte('block_date', startDate);
    if (endDate) blockQuery = blockQuery.lte('block_date', endDate);

    const { data: blocks } = await blockQuery;

    return NextResponse.json({
      staff: {
        id: staffMember.id,
        full_name: staffMember.full_name,
        site_id: siteId,
        site_name: siteName,
      },
      appointments: appointments || [],
      blocks: blocks || [],
    });
  } catch (error) {
    console.error('Error fetching staff schedule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
