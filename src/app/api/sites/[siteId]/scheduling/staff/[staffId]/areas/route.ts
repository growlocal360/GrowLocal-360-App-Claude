import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{ siteId: string; staffId: string }>;
}

/**
 * GET /api/sites/[siteId]/scheduling/staff/[staffId]/areas
 * Get service areas assigned to a staff member
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { siteId, staffId } = await params;

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('staff_service_areas')
      .select('*, service_area:service_areas(id, name)')
      .eq('staff_member_id', staffId)
      .eq('site_id', siteId);

    if (error) {
      console.error('Failed to fetch staff service areas:', error);
      return NextResponse.json({ error: 'Failed to fetch areas' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching staff service areas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/sites/[siteId]/scheduling/staff/[staffId]/areas
 * Replace all service area assignments for a staff member
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { siteId, staffId } = await params;

  try {
    const body = await request.json();
    const { areas } = body as {
      areas: { city?: string; zip_code?: string; service_area_id?: string }[];
    };

    if (!Array.isArray(areas)) {
      return NextResponse.json({ error: 'areas must be an array' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Delete existing assignments
    await supabase
      .from('staff_service_areas')
      .delete()
      .eq('staff_member_id', staffId)
      .eq('site_id', siteId);

    // Insert new assignments
    if (areas.length > 0) {
      const rows = areas.map(a => ({
        staff_member_id: staffId,
        site_id: siteId,
        city: a.city || null,
        zip_code: a.zip_code || null,
        service_area_id: a.service_area_id || null,
      }));

      const { error } = await supabase
        .from('staff_service_areas')
        .insert(rows);

      if (error) {
        console.error('Failed to save staff service areas:', error);
        return NextResponse.json({ error: 'Failed to save areas' }, { status: 500 });
      }
    }

    const { data } = await supabase
      .from('staff_service_areas')
      .select('*, service_area:service_areas(id, name)')
      .eq('staff_member_id', staffId)
      .eq('site_id', siteId);

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error saving staff service areas:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
