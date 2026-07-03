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
      source_page, metadata,
    } = body;

    // Niche intake forms carry zip/city inside metadata; surface them onto the
    // appointment's first-class columns when not passed explicitly.
    const meta = metadata && typeof metadata === 'object' ? metadata : {};
    const resolvedZip = customer_zip || (meta as Record<string, unknown>).zip || null;
    const resolvedCity = customer_city || (meta as Record<string, unknown>).city || null;

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

    // Create the lead first. Graceful fallback: strip an optional column
    // (address → migration 038, metadata → migration 055) if it hasn't been
    // migrated yet, so the booking still captures rather than 500ing.
    const leadPayload: Record<string, unknown> = {
      site_id: siteId,
      name: customer_name,
      email: customer_email || null,
      phone: customer_phone || null,
      service_type: service_type || null,
      message: notes || null,
      address: address || null,
      metadata: meta,
      source_page: source_page || '/contact',
      status: 'new',
    };

    let leadInsert = await supabase.from('leads').insert(leadPayload).select().single();
    for (let attempt = 0; attempt < 2 && leadInsert.error; attempt++) {
      const missing = leadInsert.error.message.match(/column .*?"?(address|metadata)"? .*does not exist/i);
      if (!missing) break;
      console.warn(`[book] ${missing[1]} column missing on leads — retrying without it`);
      delete leadPayload[missing[1]];
      leadInsert = await supabase.from('leads').insert(leadPayload).select().single();
    }

    if (leadInsert.error) {
      console.error('[book] Failed to create lead:', leadInsert.error);
      return NextResponse.json(
        { error: 'Failed to submit booking', details: leadInsert.error.message, code: leadInsert.error.code },
        { status: 500 }
      );
    }
    const lead = leadInsert.data!;

    // Create the appointment linked to the lead (same fallback)
    const buildApptPayload = (includeAddress: boolean) => ({
      site_id: siteId,
      lead_id: lead.id,
      customer_name,
      customer_email: customer_email || null,
      customer_phone: customer_phone || null,
      customer_city: resolvedCity,
      customer_zip: resolvedZip,
      service_type: service_type || null,
      notes: notes || null,
      ...(includeAddress ? { address: address || null } : {}),
      scheduled_date,
      scheduled_time: scheduled_time || null,
      time_window_start: time_window_start || null,
      time_window_end: time_window_end || null,
      source: 'online_booking',
      status: appointmentStatus,
    });

    let apptInsert = await supabase
      .from('appointments')
      .insert(buildApptPayload(true))
      .select()
      .single();

    if (apptInsert.error && /column .*address.* does not exist/i.test(apptInsert.error.message)) {
      console.warn('[book] address column missing on appointments — retrying without it');
      apptInsert = await supabase
        .from('appointments')
        .insert(buildApptPayload(false))
        .select()
        .single();
    }

    if (apptInsert.error) {
      console.error('[book] Failed to create appointment:', apptInsert.error);
      return NextResponse.json(
        { error: 'Failed to create booking', details: apptInsert.error.message, code: apptInsert.error.code },
        { status: 500 }
      );
    }
    const appointment = apptInsert.data!;

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
