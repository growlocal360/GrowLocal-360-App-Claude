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

// ============================================================
// Lead Notification Email
// ============================================================

interface NewLeadEmailParams {
  to: string;
  businessName: string;
  leadName: string;
  leadPhone?: string | null;
  leadEmail?: string | null;
  serviceType?: string | null;
  message?: string | null;
  address?: string | null;
  sourcePage?: string | null;
  /** Niche-specific intake answers (e.g. appliance repair: brand, symptom, zip). */
  metadata?: Record<string, unknown> | null;
  dashboardUrl: string;
  brandColor?: string;
  isTest?: boolean;
}

/** Turn a metadata key like "zip" or "serviceArea" into "Zip" / "Service Area". */
function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Email to business owner when a new lead is submitted via a public site form.
 * Fired from the lead-notifications Inngest function after `lead/created`.
 */
export async function sendNewLeadNotificationEmail({
  to, businessName, leadName, leadPhone, leadEmail,
  serviceType, message, address, sourcePage, metadata, dashboardUrl,
  brandColor = '#00ef99', isTest = false,
}: NewLeadEmailParams) {
  const resend = getResendClient();

  const subjectPrefix = isTest ? '[TEST] ' : '';

  // Render niche-specific answers (brand, symptom, zip, …) as extra rows.
  const metadataRows = metadata && typeof metadata === 'object'
    ? Object.entries(metadata)
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
        .map(([k, v]) => `<p style="margin: 4px 0; color: #374151;"><strong>${humanizeKey(k)}:</strong> ${String(v)}</p>`)
        .join('')
    : '';
  const testBanner = isTest
    ? `<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; color: #92400e; font-size: 14px;">
         <strong>This is a test lead.</strong> No real customer submitted this form — you can ignore it.
       </div>`
    : '';

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'GrowLocal 360 <noreply@send.growlocal360.com>',
    to,
    subject: `${subjectPrefix}New lead from ${businessName}: ${leadName}`,
    html: `
      <div style="${EMAIL_STYLES}">
        ${testBanner}
        <h2 style="color: #111827; margin-bottom: 8px;">New Lead</h2>
        <p style="color: #4b5563; font-size: 16px;">Someone just submitted a form on <strong>${businessName}</strong>.</p>
        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid ${brandColor};">
          <p style="margin: 4px 0; color: #374151;"><strong>Name:</strong> ${leadName}</p>
          ${leadPhone ? `<p style="margin: 4px 0; color: #374151;"><strong>Phone:</strong> <a href="tel:${leadPhone}" style="color: ${brandColor}; text-decoration: none;">${leadPhone}</a></p>` : ''}
          ${leadEmail ? `<p style="margin: 4px 0; color: #374151;"><strong>Email:</strong> <a href="mailto:${leadEmail}" style="color: ${brandColor}; text-decoration: none;">${leadEmail}</a></p>` : ''}
          ${serviceType ? `<p style="margin: 4px 0; color: #374151;"><strong>Service:</strong> ${serviceType}</p>` : ''}
          ${address ? `<p style="margin: 4px 0; color: #374151;"><strong>Address:</strong> ${address}</p>` : ''}
          ${metadataRows}
          ${message ? `<p style="margin: 8px 0 4px; color: #374151;"><strong>Message:</strong></p><p style="margin: 4px 0; color: #4b5563; font-style: italic;">${message}</p>` : ''}
          ${sourcePage ? `<p style="margin: 12px 0 4px; color: #9ca3af; font-size: 12px;">Submitted from: ${sourcePage}</p>` : ''}
        </div>
        <div style="margin: 24px 0;">
          <a href="${dashboardUrl}" style="display: inline-block; background-color: ${brandColor}; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            View in dashboard
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px;">Tip: respond within 5 minutes to dramatically increase your conversion rate.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">${businessName} &mdash; Powered by GrowLocal 360</p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send lead notification email:', error);
    throw new Error(`Failed to send lead notification: ${error.message}`);
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

interface NegativeReviewAlertParams {
  to: string;
  businessName: string;
  rating: number;
  authorName: string;
  comment: string | null;
  draftReply: string;
  queueUrl: string;
  brandColor?: string;
}

/**
 * Owner alert for a 1-2 star review. Includes the drafted reply so they can
 * approve it from the queue; autopilot never posts these on its own.
 */
export async function sendNegativeReviewAlertEmail({
  to, businessName, rating, authorName, comment, draftReply, queueUrl, brandColor = '#00ef99',
}: NegativeReviewAlertParams) {
  const resend = getResendClient();
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'GrowLocal 360 <noreply@send.growlocal360.com>',
    to,
    subject: `${rating}-star review on ${businessName} needs a reply`,
    html: `
      <div style="${EMAIL_STYLES}">
        <h2 style="color: #111827; margin-bottom: 8px;">A ${rating}-star review just came in</h2>
        <p style="color: #4b5563; font-size: 16px;">On the Google Business Profile for <strong>${esc(businessName)}</strong>. We drafted a reply, but low ratings always wait for you.</p>
        <div style="background: #fef2f2; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <p style="margin: 0 0 6px; color: #b91c1c; font-size: 18px; letter-spacing: 2px;">${stars}</p>
          <p style="margin: 4px 0; color: #374151;"><strong>${esc(authorName)}</strong></p>
          ${comment ? `<p style="margin: 8px 0 0; color: #4b5563; font-style: italic;">${esc(comment)}</p>` : '<p style="margin: 8px 0 0; color: #9ca3af;">No written comment.</p>'}
        </div>
        <p style="color: #374151; margin: 0 0 6px;"><strong>Suggested reply</strong></p>
        <div style="background: #f9fafb; border-radius: 12px; padding: 16px 20px; margin: 0 0 20px; border-left: 4px solid ${brandColor}; color: #374151;">${esc(draftReply)}</div>
        <div style="margin: 24px 0;">
          <a href="${queueUrl}" style="display: inline-block; background-color: ${brandColor}; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Review and approve
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px;">Replying within a day shows every future reader that you handle problems. You can edit the draft before it posts.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">${esc(businessName)} &mdash; Powered by GrowLocal 360</p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send negative review alert:', error);
    throw new Error(`Failed to send review alert: ${error.message}`);
  }
}

