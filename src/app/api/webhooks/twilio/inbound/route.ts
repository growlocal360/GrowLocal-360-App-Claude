import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createAdminClient } from '@/lib/supabase/admin';
import { forwardSMS } from '@/lib/sms/twilio';

/**
 * Validate that the request actually came from Twilio.
 * Uses the X-Twilio-Signature header + auth token to verify.
 */
function validateTwilioSignature(
  request: NextRequest,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.warn('[Twilio Webhook] No TWILIO_AUTH_TOKEN — skipping signature validation');
    return true; // Allow in dev when token isn't configured
  }

  const signature = request.headers.get('x-twilio-signature');
  if (!signature) return false;

  const url = request.url;
  return twilio.validateRequest(authToken, signature, url, params);
}

/**
 * POST /api/webhooks/twilio/inbound
 * Twilio webhook — receives inbound SMS replies from customers
 * and forwards them to the business owner's notification phone.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => { params[key] = value.toString(); });

    // Validate Twilio signature
    if (!validateTwilioSignature(request, params)) {
      console.warn('[Twilio Webhook] Invalid signature — rejecting request');
      return new NextResponse('Forbidden', { status: 403 });
    }

    const from = params.From;
    const to = params.To;
    const body = params.Body;

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
