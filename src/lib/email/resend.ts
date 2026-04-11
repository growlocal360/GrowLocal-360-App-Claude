import { Resend } from 'resend';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  return new Resend(apiKey);
}

interface SendInviteEmailParams {
  to: string;
  inviterName: string;
  orgName: string;
  role: string;
  inviteUrl: string;
}

export async function sendInviteEmail({
  to,
  inviterName,
  orgName,
  role,
  inviteUrl,
}: SendInviteEmailParams) {
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'GrowLocal 360 <noreply@send.growlocal360.com>',
    to,
    subject: `${inviterName} invited you to join ${orgName} on GrowLocal 360`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #111827; margin-bottom: 8px;">You've been invited!</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          <strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> as ${role === 'admin' ? 'an' : 'a'} <strong>${role}</strong> on GrowLocal 360.
        </p>
        <div style="margin: 32px 0;">
          <a href="${inviteUrl}" style="display: inline-block; background-color: #00ef99; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Accept Invitation
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 14px;">
          This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          GrowLocal 360 &mdash; AI-Powered Local Business Websites
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send invite email:', error);
    throw new Error(`Failed to send invitation email: ${error.message}`);
  }
}

// ============================================================
// Scheduling Notification Emails
// ============================================================

const EMAIL_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 560px; margin: 0 auto; padding: 40px 20px;
`;

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

interface BookingEmailParams {
  to: string;
  customerName: string;
  businessName: string;
  serviceName?: string | null;
  scheduledDate: string;
  scheduledTime?: string | null;
  windowStart?: string | null;
  windowEnd?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  notes?: string | null;
  brandColor?: string;
}

/**
 * Email to business owner when a new booking comes in.
 */
export async function sendNewBookingNotificationEmail({
  to, customerName, businessName, serviceName,
  scheduledDate, scheduledTime, windowStart, windowEnd,
  customerPhone, customerEmail, notes, brandColor = '#00ef99',
}: BookingEmailParams & { approveUrl?: string }) {
  const resend = getResendClient();
  const timeDisplay = scheduledTime
    ? formatTime(scheduledTime)
    : (windowStart && windowEnd)
      ? `${formatTime(windowStart)} - ${formatTime(windowEnd)}`
      : 'Time TBD';

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'GrowLocal 360 <noreply@send.growlocal360.com>',
    to,
    subject: `New Booking: ${customerName} - ${formatDate(scheduledDate)}`,
    html: `
      <div style="${EMAIL_STYLES}">
        <h2 style="color: #111827;">New Booking Request</h2>
        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <p style="margin: 4px 0; color: #374151;"><strong>Customer:</strong> ${customerName}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Date:</strong> ${formatDate(scheduledDate)}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Time:</strong> ${timeDisplay}</p>
          ${serviceName ? `<p style="margin: 4px 0; color: #374151;"><strong>Service:</strong> ${serviceName}</p>` : ''}
          ${customerPhone ? `<p style="margin: 4px 0; color: #374151;"><strong>Phone:</strong> <a href="tel:${customerPhone}">${customerPhone}</a></p>` : ''}
          ${customerEmail ? `<p style="margin: 4px 0; color: #374151;"><strong>Email:</strong> <a href="mailto:${customerEmail}">${customerEmail}</a></p>` : ''}
          ${notes ? `<p style="margin: 4px 0; color: #374151;"><strong>Notes:</strong> ${notes}</p>` : ''}
        </div>
        <p style="color: #6b7280; font-size: 14px;">Log into your dashboard to approve or decline this booking.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">${businessName} &mdash; Powered by GrowLocal 360</p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send booking notification email:', error);
  }
}

/**
 * Confirmation email to customer when booking is confirmed.
 */
export async function sendBookingConfirmationEmail({
  to, customerName, businessName, serviceName,
  scheduledDate, scheduledTime, windowStart, windowEnd,
  brandColor = '#00ef99',
}: BookingEmailParams) {
  const resend = getResendClient();
  const timeDisplay = scheduledTime
    ? formatTime(scheduledTime)
    : (windowStart && windowEnd)
      ? `${formatTime(windowStart)} - ${formatTime(windowEnd)}`
      : 'We\'ll confirm the exact time shortly';

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'GrowLocal 360 <noreply@send.growlocal360.com>',
    to,
    subject: `Appointment Confirmed - ${businessName}`,
    html: `
      <div style="${EMAIL_STYLES}">
        <h2 style="color: #111827;">Your Appointment is Confirmed!</h2>
        <p style="color: #4b5563;">Hi ${customerName}, your appointment has been confirmed.</p>
        <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid ${brandColor};">
          <p style="margin: 4px 0; color: #374151;"><strong>Date:</strong> ${formatDate(scheduledDate)}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>Time:</strong> ${timeDisplay}</p>
          ${serviceName ? `<p style="margin: 4px 0; color: #374151;"><strong>Service:</strong> ${serviceName}</p>` : ''}
          <p style="margin: 4px 0; color: #374151;"><strong>Business:</strong> ${businessName}</p>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Need to reschedule? Reply to this email or call us directly.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">${businessName}</p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send booking confirmation email:', error);
  }
}

/**
 * Email to customer when their booking is declined, with alternative times.
 */
export async function sendSlotUnavailableEmail({
  to, customerName, businessName, scheduledDate,
  brandColor = '#00ef99',
}: Pick<BookingEmailParams, 'to' | 'customerName' | 'businessName' | 'scheduledDate' | 'brandColor'>) {
  const resend = getResendClient();

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'GrowLocal 360 <noreply@send.growlocal360.com>',
    to,
    subject: `Booking Update - ${businessName}`,
    html: `
      <div style="${EMAIL_STYLES}">
        <h2 style="color: #111827;">Booking Update</h2>
        <p style="color: #4b5563;">Hi ${customerName}, unfortunately the time you requested on ${formatDate(scheduledDate)} is no longer available.</p>
        <p style="color: #4b5563;">Please visit our website to choose another available time, or call us directly and we'll get you scheduled right away.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">${businessName}</p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send slot unavailable email:', error);
  }
}

