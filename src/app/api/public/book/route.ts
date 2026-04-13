import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { inngest } from '@/lib/inngest/client';

/**
 * POST /api/public/book
 * Public endpoint — create a booking from the website
 * Creates both an appointment and a lead record
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      siteId, customer_name, customer_email, customer_phone,
      customer_city, customer_zip, service_type, notes, address,
      scheduled_date, scheduled_time, time_window_start, time_window_end,
      source_page,
    } = body;

    if (!siteId || !customer_name || !scheduled_date) {
      return NextResponse.json(
        { error: 'siteId, customer_name, and scheduled_date are required' },
        { status: 400 }
      );
    }

    if (!customer_phone && !customer_email) {
      return NextResponse.json(
        { error: 'At least one of customer_phone or customer_email is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify site exists and is active
    const { data: site } = await supabase
      .from('sites')
      .select('id, name, is_active')
      .eq('id', siteId)
      .eq('is_active', true)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Get scheduling config to determine booking mode
    const { data: config } = await supabase
      .from('scheduling_configs')
      .select('booking_mode, is_active')
      .eq('site_id', siteId)
      .single();

    if (!config?.is_active) {
      return NextResponse.json({ error: 'Scheduling not enabled' }, { status: 400 });
    }

    const appointmentStatus = config.booking_mode === 'instant' ? 'confirmed' : 'pending';

    // Create the lead first
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        site_id: siteId,
        name: customer_name,
        email: customer_email || null,
        phone: customer_phone || null,
        service_type: service_type || null,
        message: notes || null,
        address: address || null,
        source_page: source_page || '/contact',
        status: 'new',
      })
      .select()
      .single();

    if (leadError) {
      console.error('Failed to create lead:', leadError);
      return NextResponse.json({ error: 'Failed to submit booking' }, { status: 500 });
    }

    // Create the appointment linked to the lead
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert({
        site_id: siteId,
        lead_id: lead.id,
        customer_name,
        customer_email: customer_email || null,
        customer_phone: customer_phone || null,
        customer_city: customer_city || null,
        customer_zip: customer_zip || null,
        service_type: service_type || null,
        notes: notes || null,
        address: address || null,
        scheduled_date,
        scheduled_time: scheduled_time || null,
        time_window_start: time_window_start || null,
        time_window_end: time_window_end || null,
        source: 'online_booking',
        status: appointmentStatus,
      })
      .select()
      .single();

    if (apptError) {
      console.error('Failed to create appointment:', apptError);
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
    }

    // Fire Inngest event for notification workflow
    await inngest.send({
      name: 'booking/created',
      data: { appointmentId: appointment.id, siteId },
    });

    return NextResponse.json({
      success: true,
      appointmentId: appointment.id,
      leadId: lead.id,
      status: appointmentStatus,
      message: appointmentStatus === 'confirmed'
        ? 'Your appointment has been confirmed!'
        : 'Your booking request has been received. You will be notified once it is confirmed.',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
