import { inngest } from '@/lib/inngest/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { signWebhookPayload } from '@/lib/webhooks/sign';
import type { WebhookEventType } from '@/types/database';

interface WebhookDispatchEvent {
  data: {
    siteId: string;
    eventType: WebhookEventType;
    payload: Record<string, unknown>;
  };
}

/**
 * webhook/dispatch — Fan out a single event to every active endpoint
 * registered for the site. Each delivery is sent as its own event so it
 * can retry independently.
 */
export const dispatchWebhook = inngest.createFunction(
  { id: 'webhook-dispatch', name: 'Dispatch Webhook to Endpoints' },
  { event: 'webhook/dispatch' },
  async ({ event, step }: { event: WebhookDispatchEvent; step: any }) => {
    const { siteId, eventType, payload } = event.data;
    const supabase = createAdminClient();

    const endpoints = await step.run('load-endpoints', async () => {
      const { data } = await supabase
        .from('webhook_endpoints')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_active', true);

      return (data || []).filter((ep: { events: string[] }) =>
        Array.isArray(ep.events) && ep.events.includes(eventType)
      );
    });

    if (endpoints.length === 0) return { dispatched: 0 };

    await Promise.all(
      endpoints.map((endpoint: { id: string }) =>
        step.sendEvent(`fanout-${endpoint.id}`, {
          name: 'webhook/deliver',
          data: { endpointId: endpoint.id, eventType, payload },
        })
      )
    );

    return { dispatched: endpoints.length };
  }
);

interface WebhookDeliverEvent {
  data: {
    endpointId: string;
    eventType: WebhookEventType;
    payload: Record<string, unknown>;
  };
}

/**
 * webhook/deliver — POST a single signed payload to one endpoint.
 * Inngest auto-retries failed runs (default: 4 attempts with backoff).
 */
export const deliverWebhook = inngest.createFunction(
  { id: 'webhook-deliver', name: 'Deliver Webhook', retries: 4 },
  { event: 'webhook/deliver' },
  async ({ event, step }: { event: WebhookDeliverEvent; step: any }) => {
    const { endpointId, eventType, payload } = event.data;
    const supabase = createAdminClient();

    const endpoint = await step.run('load-endpoint', async () => {
      const { data } = await supabase
        .from('webhook_endpoints')
        .select('*')
        .eq('id', endpointId)
        .single();
      return data;
    });

    if (!endpoint || !endpoint.is_active) return { skipped: true };

    // Create delivery row up front so we always have an audit trail
    const deliveryId = await step.run('record-delivery', async () => {
      const { data } = await supabase
        .from('webhook_deliveries')
        .insert({
          webhook_endpoint_id: endpointId,
          event_type: eventType,
          payload,
          status: 'pending',
          attempts: 0,
        })
        .select('id')
        .single();
      return data?.id as string;
    });

    const body = JSON.stringify({
      id: deliveryId,
      type: eventType,
      created_at: new Date().toISOString(),
      data: payload,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhookPayload(body, endpoint.secret, timestamp);

    const result = await step.run('post-webhook', async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': eventType,
            'User-Agent': 'GrowLocal360-Webhook/1.0',
          },
          body,
          signal: controller.signal,
        });
        const text = await res.text().catch(() => '');
        return { status: res.status, body: text.slice(0, 1000), ok: res.ok };
      } finally {
        clearTimeout(timer);
      }
    });

    await step.run('update-delivery', async () => {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: result.ok ? 'delivered' : 'failed',
          attempts: 1,
          last_attempt_at: new Date().toISOString(),
          response_status: result.status,
          response_body: result.body,
        })
        .eq('id', deliveryId);
    });

    if (!result.ok) {
      // Throw to trigger Inngest retry
      throw new Error(`Webhook returned ${result.status}: ${result.body}`);
    }

    return { delivered: true, status: result.status };
  }
);
