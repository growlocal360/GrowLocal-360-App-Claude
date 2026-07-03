import { inngest } from '@/lib/inngest/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNewLeadNotificationEmail } from '@/lib/email/resend';
import { sendSMS } from '@/lib/sms/twilio';

/**
 * lead/created — instant notifications when a new public lead comes in.
 *
 * Resolution order for the notification email:
 *   1. site.settings.lead_notification_email (per-site override)
 *   2. scheduling_configs.notification_email (reuses the booking notif address)
 *   3. The org owner's auth email (zero-config fallback)
 *
 * SMS is only sent if a phone is configured AND the site has a Twilio number
 * (reuses scheduling_configs.twilio_phone_number — leads piggyback on the
 * same provisioned number).
 */
export const handleLeadCreated = inngest.createFunction(
  { id: 'lead-created-notifications', name: 'Lead Created Notifications' },
  { event: 'lead/created' },
  async ({ event, step }) => {
    const { leadId, siteId, isTest } = event.data as { leadId: string; siteId: string; isTest?: boolean };
    const supabase = createAdminClient();

    const data = await step.run('load-data', async () => {
      const [{ data: lead }, { data: site }, { data: config }] = await Promise.all([
        supabase.from('leads').select('*').eq('id', leadId).single(),
        supabase.from('sites').select('id, name, settings, organization_id, slug').eq('id', siteId).single(),
        supabase.from('scheduling_configs').select('notification_email, notification_phone, twilio_phone_number').eq('site_id', siteId).maybeSingle(),
      ]);

      if (!site) return { lead, site: null, config, ownerEmail: null };

      // Find org owner email as ultimate fallback
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('organization_id', site.organization_id)
        .eq('role', 'owner')
        .limit(1)
        .maybeSingle();

      let ownerEmail: string | null = null;
      if (ownerProfile?.user_id) {
        const { data: authUser } = await supabase.auth.admin.getUserById(ownerProfile.user_id);
        ownerEmail = authUser.user?.email || null;
      }

      return { lead, site, config, ownerEmail };
    });

    if (!data.lead || !data.site) {
      console.warn('[lead-notifications] Skipping — lead or site not found', { leadId, siteId });
      return;
    }

    const { lead, site, config, ownerEmail } = data;
    const settings = (site.settings || {}) as Record<string, unknown>;

    const emailTo =
      (typeof settings.lead_notification_email === 'string' && settings.lead_notification_email) ||
      config?.notification_email ||
      ownerEmail;

    const smsTo =
      (typeof settings.lead_notification_phone === 'string' && settings.lead_notification_phone) ||
      config?.notification_phone ||
      null;

    const brandColor = (typeof settings.brand_color === 'string' && settings.brand_color) || '#00ef99';
    // Admin dashboard URL — must use NEXT_PUBLIC_APP_URL (the admin host,
    // app.growlocal360.com), NOT NEXT_PUBLIC_APP_DOMAIN (the public-site
    // host group, goleadflow.com). Concatenating against the public domain
    // would produce a dead link since the dashboard lives at app.*.
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.growlocal360.com').replace(/\/+$/, '');
    const dashboardUrl = `${appUrl}/dashboard/sites/${site.id}/leads`;

    // Email notification
    if (emailTo) {
      await step.run('email-owner', async () => {
        await sendNewLeadNotificationEmail({
          to: emailTo,
          businessName: site.name,
          leadName: lead.name,
          leadPhone: lead.phone,
          leadEmail: lead.email,
          serviceType: lead.service_type,
          message: lead.message,
          address: lead.address,
          metadata: lead.metadata,
          sourcePage: lead.source_page,
          dashboardUrl,
          brandColor,
          isTest: Boolean(isTest),
        });
      });
    } else {
      console.warn('[lead-notifications] No email recipient resolved for lead', { leadId, siteId });
    }

    // SMS notification (best-effort — only if Twilio number was provisioned for this site)
    if (smsTo && config?.twilio_phone_number) {
      await step.run('sms-owner', async () => {
        const phonePart = lead.phone ? ` Phone: ${lead.phone}.` : '';
        const servicePart = lead.service_type ? ` Service: ${lead.service_type}.` : '';
        await sendSMS({
          to: smsTo,
          body: `${isTest ? '[TEST] ' : ''}New lead from ${site.name}: ${lead.name}.${phonePart}${servicePart} View: ${dashboardUrl}`,
          from: config.twilio_phone_number,
        });
      });
    }
  }
);
