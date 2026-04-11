import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { inngest } from '@/lib/inngest/client';

interface RouteParams {
  params: Promise<{ siteId: string; appointmentId: string }>;
}

/**
 * POST /api/sites/[siteId]/scheduling/appointments/[appointmentId]/approve
 * Approve a pending appointment
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { siteId, appointmentId } = await params;

  const authClient = await createClient();
  const access = await verifySiteAccess(authClient, siteId);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const supabase = createAdminClient();

    // Verify appointment exists and is pending
    const { data: appointment } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .eq('site_id', siteId)
      .single();

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    if (appointment.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve appointment with status: ${appointment.status}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', appointmentId)
      .select('*, staff_member:staff_members(id, full_name, phone)')
      .single();

    if (error) {
      console.error('Failed to approve appointment:', error);
      return NextResponse.json({ error: 'Failed to approve appointment' }, { status: 500 });
    }

    // Fire notification workflow
    await inngest.send({
      name: 'booking/approved',
      data: { appointmentId, siteId },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error approving appointment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
