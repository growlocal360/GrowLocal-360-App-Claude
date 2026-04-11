import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';

interface RouteParams {
  params: Promise<{ siteId: string; appointmentId: string }>;
}

/**
 * PATCH /api/sites/[siteId]/scheduling/appointments/[appointmentId]
 * Update appointment (status, reschedule, reassign staff)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { siteId, appointmentId } = await params;

  const authClient = await createClient();
  const access = await verifySiteAccess(authClient, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const body = await request.json();
    const supabase = createAdminClient();

    const allowedFields = [
      'staff_member_id', 'status', 'scheduled_date', 'scheduled_time',
      'time_window_start', 'time_window_end', 'notes', 'service_type',
      'customer_name', 'customer_email', 'customer_phone',
      'customer_city', 'customer_zip',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', appointmentId)
      .eq('site_id', siteId)
      .select('*, staff_member:staff_members(id, full_name, avatar_url, phone)')
      .single();

    if (error) {
      console.error('Failed to update appointment:', error);
      return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating appointment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/sites/[siteId]/scheduling/appointments/[appointmentId]
 * Delete an appointment
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { siteId, appointmentId } = await params;

  const authClient = await createClient();
  const access = await verifySiteAccess(authClient, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', appointmentId)
      .eq('site_id', siteId);

    if (error) {
      console.error('Failed to delete appointment:', error);
      return NextResponse.json({ error: 'Failed to delete appointment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
