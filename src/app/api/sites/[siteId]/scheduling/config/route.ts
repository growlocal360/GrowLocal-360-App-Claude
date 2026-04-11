import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { provisionPhoneNumber, releasePhoneNumber } from '@/lib/sms/twilio';

interface RouteParams {
  params: Promise<{ siteId: string }>;
}

/**
 * GET /api/sites/[siteId]/scheduling/config
 * Returns the scheduling configuration for a site (creates default if none exists)
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { siteId } = await params;

  try {
    const supabase = createAdminClient();

    // Try to get existing config
    const { data: config } = await supabase
      .from('scheduling_configs')
      .select('*')
      .eq('site_id', siteId)
      .single();

    if (config) {
      return NextResponse.json(config);
    }

    // Create default config if none exists
    const { data: newConfig, error } = await supabase
      .from('scheduling_configs')
      .insert({
        site_id: siteId,
        scheduling_mode: 'time_windows',
        booking_mode: 'approval',
        cta_style: 'booking',
        timezone: 'America/New_York',
        advance_booking_days: 14,
        booking_buffer_minutes: 30,
        show_availability_badge: true,
        auto_publish_availability: false,
        publish_times: ['07:30', '11:00', '14:00'],
        publish_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        is_active: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create scheduling config:', error);
      return NextResponse.json({ error: 'Failed to create config' }, { status: 500 });
    }

    return NextResponse.json(newConfig);
  } catch (error) {
    console.error('Error fetching scheduling config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/sites/[siteId]/scheduling/config
 * Update scheduling configuration
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { siteId } = await params;

  try {
    const body = await request.json();
    const supabase = createAdminClient();

    const allowedFields = [
      'scheduling_mode', 'booking_mode', 'cta_style', 'timezone',
      'advance_booking_days', 'booking_buffer_minutes',
      'show_availability_badge', 'auto_publish_availability', 'publish_times', 'publish_days',
      'notification_phone', 'notification_email', 'confirmation_message',
      'is_active',
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

    // Auto-provision Twilio number when scheduling is activated
    if (updates.is_active === true) {
      const { data: existingConfig } = await supabase
        .from('scheduling_configs')
        .select('twilio_phone_number, twilio_phone_sid')
        .eq('site_id', siteId)
        .single();

      if (!existingConfig?.twilio_phone_number) {
        // Get business phone to try matching area code
        const { data: site } = await supabase
          .from('sites')
          .select('settings')
          .eq('id', siteId)
          .single();
        const businessPhone = (site?.settings as Record<string, string>)?.phone || null;

        const result = await provisionPhoneNumber(businessPhone, siteId);
        if (result) {
          updates.twilio_phone_number = result.phoneNumber;
          updates.twilio_phone_sid = result.phoneSid;
        }
      }
    }

    // Release Twilio number when scheduling is deactivated
    if (updates.is_active === false) {
      const { data: existingConfig } = await supabase
        .from('scheduling_configs')
        .select('twilio_phone_sid')
        .eq('site_id', siteId)
        .single();

      if (existingConfig?.twilio_phone_sid) {
        await releasePhoneNumber(existingConfig.twilio_phone_sid);
        updates.twilio_phone_number = null;
        updates.twilio_phone_sid = null;
      }
    }

    const { data, error } = await supabase
      .from('scheduling_configs')
      .update(updates)
      .eq('site_id', siteId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update scheduling config:', error);
      return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating scheduling config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
