import type { GetStepTools } from 'inngest';
import { inngest } from '@/lib/inngest/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { prepareRankScan, scanKeyword, recordLastRun, type SiteScanRun } from '@/lib/rank/scan';
import { runAiVisibility, AI_RECHECK_CREDITS } from '@/lib/rank/ai-visibility';
import { grantCredits, orgIdForSite } from '@/lib/rank/credits';

type StepRunner = GetStepTools<typeof inngest>;

/**
 * One Inngest step per keyword. A 9×9 grid is 81 Maps requests per keyword
 * (about a minute), so a whole site in one step could outlive a function
 * invocation and a retry would redo paid work. Per-keyword steps also let the
 * dashboard draw each heatmap as it lands.
 */
async function scanSiteInSteps(step: StepRunner, siteId: string, only?: string[]): Promise<SiteScanRun> {
  const supabase = createAdminClient();
  const prep = await step.run(`prepare-${siteId}`, () => prepareRankScan(supabase, siteId, only));
  const run: SiteScanRun = { siteId, results: [], totalCost: 0 };
  if ('skipped' in prep) {
    run.skipped = prep.skipped;
  } else {
    for (const keyword of prep.keywords) {
      const r = await step.run(`scan-${siteId}-${keyword}`, () => scanKeyword(supabase, siteId, keyword, prep.settings, prep.center, prep.businessName));
      run.results.push(r);
      run.totalCost += r.cost || 0;
    }
  }
  await step.run(`record-${siteId}`, () => recordLastRun(supabase, siteId, run));
  return run;
}

/** Weekly, Monday 3:00 ET (before the 8:00 digest; the 1st-of-month report uses the latest scans): grid scans + AI checks. Included with the plan. */
export const rankTrackingWeekly = inngest.createFunction(
  { id: 'rank-tracking-weekly', name: 'Maps grid scans + AI visibility (weekly)', concurrency: { limit: 2 } },
  { cron: 'TZ=America/New_York 0 3 * * 1' },
  async ({ step }) => {
    const supabase = createAdminClient();
    const siteIds = await step.run('list-sites', async () => {
      const { data } = await supabase.from('sites').select('id').eq('status', 'active');
      return (data || []).map((s) => s.id as string);
    });
    const results: { siteId: string; scans?: string; ai?: string }[] = [];
    for (const siteId of siteIds) {
      const scans = await scanSiteInSteps(step, siteId);
      // AI checks every other week (search-grounded calls cost more than Maps points); Maps scans stay weekly.
      const ai = await step.run(`ai-${siteId}`, () => runAiVisibility(supabase, siteId, { minIntervalDays: 13 }));
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
    const { siteId, keywords, ai, charged } = event.data as { siteId: string; keywords?: string[]; ai?: boolean; charged?: boolean };
    const supabase = createAdminClient();
    const scans = await scanSiteInSteps(step, siteId, keywords);
    // A manual scan was paid for up front: give back the credit for any keyword that did not produce a scan.
    if (charged) {
      await step.run(`refund-${siteId}`, async () => {
        const failed = scans.skipped ? (keywords?.length || 0) : scans.results.filter((r) => r.error).length;
        if (!failed) return { refunded: 0 };
        const orgId = await orgIdForSite(supabase, siteId);
        if (!orgId) return { refunded: 0 };
        await grantCredits(supabase, orgId, failed, scans.skipped ? `refund:${scans.skipped}` : 'refund:failed keywords', { siteId });
        return { refunded: failed };
      });
    }
    const aiRes = ai === false ? null : await step.run(`ai-${siteId}`, () => runAiVisibility(supabase, siteId, { minIntervalDays: 1 }));
    return { scans, ai: aiRes };
  }
);

/**
 * "Re-check AI" from the dashboard: only the AI visibility check, no grid scan.
 * Paid for up front (AI_RECHECK_CREDITS); refunded when the check is skipped or
 * no assistant answered, so a provider outage does not cost the customer.
 */
export const rankAiRequested = inngest.createFunction(
  { id: 'rank-ai-requested', name: 'AI visibility check on demand' },
  { event: 'rank/ai.requested' },
  async ({ event, step }) => {
    const { siteId, charged } = event.data as { siteId: string; charged?: number };
    const supabase = createAdminClient();
    const ai = await step.run(`ai-${siteId}`, () => runAiVisibility(supabase, siteId, { minIntervalDays: 1 }));
    const answered = ai.checks.filter((c) => !c.error).length;
    if (charged && (ai.skipped || answered === 0)) {
      await step.run(`refund-${siteId}`, async () => {
        const orgId = await orgIdForSite(supabase, siteId);
        if (!orgId) return { refunded: 0 };
        await grantCredits(supabase, orgId, charged, `refund:${ai.skipped || 'no AI assistant answered'}`, { siteId });
        return { refunded: charged };
      });
    }
    return { siteId, skipped: ai.skipped, checks: ai.checks.length, answered, credits: AI_RECHECK_CREDITS };
  }
);
