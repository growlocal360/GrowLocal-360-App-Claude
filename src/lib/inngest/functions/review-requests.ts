import { inngest } from '@/lib/inngest/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { createReviewRequest, reviewRequestSettings, sendDueFollowUps } from '@/lib/automation/review-requests';

/**
 * appointment/completed -> wait the site's delay -> queue (or send, on
 * autopilot) a review request to that customer.
 */
export const appointmentCompletedReviewRequest = inngest.createFunction(
  { id: 'review-request-after-appointment', name: 'Review request after completed appointment' },
  { event: 'appointment/completed' },
  async ({ event, step }) => {
    const { siteId, appointmentId } = event.data as { siteId: string; appointmentId: string };
    const supabase = createAdminClient();

    const plan = await step.run('check-settings', async () => {
      const { data: site } = await supabase.from('sites').select('settings').eq('id', siteId).single();
      const settings = reviewRequestSettings(site?.settings);
      return { enabled: settings.enabled, delayHours: settings.delayHours };
    });
    if (!plan.enabled) return { skipped: 'review requests off' };

    if (plan.delayHours > 0) await step.sleep('wait-delay', `${plan.delayHours}h`);

    return step.run('create-request', async () => {
      const { data: appt } = await supabase
        .from('appointments')
        .select('id, status, customer_name, customer_phone, customer_email, lead_id')
        .eq('id', appointmentId)
        .eq('site_id', siteId)
        .single();
      if (!appt) return { skipped: 'appointment gone' };
      if (appt.status !== 'completed') return { skipped: `status is ${appt.status}` };
      const result = await createReviewRequest(supabase, {
        siteId,
        source: 'appointment_completed',
        customer: { name: appt.customer_name, phone: appt.customer_phone, email: appt.customer_email },
        appointmentId: appt.id,
        leadId: appt.lead_id,
      });
      return result.ok ? { status: result.status } : { error: result.error };
    });
  }
);

/** Daily follow-up pass, 11:00 Eastern. */
export const reviewRequestFollowUps = inngest.createFunction(
  { id: 'review-request-follow-ups', name: 'Review request follow-ups' },
  { cron: 'TZ=America/New_York 0 11 * * *' },
  async ({ step }) => step.run('send-follow-ups', () => sendDueFollowUps(createAdminClient()))
);