interface ReviewRequestEmailParams {
  to: string;
  businessName: string;
  customerName: string;
  reviewUrl: string;
  brandColor?: string;
  subject?: string;
  followUp?: boolean;
}

/** Customer-facing "how did we do?" email with one button to the Google review form. */
export async function sendReviewRequestEmail({
  to, businessName, customerName, reviewUrl, brandColor = '#00ef99', subject, followUp = false,
}: ReviewRequestEmailParams) {
  const resend = getResendClient();
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const first = customerName.trim().split(/\s+/)[0] || customerName;

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'GrowLocal 360 <noreply@send.growlocal360.com>',
    to,
    subject: subject || (followUp ? `Quick favor from ${businessName}` : `How did we do? ${businessName}`),
    html: `
      <div style="${EMAIL_STYLES}">
        <h2 style="color: #111827; margin-bottom: 8px;">${followUp ? `Hi ${esc(first)}, one quick nudge` : `Hi ${esc(first)}, thank you`}</h2>
        <p style="color: #4b5563; font-size: 16px;">
          ${followUp
            ? `In case it slipped your mind, a short Google review for <strong>${esc(businessName)}</strong> would mean a lot. It takes about a minute.`
            : `Thanks for choosing <strong>${esc(businessName)}</strong>. If we did right by you, would you take a minute to leave a Google review? It helps neighbors find us and it means a lot to a local business.`}
        </p>
        <div style="margin: 24px 0;">
          <a href="${reviewUrl}" style="display: inline-block; background-color: ${brandColor}; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Leave a Google review
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px;">If anything was not right, reply to this email and we will make it right.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">${esc(businessName)}</p>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send review request email:', error);
    throw new Error(`Failed to send review request: ${error.message}`);
  }
}

interface MonthlyReportEmailParams {
  to: string;
  businessName: string;
  periodLabel: string;
  tiles: { label: string; value: string; change?: string | null }[];
  highlights: string[];
  reportUrl: string;
  brandColor?: string;
}

/** The 1st-of-month "here's what happened" email, with a link to the full report. */
export async function sendMonthlyReportEmail({ to, businessName, periodLabel, tiles, highlights, reportUrl, brandColor = '#00ef99' }: MonthlyReportEmailParams) {
  const resend = getResendClient();
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tileCells = tiles.map(
    (t) => `<td style="padding: 6px; width: 33%;"><div style="background:#f9fafb;border-radius:12px;padding:14px 12px;text-align:center;">
        <div style="font-size:26px;font-weight:800;color:#111827;line-height:1;">${esc(t.value)}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:6px;">${esc(t.label)}</div>
        ${t.change ? `<div style="font-size:12px;color:${t.change.startsWith('-') ? '#b91c1c' : '#047857'};margin-top:2px;">${esc(t.change)} vs last month</div>` : ''}
      </div></td>`
  );
  const rows: string[] = [];
  for (let i = 0; i < tileCells.length; i += 3) rows.push(`<tr>${tileCells.slice(i, i + 3).join('')}</tr>`);

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'GrowLocal 360 <noreply@send.growlocal360.com>',
    to,
    subject: `${businessName}: your ${periodLabel} numbers`,
    html: `
      <div style="${EMAIL_STYLES}">
        <h2 style="color:#111827;margin-bottom:4px;">${esc(periodLabel)} at a glance</h2>
        <p style="color:#4b5563;font-size:15px;margin-top:0;">${esc(businessName)}</p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:separate;margin:16px 0;">${rows.join('')}</table>
        ${highlights.length ? `<ul style="color:#374151;font-size:15px;line-height:1.5;padding-left:20px;">${highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
        <div style="margin:24px 0;">
          <a href="${reportUrl}" style="display:inline-block;background-color:${brandColor};color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">See the full report</a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;" />
        <p style="color:#9ca3af;font-size:12px;">${esc(businessName)} &mdash; Powered by GrowLocal 360</p>
      </div>
    `,
  });
  if (error) {
    console.error('Failed to send monthly report email:', error);
    throw new Error(`Failed to send monthly report: ${error.message}`);
  }
}

