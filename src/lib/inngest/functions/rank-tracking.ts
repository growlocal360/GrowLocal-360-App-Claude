import { inngest } from '@/lib/inngest/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { runRankScans } from '@/lib/rank/scan';
import { runAiVisibility } from '@/lib/rank/ai-visibility';

/** 1st of the month, 3:00 ET (before the 8:00 report): grid scans + AI checks for every active site. */
export const rankTrackingMonthly = inngest.createFunction(
  { id: 'rank-tracking-monthly', name: 'Maps grid scans + AI visibility', concurrency: { limit: 2 } },
  { cron: 'TZ=America/New_York 0 3 1 * *' },
  async ({ step }) => {
    const supabase = createAdminClient();
    const siteIds = await step.run('list-sites', async () => {
      const { data } = await supabase.from('sites').select('id').eq('status', 'active');
      return (data || []).map((s) => s.id as string);
    });
    const results: { siteId: string; scans?: string; ai?: string }[] = [];
    for (const siteId of siteIds) {
      const scans = await step.run(`scan-${siteId}`, () => runRankScans(supabase, siteId));
      const ai = await step.run(`ai-${siteId}`, () => runAiVisibility(supabase, siteId));
      results.push({
        siteId,
        scans: scans.skipped || `${scans.results.filter((r) => !r.error).length}/${scans.results.length} keywords, $${scans.totalCost.toFixed(2)}`,
        ai: ai.skipped || `${ai.checks.filter((c) => c.mentioned).length}/${ai.checks.length} prompts mention the business`,
      });
    }
    return { sites: results.length, results };
  }
);

/** "Scan now" from the dashboard. */
export const rankTrackingRequested = inngest.createFunction(
  { id: 'rank-tracking-requested', name: 'Rank scan on demand' },
  { event: 'rank/scan.requested' },
  async ({ event, step }) => {
    const { siteId, keywords, ai } = event.data as { siteId: string; keywords?: string[]; ai?: boolean };
    const supabase = createAdminClient();
    const scans = await step.run(`scan-${siteId}`, () => runRankScans(supabase, siteId, keywords));
    const aiRes = ai === false ? null : await step.run(`ai-${siteId}`, () => runAiVisibility(supabase, siteId));
    return { scans, ai: aiRes };
  }
);
