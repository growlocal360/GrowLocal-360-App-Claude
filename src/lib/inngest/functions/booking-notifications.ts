import { inngest } from '@/lib/inngest/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendSMS } from '@/lib/sms/twilio';
import {
  sendNewBookingNotificationEmail,
  sendBookingConfirmationEmail,
  sendSlotUnavailableEmail,
  sendAppointmentReminderEmail,
  sendDailyScheduleSummaryEmail,
} from '@/lib/email/resend';

// ============================================================
// Helper: format time for SMS
// ============================================================
function fmtTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, '0')}${ampm}`;
}

function fmtDate(d: string): string {
  const [year, month, day] = d.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

// ============================================================
// 1. booking/created — Instant notifications
// ============================================================
export const handleBookingCreated = inngest.createFunction(
  { id: 'booking-created-notifications', name: 'Booking Created Notifications' },
  { event: 'booking/created' },
  async ({ event, step }) => {
    const { appointmentId, siteId } = event.data;
    const supabase = createAdminClient();

    // Load appointment + config + site info
    const data = await step.run('load-data', async () => {
      const [{ data: appointment }, { data: config }, { data: site }] = await Promise.all([
        supabase.from('appointments').select('*').eq('id', appointmentId).single(),
        supabase.from('scheduling_configs').select('*').eq('site_id', siteId).single(),
        supabase.from('sites').select('name, settings').eq('id', siteId).single(),
      ]);
      return { appointment, config, site };
    });

    if (!data.appointment || !data.config || !data.site) return;

    const { appointment, config, site } = data;
    const businessName = site.name;
    const businessPhone = (site.settings as Record<string, string>)?.phone || '';
    const timeStr = appointment.scheduled_time
      ? fmtTime(appointment.scheduled_time)
      : (appointment.time_window_start && appointment.time_window_end)
        ? `${fmtTime(appointment.time_window_start)}-${fmtTime(appointment.time_window_end)}`
        : '';

    // Notify business owner — SMS
    if (config.notification_phone && config.twilio_phone_number) {
      await step.run('sms-owner', async () => {
        const statusNote = config.booking_mode === 'approval'
          ? 'Log in to approve.'
          : 'Auto-confirmed.';
        await sendSMS({
          to: config.notification_phone!,
          body: `New booking! ${appointment.customer_name} wants ${appointment.service_type || 'service'} on ${fmtDate(appointment.scheduled_date)} ${timeStr}. Phone: ${appointment.customer_phone || 'N/A'}. ${statusNote}`,
          from: config.twilio_phone_number!,
        });
      });
    }

    // Notify business owner — Email
    if (config.notification_email) {
      await step.run('email-owner', async () => {
        await sendNewBookingNotificationEmail({
          to: config.notification_email!,
          customerName: appointment.customer_name,
          businessName,
          serviceName: appointment.service_type,
          scheduledDate: appointment.scheduled_date,
          scheduledTime: appointment.scheduled_time,
          windowStart: appointment.time_window_start,
          windowEnd: appointment.time_window_end,
          customerPhone: appointment.customer_phone,
          customerEmail: appointment.customer_email,
          notes: appointment.notes,
        });
      });
    }

    // If instant confirm — send confirmation to customer
    if (appointment.status === 'confirmed') {
      if (appointment.customer_phone && config.twilio_phone_number) {
        await step.run('sms-customer-confirm', async () => {
          await sendSMS({
            to: appointment.customer_phone!,
            body: `Your appointment with ${businessName} is confirmed for ${fmtDate(appointment.scheduled_date)} ${timeStr}. ${businessPhone ? `Call ${businessPhone} to reschedule.` : ''} Reply to this text with questions.`,
            from: config.twilio_phone_number!,
          });
        });
      }

      if (appointment.customer_email) {
        await step.run('email-customer-confirm', async () => {
          await sendBookingConfirmationEmail({
            to: appointment.customer_email!,
            customerName: appointment.customer_name,
            businessName,
            serviceName: appointment.service_type,
            scheduledDate: appointment.scheduled_date,
            scheduledTime: appointment.scheduled_time,
            windowStart: appointment.time_window_start,
            windowEnd: appointment.time_window_end,
          });
        });
      }

      // Mark confirmation sent
      await step.run('mark-confirmation-sent', async () => {
        await supabase
          .from('appointments')
          .update({ confirmation_sent: true })
          .eq('id', appointmentId);
      });
    }
  }
);

// ============================================================
// 2. booking/approved — Confirmation to customer
// ============================================================
export const handleBookingApproved = inngest.createFunction(
  { id: 'booking-approved-notifications', name: 'Booking Approved Notifications' },
  { event: 'booking/approved' },
  async ({ event, step }) => {
    const { appointmentId, siteId } = event.data;
    const supabase = createAdminClient();

    const data = await step.run('load-data', async () => {
      const [{ data: appointment }, { data: config }, { data: site }] = await Promise.all([
        supabase.from('appointments').select('*').eq('id', appointmentId).single(),
        supabase.from('scheduling_configs').select('twilio_phone_number').eq('site_id', siteId).single(),
        supabase.from('sites').select('name, settings').eq('id', siteId).single(),
      ]);
      return { appointment, config, site };
    });

    if (!data.appointment || !data.site) return;
    const { appointment, config, site } = data;
    const businessName = site.name;
    const businessPhone = (site.settings as Record<string, string>)?.phone || '';
    const timeStr = appointment.scheduled_time
      ? fmtTime(appointment.scheduled_time)
      : `${fmtTime(appointment.time_window_start)}-${fmtTime(appointment.time_window_end)}`;

    // SMS to customer
    if (appointment.customer_phone && config?.twilio_phone_number) {
      await step.run('sms-customer', async () => {
        await sendSMS({
          to: appointment.customer_phone!,
          body: `Great news! Your appointment with ${businessName} is confirmed for ${fmtDate(appointment.scheduled_date)} ${timeStr}. ${businessPhone ? `Call ${businessPhone} to reschedule.` : ''} Reply to this text with questions.`,
          from: config!.twilio_phone_number!,
        });
      });
    }

    // Email to customer
    if (appointment.customer_email) {
      await step.run('email-customer', async () => {
        await sendBookingConfirmationEmail({
          to: appointment.customer_email!,
          customerName: appointment.customer_name,
          businessName,
          serviceName: appointment.service_type,
          scheduledDate: appointment.scheduled_date,
          scheduledTime: appointment.scheduled_time,
          windowStart: appointment.time_window_start,
          windowEnd: appointment.time_window_end,
        });
      });
    }

    // Mark confirmation sent
    await step.run('mark-sent', async () => {
      await supabase
        .from('appointments')
        .update({ confirmation_sent: true })
        .eq('id', appointmentId);
    });
  }
);

// ============================================================
// 3. booking/declined — Notify customer with alternatives
// ============================================================
export const handleBookingDeclined = inngest.createFunction(
  { id: 'booking-declined-notifications', name: 'Booking Declined Notifications' },
  { event: 'booking/declined' },
  async ({ event, step }) => {
    const { appointmentId, siteId } = event.data;
    const supabase = createAdminClient();

    const data = await step.run('load-data', async () => {
      const [{ data: appointment }, { data: config }, { data: site }] = await Promise.all([
        supabase.from('appointments').select('*').eq('id', appointmentId).single(),
        supabase.from('scheduling_configs').select('twilio_phone_number').eq('site_id', siteId).single(),
        supabase.from('sites').select('name, settings').eq('id', siteId).single(),
      ]);
      return { appointment, config, site };
    });

    if (!data.appointment || !data.site) return;
    const { appointment, config, site } = data;
    const businessName = site.name;
    const businessPhone = (site.settings as Record<string, string>)?.phone || '';

    // SMS to customer
    if (appointment.customer_phone && config?.twilio_phone_number) {
      await step.run('sms-customer', async () => {
        await sendSMS({
          to: appointment.customer_phone!,
          body: `Hi ${appointment.customer_name}, unfortunately the time you requested with ${businessName} is no longer available. ${businessPhone ? `Please call ${businessPhone} or visit our website to choose another time.` : 'Please visit our website to choose another time.'}`,
          from: config!.twilio_phone_number!,
        });
      });
    }

    // Email to customer
    if (appointment.customer_email) {
      await step.run('email-customer', async () => {
        await sendSlotUnavailableEmail({
          to: appointment.customer_email!,
          customerName: appointment.customer_name,
          businessName,
          scheduledDate: appointment.scheduled_date,
        });
      });
    }
  }
);

// ============================================================
// 4. Cron: Send appointment reminders (hourly)
// ============================================================
export const sendReminders = inngest.createFunction(
  { id: 'scheduling-send-reminders', name: 'Send Appointment Reminders' },
  { cron: '0 * * * *' }, // Every hour
  async ({ step }) => {
    const supabase = createAdminClient();

    // Get tomorrow's date and today's date
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    // 24hr reminders — appointments tomorrow that haven't been reminded
    const { data: tomorrowAppts } = await step.run('fetch-24hr', async () => {
      return supabase
        .from('appointments')
        .select('*, site:sites(name, settings)')
        .eq('scheduled_date', tomorrowStr)
        .eq('status', 'confirmed')
        .eq('reminder_24h_sent', false);
    });

    for (const appt of (tomorrowAppts || [])) {
      const siteData = appt.site as { name: string; settings: Record<string, string> } | null;
      if (!siteData) continue;

      // Get Twilio number for this site
      const { data: config } = await supabase
        .from('scheduling_configs')
        .select('twilio_phone_number')
        .eq('site_id', appt.site_id)
        .single();

      const timeStr = appt.scheduled_time
        ? fmtTime(appt.scheduled_time)
        : `${fmtTime(appt.time_window_start)}-${fmtTime(appt.time_window_end)}`;

      // SMS reminder
      if (appt.customer_phone && config?.twilio_phone_number) {
        await step.run(`reminder-24h-sms-${appt.id}`, async () => {
          await sendSMS({
            to: appt.customer_phone,
            body: `Reminder: Your appointment with ${siteData.name} is tomorrow, ${fmtDate(appt.scheduled_date)} ${timeStr}. ${siteData.settings?.phone ? `Call ${siteData.settings.phone} to reschedule.` : ''}`,
            from: config.twilio_phone_number!,
          });
        });
      }

      // Email reminder
      if (appt.customer_email) {
        await step.run(`reminder-24h-email-${appt.id}`, async () => {
          await sendAppointmentReminderEmail({
            to: appt.customer_email,
            customerName: appt.customer_name,
            businessName: siteData.name,
            serviceName: appt.service_type,
            scheduledDate: appt.scheduled_date,
            scheduledTime: appt.scheduled_time,
            windowStart: appt.time_window_start,
            windowEnd: appt.time_window_end,
            reminderType: '24hr',
          });
        });
      }

      // Mark sent
      await step.run(`mark-24h-sent-${appt.id}`, async () => {
        await supabase
          .from('appointments')
          .update({ reminder_24h_sent: true })
          .eq('id', appt.id);
      });
    }

    // Day-of reminders — appointments today that haven't been reminded
    const { data: todayAppts } = await step.run('fetch-dayof', async () => {
      return supabase
        .from('appointments')
        .select('*, site:sites(name, settings)')
        .eq('scheduled_date', todayStr)
        .eq('status', 'confirmed')
        .eq('reminder_dayof_sent', false);
    });

    for (const appt of (todayAppts || [])) {
      const siteData = appt.site as { name: string; settings: Record<string, string> } | null;
      if (!siteData) continue;

      const { data: config } = await supabase
        .from('scheduling_configs')
        .select('twilio_phone_number')
        .eq('site_id', appt.site_id)
        .single();

      const timeStr = appt.scheduled_time
        ? fmtTime(appt.scheduled_time)
        : `${fmtTime(appt.time_window_start)}-${fmtTime(appt.time_window_end)}`;

      if (appt.customer_phone && config?.twilio_phone_number) {
        await step.run(`reminder-dayof-sms-${appt.id}`, async () => {
          await sendSMS({
            to: appt.customer_phone,
            body: `Today's the day! Your ${appt.service_type || 'service'} appointment with ${siteData.name} is at ${timeStr}. We look forward to seeing you!`,
            from: config.twilio_phone_number!,
          });
        });
      }

      if (appt.customer_email) {
        await step.run(`reminder-dayof-email-${appt.id}`, async () => {
          await sendAppointmentReminderEmail({
            to: appt.customer_email,
            customerName: appt.customer_name,
            businessName: siteData.name,
            serviceName: appt.service_type,
            scheduledDate: appt.scheduled_date,
            scheduledTime: appt.scheduled_time,
            windowStart: appt.time_window_start,
            windowEnd: appt.time_window_end,
            reminderType: 'dayof',
          });
        });
      }

      await step.run(`mark-dayof-sent-${appt.id}`, async () => {
        await supabase
          .from('appointments')
          .update({ reminder_dayof_sent: true })
          .eq('id', appt.id);
      });
    }
  }
);