/**
 * Appointment reminder email to customer (24hr or day-of).
 */
export async function sendAppointmentReminderEmail({
  to, customerName, businessName, serviceName,
  scheduledDate, scheduledTime, windowStart, windowEnd,
  brandColor = '#00ef99',
  reminderType = '24hr',
}: BookingEmailParams & { reminderType?: '24hr' | 'dayof' }) {
  const resend = getResendClient();
  const timeDisplay = scheduledTime
    ? formatTime(scheduledTime)
    : (windowStart && windowEnd)
      ? `${formatTime(windowStart)} - ${formatTime(windowEnd)}`
      : '';

  const subject = reminderType === '24hr'
    ? `Reminder: Appointment Tomorrow - ${businessName}`
    : `Today's Appointment - ${businessName}`;

  const intro = reminderType === '24hr'
    ? `This is a reminder that you have an appointment tomorrow.`
    : `Just a friendly reminder about your appointment today.`;

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'GrowLocal 360 <noreply@send.growlocal360.com>',
    to,
    subject,
    html: `
      <div style="${EMAIL_STYLES}">
        <h2 style="color: #111827;">${reminderType === '24hr' ? 'Appointment Tomorrow' : 'Today\'s Appointment'}</h2>
        <p style="color: #4b5563;">Hi ${customerName}, ${intro}</p>
        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid ${brandColor};">
          <p style="margin: 4px 0; color: #374151;"><strong>Date:</strong> ${formatDate(scheduledDate)}</p>
          ${timeDisplay ? `<p style="margin: 4px 0; color: #374151;"><strong>Time:</strong> ${timeDisplay}</p>` : ''}
          ${serviceName ? `<p style="margin: 4px 0; color: #374151;"><strong>Service:</strong> ${serviceName}</p>` : ''}
        </div>
        <p style="color: #6b7280; font-size: 14px;">Need to reschedule? Please call us as soon as possible.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">${businessName}</p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send appointment reminder email:', error);
  }
}

interface DailyDigestAppointment {
  customerName: string;
  serviceName?: string | null;
  time: string;
  phone?: string | null;
}

/**
 * Morning schedule digest email to business owner or staff member.
 */
export async function sendDailyScheduleSummaryEmail({
  to, recipientName, businessName, date, appointments, brandColor = '#00ef99',
}: {
  to: string;
  recipientName: string;
  businessName: string;
  date: string;
  appointments: DailyDigestAppointment[];
  brandColor?: string;
}) {
  const resend = getResendClient();

  const appointmentRows = appointments.length > 0
    ? appointments.map(a => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${a.time}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${a.customerName}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${a.serviceName || '-'}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${a.phone ? `<a href="tel:${a.phone}">${a.phone}</a>` : '-'}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #9ca3af;">No appointments today</td></tr>';

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'GrowLocal 360 <noreply@send.growlocal360.com>',
    to,
    subject: `Today's Schedule: ${appointments.length} appointment${appointments.length !== 1 ? 's' : ''} - ${formatDate(date)}`,
    html: `
      <div style="${EMAIL_STYLES}">
        <h2 style="color: #111827;">Good Morning, ${recipientName}!</h2>
        <p style="color: #4b5563;">Here's your schedule for <strong>${formatDate(date)}</strong>:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <thead>
            <tr style="background: ${brandColor}15;">
              <th style="padding: 8px 12px; text-align: left; color: #374151;">Time</th>
              <th style="padding: 8px 12px; text-align: left; color: #374151;">Customer</th>
              <th style="padding: 8px 12px; text-align: left; color: #374151;">Service</th>
              <th style="padding: 8px 12px; text-align: left; color: #374151;">Phone</th>
            </tr>
          </thead>
          <tbody>
            ${appointmentRows}
          </tbody>
        </table>
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
          <strong>${appointments.length}</strong> total appointment${appointments.length !== 1 ? 's' : ''} today.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">${businessName} &mdash; Powered by GrowLocal 360</p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send daily schedule summary email:', error);
  }
}
