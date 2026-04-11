import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';

interface RouteParams {
  params: Promise<{ siteId: string }>;
}

/**
 * GET /api/sites/[siteId]/scheduling/appointments
 * List appointments with optional date range and staff filter
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { siteId } = await params;

  const authClient = await createClient();
  const access = await verifySiteAccess(authClient, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const staffId = searchParams.get('staffId');
  const status = searchParams.get('status');

  try {
    const supabase = createAdminClient();

    let query = supabase
      .from('appointments')
      .select('*, staff_member:staff_members(id, full_name, avatar_url, phone)')
      .eq('site_id', siteId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true, nullsFirst: false });

    if (startDate) query = query.gte('scheduled_date', startDate);
    if (endDate) query = query.lte('scheduled_date', endDate);
    if (staffId) query = query.eq('staff_member_id', staffId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch appointments:', error);
      return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/sites/[siteId]/scheduling/appointments
 * Create a new appointment (manual entry from dashboard)
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
    const {
      staff_member_id, customer_name, customer_email, customer_phone,
      customer_city, customer_zip, service_type, notes,
      scheduled_date, scheduled_time, time_window_start, time_window_end,
      source = 'manual', status = 'confirmed',
    } = body;

    if (!customer_name || !scheduled_date) {
      return NextResponse.json(
        { error: 'Customer name and scheduled date are required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        site_id: siteId,
        staff_member_id: staff_member_id || null,
        customer_name,
        customer_email: customer_email || null,
        customer_phone: customer_phone || null,
        customer_city: customer_city || null,
        customer_zip: customer_zip || null,
        service_type: service_type || null,
        notes: notes || null,
        scheduled_date,
        scheduled_time: scheduled_time || null,
        time_window_start: time_window_start || null,
        time_window_end: time_window_end || null,
        source,
        status,
      })
      .select('*, staff_member:staff_members(id, full_name, avatar_url, phone)')
      .single();

    if (error) {
      console.error('Failed to create appointment:', error);
      return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating appointment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