// ============================================================
// 5. Cron: Daily schedule digest (6:00 AM ET)
// ============================================================
export const dailyScheduleDigest = inngest.createFunction(
  { id: 'scheduling-daily-digest', name: 'Daily Schedule Digest' },
  { cron: '0 10 * * *' }, // 10:00 UTC = ~6:00 AM ET
  async ({ step }) => {
    const supabase = createAdminClient();
    const todayStr = new Date().toISOString().split('T')[0];

    // Get all active scheduling configs
    const { data: configs } = await step.run('fetch-configs', async () => {
      return supabase
        .from('scheduling_configs')
        .select('*, site:sites(id, name, settings)')
        .eq('is_active', true)
        .not('notification_email', 'is', null);
    });

    for (const config of (configs || [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const siteData = config.site as any;
      if (!siteData) continue;

      // Get today's appointments for this site
      const { data: appointments } = await supabase
        .from('appointments')
        .select('customer_name, service_type, scheduled_time, time_window_start, time_window_end, customer_phone, staff_member_id')
        .eq('site_id', siteData.id)
        .eq('scheduled_date', todayStr)
        .in('status', ['confirmed', 'pending'])
        .order('scheduled_time', { nullsFirst: false });

      const digestAppts = (appointments || []).map(a => ({
        customerName: a.customer_name,
        serviceName: a.service_type,
        time: a.scheduled_time
          ? fmtTime(a.scheduled_time)
          : `${fmtTime(a.time_window_start)}-${fmtTime(a.time_window_end)}`,
        phone: a.customer_phone,
      }));

      // Send digest to owner
      if (config.notification_email) {
        await step.run(`digest-email-${siteData.id}`, async () => {
          await sendDailyScheduleSummaryEmail({
            to: config.notification_email!,
            recipientName: 'there',
            businessName: siteData.name,
            date: todayStr,
            appointments: digestAppts,
          });
        });
      }

      // Send SMS digest to owner
      if (config.notification_phone && config.twilio_phone_number) {
        await step.run(`digest-sms-${siteData.id}`, async () => {
          const count = digestAppts.length;
          const summary = count > 0
            ? digestAppts.slice(0, 5).map(a => `${a.time} ${a.customerName}`).join(', ')
            : 'No appointments';

          await sendSMS({
            to: config.notification_phone!,
            body: `Good morning! You have ${count} appointment${count !== 1 ? 's' : ''} today: ${summary}${count > 5 ? ` +${count - 5} more` : ''}. Check your dashboard for details.`,
            from: config.twilio_phone_number!,
          });
        });
      }
    }
  }
);
