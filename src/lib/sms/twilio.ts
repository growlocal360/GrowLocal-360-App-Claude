import twilio from 'twilio';

// ============================================================
// Twilio Client
// ============================================================

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.warn('Twilio credentials not configured — SMS will be skipped');
    return null;
  }

  return twilio(accountSid, authToken);
}

// ============================================================
// Send SMS
// ============================================================

interface SendSMSParams {
  to: string;
  body: string;
  from: string; // The site's dedicated Twilio number
}

/**
 * Send an SMS message via Twilio.
 * Returns the message SID on success, null on failure.
 */
export async function sendSMS({ to, body, from }: SendSMSParams): Promise<string | null> {
  const client = getTwilioClient();
  if (!client) {
    console.warn(`[SMS skipped] To: ${to} | Body: ${body.substring(0, 50)}...`);
    return null;
  }

  try {
    // Normalize phone number — strip non-digits, add +1 if needed
    const normalized = normalizePhone(to);
    if (!normalized) {
      console.warn(`[SMS skipped] Invalid phone number: ${to}`);
      return null;
    }

    const message = await client.messages.create({
      to: normalized,
      from,
      body,
    });

    return message.sid;
  } catch (error) {
    console.error(`[SMS failed] To: ${to} | Error:`, error);
    return null;
  }
}

// ============================================================
// Phone Number Provisioning
// ============================================================

interface ProvisionNumberResult {
  phoneNumber: string;  // e.g. "+15551234567"
  phoneSid: string;     // Twilio Phone Number SID
}

/**
 * Provision a dedicated Twilio phone number for a site.
 * Tries to match the business's area code, falls back to same state, then any US number.
 * Configures the inbound SMS webhook to route replies.
 */
export async function provisionPhoneNumber(
  businessPhone: string | null,
  siteId: string
): Promise<ProvisionNumberResult | null> {
  const client = getTwilioClient();
  if (!client) {
    console.warn('[Twilio] Cannot provision number — credentials not configured');
    return null;
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.growlocal360.com'}/api/webhooks/twilio/inbound`;

  try {
    // Try to find a number matching the business's area code
    let areaCode: number | undefined;
    if (businessPhone) {
      const digits = businessPhone.replace(/\D/g, '');
      // Extract area code (skip leading 1 for US numbers)
      const areaCodeStr = digits.length === 11 && digits.startsWith('1')
        ? digits.substring(1, 4)
        : digits.substring(0, 3);
      areaCode = parseInt(areaCodeStr, 10);
    }

    let availableNumbers;

    // Attempt 1: Match area code
    if (areaCode) {
      availableNumbers = await client.availablePhoneNumbers('US')
        .local.list({ areaCode, smsEnabled: true, limit: 1 });
    }

    // Attempt 2: Any US number with SMS
    if (!availableNumbers || availableNumbers.length === 0) {
      availableNumbers = await client.availablePhoneNumbers('US')
        .local.list({ smsEnabled: true, limit: 1 });
    }

    if (!availableNumbers || availableNumbers.length === 0) {
      console.error('[Twilio] No available phone numbers found');
      return null;
    }

    // Purchase the number
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: availableNumbers[0].phoneNumber,
      smsUrl: webhookUrl,
      smsMethod: 'POST',
      friendlyName: `GrowLocal-${siteId.substring(0, 8)}`,
    });

    return {
      phoneNumber: purchased.phoneNumber,
      phoneSid: purchased.sid,
    };
  } catch (error) {
    console.error('[Twilio] Failed to provision phone number:', error);
    return null;
  }
}

/**
 * Release a Twilio phone number when scheduling is deactivated.
 */
export async function releasePhoneNumber(phoneSid: string): Promise<boolean> {
  const client = getTwilioClient();
  if (!client) return false;

  try {
    await client.incomingPhoneNumbers(phoneSid).remove();
    return true;
  } catch (error) {
    console.error('[Twilio] Failed to release phone number:', error);
    return false;
  }
}

// ============================================================
// Helpers
// ============================================================

/**
 * Normalize a US phone number to E.164 format (+1XXXXXXXXXX).
 * Returns null if the number is invalid.
 */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (phone.startsWith('+') && digits.length >= 10) {
    return `+${digits}`;
  }

  return null;
}

/**
 * Forward an inbound SMS to the business owner's personal phone.
 * Uses the GrowLocal master number as the from number for the forward.
 */
export async function forwardSMS(
  ownerPhone: string,
  fromCustomerNumber: string,
  messageBody: string,
  siteBusinessName: string
): Promise<string | null> {
  const masterNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!masterNumber) {
    console.warn('[SMS forward] TWILIO_PHONE_NUMBER not set');
    return null;
  }

  const forwardBody = `[${siteBusinessName}] Message from ${fromCustomerNumber}:\n${messageBody}`;

  return sendSMS({
    to: ownerPhone,
    body: forwardBody,
    from: masterNumber,
  });
}
