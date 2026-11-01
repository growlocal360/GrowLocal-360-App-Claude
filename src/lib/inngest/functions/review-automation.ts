import { inngest } from '@/lib/inngest/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncSiteReviews, type SyncSummary } from '@/lib/automation/review-replies';

/**
 * Hourly: import new Google reviews for every active site with a linked GBP
 * location, draft replies, publish on autopilot where allowed. Also runs on
 * demand for one site via the `reviews/sync.requested` event ("Sync now").
 */
export const reviewAutomation = inngest.createFunction(
  { id: 'review-automation', name: 'Review import + reply drafts', concurrency: { limit: 3 } },
  [{ cron: '20 * * * *' }, { event: 'reviews/sync.requested' }],
  async ({ event, step }) => {
    const supabase = createAdminClient();
    const requested = (event?.data as { siteId?: string; includeOlder?: boolean } | undefined) || {};
    const requestedSiteId = requested.siteId;
    const includeOlder = !!requestedSiteId && !!requested.includeOlder;

    const siteIds = await step.run('list-sites', async () => {
      if (requestedSiteId) return [requestedSiteId];
      const { data } = await supabase
        .from('locations')
        .select('site_id, site:sites!inner(id, status)')
        .not('gbp_location_id', 'is', null)
        .not('gbp_account_id', 'is', null)
        .eq('site.status', 'active');
      return Array.from(new Set((data || []).map((r) => r.site_id as string)));
    });

    const results: SyncSummary[] = [];
    for (const siteId of siteIds) {
      const summary = await step.run(`sync-${siteId}`, () => syncSiteReviews(supabase, siteId, { includeOlder }));
      results.push(summary);
    }

    const totals = results.reduce(
      (acc, r) => ({
        sites: acc.sites + 1,
        imported: acc.imported + r.imported,
        drafted: acc.drafted + r.drafted,
        autoPublished: acc.autoPublished + r.autoPublished,
        alerted: acc.alerted + r.alerted,
        errors: acc.errors + r.errors.length,
      }),
      { sites: 0, imported: 0, drafted: 0, autoPublished: 0, alerted: 0, errors: 0 }
    );
    return { totals, results };
  }
);
