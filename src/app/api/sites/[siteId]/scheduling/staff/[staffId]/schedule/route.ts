import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';

interface RouteParams {
  params: Promise<{ siteId: string; staffId: string }>;
}

/**
 * GET /api/sites/[siteId]/scheduling/staff/[staffId]/schedule
 * Get a staff member's availability schedule
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { siteId, staffId } = await params;

  const authClient = await createClient();
  const access = await verifySiteAccess(authClient, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const supabase = createAdminClient();

    // Get scheduling config for this site
    const { data: config } = await supabase
      .from('scheduling_configs')
      .select('id')
      .eq('site_id', siteId)
      .single();

    if (!config) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from('staff_schedules')
      .select('*')
      .eq('staff_member_id', staffId)
      .eq('scheduling_config_id', config.id)
      .order('day_of_week')
      .order('start_time');

    if (error) {
      console.error('Failed to fetch staff schedule:', error);
      return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching staff schedule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/sites/[siteId]/scheduling/staff/[staffId]/schedule
 * Replace a staff member's entire schedule (batch upsert)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { siteId, staffId } = await params;

  const authClient = await createClient();
  const access = await verifySiteAccess(authClient, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();
    const { schedules } = body as {
      schedules: {
        day_of_week: number;
        start_time: string;
        end_time: string;
        capacity: number;
        slot_times?: string[];
        is_active: boolean;
      }[];
    };

    if (!Array.isArray(schedules)) {
      return NextResponse.json({ error: 'schedules must be an array' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get or create scheduling config
    let { data: config } = await supabase
      .from('scheduling_configs')
      .select('id')
      .eq('site_id', siteId)
      .single();

    if (!config) {
      const { data: newConfig, error: configError } = await supabase
        .from('scheduling_configs')
        .insert({ site_id: siteId })
        .select('id')
        .single();

      if (configError) {
        return NextResponse.json({ error: 'Failed to create scheduling config' }, { status: 500 });
      }
      config = newConfig;
    }

    // Delete existing schedules for this staff member + config
    await supabase
      .from('staff_schedules')
      .delete()
      .eq('staff_member_id', staffId)
      .eq('scheduling_config_id', config.id);

    // Insert new schedules
    if (schedules.length > 0) {
      const rows = schedules.map(s => ({
        staff_member_id: staffId,
        scheduling_config_id: config.id,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        capacity: s.capacity || 1,
        slot_times: s.slot_times || null,
        is_active: s.is_active ?? true,
      }));

      const { error } = await supabase
        .from('staff_schedules')
        .insert(rows);

      if (error) {
        console.error('Failed to save staff schedule:', error);
        return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
      }
    }

    // Return the updated schedule
    const { data } = await supabase
      .from('staff_schedules')
      .select('*')
      .eq('staff_member_id', staffId)
      .eq('scheduling_config_id', config.id)
      .order('day_of_week')
      .order('start_time');

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error saving staff schedule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