interface WeeklyDigestEmailParams {
  to: string;
  businessName: string;
  rangeLabel: string;
  lines: string[];
  pendingApprovals: number;
  profileChanges: { label: string; before: string; after: string }[];
  automationUrl: string;
  brandColor?: string;
}

/** Monday morning "last week in one screen" email. Only sent when there is something to say. */
export async function sendWeeklyDigestEmail({ to, businessName, rangeLabel, lines, pendingApprovals, profileChanges, automationUrl, brandColor = '#00ef99' }: WeeklyDigestEmailParams) {
  const resend = getResendClient();
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'GrowLocal 360 <noreply@send.growlocal360.com>',
    to,
    subject: `${businessName}: last week in 30 seconds`,
    html: `
      <div style="${EMAIL_STYLES}">
        <h2 style="color:#111827;margin-bottom:4px;">Last week at ${esc(businessName)}</h2>
        <p style="color:#6b7280;font-size:13px;margin-top:0;">${esc(rangeLabel)}</p>
        <ul style="color:#374151;font-size:15px;line-height:1.6;padding-left:20px;">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        ${pendingApprovals > 0 ? `<div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:10px;padding:12px 16px;margin:16px 0;color:#92400e;font-size:14px;"><strong>${pendingApprovals} item${pendingApprovals === 1 ? '' : 's'} waiting for your OK</strong>: review replies, posts or photos drafted for you. They go out only when you approve them.</div>` : ''}
        ${profileChanges.length ? `<div style="background:#fef2f2;border:1px solid #ef4444;border-radius:10px;padding:12px 16px;margin:16px 0;color:#7f1d1d;font-size:14px;"><strong>Your Google profile changed</strong><ul style="margin:8px 0 0;padding-left:18px;">${profileChanges.map((c) => `<li>${esc(c.label)}: ${esc(c.before)} &rarr; ${esc(c.after)}</li>`).join('')}</ul><div style="margin-top:6px;">If you did not make these changes, fix them on Google now.</div></div>` : ''}
        <div style="margin:24px 0;">
          <a href="${automationUrl}" style="display:inline-block;background-color:${brandColor};color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${pendingApprovals > 0 ? 'Review and approve' : 'Open the dashboard'}</a>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;" />
        <p style="color:#9ca3af;font-size:12px;">${esc(businessName)} &mdash; Powered by GrowLocal 360</p>
      </div>
    `,
  });
  if (error) {
    console.error('Failed to send weekly digest:', error);
    throw new Error(`Failed to send weekly digest: ${error.message}`);
  }
}

interface ProfileChangeAlertEmailParams {
  to: string;
  businessName: string;
  changes: { label: string; before: string; after: string }[];
  mapsUrl: string | null;
  brandColor?: string;
}

/** Same-day alert when a watched field on the Google Business Profile changed. */
export async function sendProfileChangeAlertEmail({ to, businessName, changes, mapsUrl, brandColor = '#00ef99' }: ProfileChangeAlertEmailParams) {
  const resend = getResendClient();
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'GrowLocal 360 <noreply@send.growlocal360.com>',
    to,
    subject: `Your Google Business Profile changed: ${changes.map((c) => c.label.toLowerCase()).join(', ')}`,
    html: `
      <div style="${EMAIL_STYLES}">
        <h2 style="color:#111827;margin-bottom:8px;">Something changed on the Google profile for ${esc(businessName)}</h2>
        <p style="color:#4b5563;font-size:15px;">We check it every night. Since yesterday:</p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;color:#374151;">
          ${changes.map((c) => `<tr><td style="padding:8px 0;border-top:1px solid #e5e7eb;font-weight:600;width:34%;vertical-align:top;">${esc(c.label)}</td><td style="padding:8px 0;border-top:1px solid #e5e7eb;vertical-align:top;"><span style="color:#9ca3af;text-decoration:line-through;">${esc(c.before)}</span><br/>${esc(c.after)}</td></tr>`).join('')}
        </table>
        <p style="color:#4b5563;font-size:14px;">If you made this change, nothing to do. If you did not, Google may have applied a suggested edit; change it back on your profile.</p>
        ${mapsUrl ? `<div style="margin:24px 0;"><a href="${mapsUrl}" style="display:inline-block;background-color:${brandColor};color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Open the profile</a></div>` : ''}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;" />
        <p style="color:#9ca3af;font-size:12px;">${esc(businessName)} &mdash; Powered by GrowLocal 360</p>
      </div>
    `,
  });
  if (error) {
    console.error('Failed to send profile change alert:', error);
    throw new Error(`Failed to send profile change alert: ${error.message}`);
  }
}
