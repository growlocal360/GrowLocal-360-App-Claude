import { inngest } from '@/lib/inngest/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { serializeJobSnapPublic } from '@/lib/api-keys/serialize-snap';
import type { JobSnapWithRelations, WebhookEventType } from '@/types/database';

/**
 * Fire a webhook event for a job snap. Pulls the snap with media, serializes
 * it to the public shape, and dispatches via Inngest. Fan-out + delivery
 * happens asynchronously.
 *
 * Safe to await without blocking — Inngest event send is fast and any
 * failure here just means the webhook didn't fire (we never want to fail
 * a publish operation because a customer's webhook URL is broken).
 */
export async function emitJobSnapEvent(
  eventType: WebhookEventType,
  jobSnapId: string
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data: snap } = await supabase
      .from('job_snaps')
      .select('*, media:job_snap_media(*)')
      .eq('id', jobSnapId)
      .single();

    if (!snap) return;

    const payload = serializeJobSnapPublic(snap as JobSnapWithRelations);

    await inngest.send({
      name: 'webhook/dispatch',
      data: {
        siteId: snap.site_id,
        eventType,
        payload,
      },
    });
  } catch (err) {
    console.error(`emitJobSnapEvent(${eventType}, ${jobSnapId}) failed:`, err);
  }
}
