import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteAccess } from '@/lib/auth/permissions';
import { inngest } from '@/lib/inngest/client';

interface RouteParams {
  params: Promise<{ siteId: string; appointmentId: string }>;
}

/**
 * POST /api/sites/[siteId]/scheduling/appointments/[appointmentId]/decline
 * Decline a pending appointment
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
        { error: `Cannot decline appointment with status: ${appointment.status}` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) {
      console.error('Failed to decline appointment:', error);
      return NextResponse.json({ error: 'Failed to decline appointment' }, { status: 500 });
    }

    // Fire notification workflow
    await inngest.send({
      name: 'booking/declined',
      data: { appointmentId, siteId },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error declining appointment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
