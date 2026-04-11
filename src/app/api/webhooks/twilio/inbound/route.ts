import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { forwardSMS } from '@/lib/sms/twilio';

/**
 * POST /api/webhooks/twilio/inbound
 * Twilio webhook — receives inbound SMS replies from customers
 * and forwards them to the business owner's notification phone.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const from = formData.get('From') as string;        // Customer's phone number
    const to = formData.get('To') as string;             // Site's Twilio number
    const body = formData.get('Body') as string;         // Message text

    if (!from || !to || !body) {
      return twimlResponse('');
    }

    const supabase = createAdminClient();

    // Find which site owns this Twilio number
    const { data: config } = await supabase
      .from('scheduling_configs')
      .select('site_id, notification_phone')
      .eq('twilio_phone_number', to)
      .single();

    if (!config || !config.notification_phone) {
      console.warn(`[Inbound SMS] No config found for Twilio number ${to}`);
      return twimlResponse('');
    }

    // Get the business name for the forwarded message
    const { data: site } = await supabase
      .from('sites')
      .select('name')
      .eq('id', config.site_id)
      .single();

    const businessName = site?.name || 'Your Business';

    // Forward the message to the business owner
    await forwardSMS(
      config.notification_phone,
      from,
      body,
      businessName
    );

    // Respond with empty TwiML (no auto-reply to the customer)
    return twimlResponse('');
  } catch (error) {
    console.error('[Inbound SMS webhook] Error:', error);
    return twimlResponse('');
  }
}

/**
 * Twilio expects a TwiML XML response.
 * Empty <Response/> means "don't send any auto-reply".
 */
function twimlResponse(message: string) {
  const xml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

  return new NextResponse(xml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
