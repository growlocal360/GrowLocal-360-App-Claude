import { inngest } from '@/lib/inngest/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { runGbpAutomationForSite, createGbpPostDraft, queueNextPhoto, type GbpTickSummary } from '@/lib/automation/gbp-posts';

/**
 * Daily 10:00 ET: for every active site with a linked GBP location, draft the
 * weekly post and queue the next gallery photo when they are due.
 */
export const gbpAutomationDaily = inngest.createFunction(
  { id: 'gbp-automation-daily', name: 'GBP posts + photo drip', concurrency: { limit: 3 } },
  { cron: 'TZ=America/New_York 0 10 * * *' },
  async ({ step }) => {
    const supabase = createAdminClient();
    const siteIds = await step.run('list-sites', async () => {
      const { data } = await supabase
        .from('locations')
        .select('site_id, site:sites!inner(id, status)')
        .not('gbp_location_id', 'is', null)
        .not('gbp_account_id', 'is', null)
        .eq('site.status', 'active');
      return Array.from(new Set((data || []).map((r) => r.site_id as string)));
    });
    const results: GbpTickSummary[] = [];
    for (const siteId of siteIds) {
      results.push(await step.run(`tick-${siteId}`, () => runGbpAutomationForSite(supabase, siteId)));
    }
    return { sites: results.length, results };
  }
);

/** "Draft a post now" / "Queue a photo now" from the dashboard. */
export const gbpAutomationRequested = inngest.createFunction(
  { id: 'gbp-automation-requested', name: 'GBP post / photo on demand' },
  { event: 'gbp/automation.requested' },
  async ({ event, step }) => {
    const { siteId, kind } = event.data as { siteId: string; kind: 'post' | 'photo' };
    const supabase = createAdminClient();
    return step.run(`${kind}-${siteId}`, () => (kind === 'photo' ? queueNextPhoto(supabase, siteId) : createGbpPostDraft(supabase, siteId)));
  }
);
