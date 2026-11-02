import { inngest } from '@/lib/inngest/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateAndSaveMonthlyReport, previousMonthKey, currentMonthKey, reportHighlights, pctChange } from '@/lib/reports/monthly';
import { resolveOwnerEmail } from '@/lib/sites/owner-email';
import { sendMonthlyReportEmail } from '@/lib/email/resend';

/** 1st of the month, 8:00 ET: last month's report for every active site, emailed to the owner. */
export const monthlyReports = inngest.createFunction(
  { id: 'monthly-reports', name: 'Monthly owner reports', concurrency: { limit: 2 } },
  { cron: 'TZ=America/New_York 0 8 1 * *' },
  async ({ step }) => {
    const supabase = createAdminClient();
    const key = previousMonthKey(currentMonthKey());
    const siteIds = await step.run('list-sites', async () => {
      const { data } = await supabase.from('sites').select('id').eq('status', 'active');
      return (data || []).map((s) => s.id as string);
    });
    const results: { siteId: string; emailed: boolean; error?: string }[] = [];
    for (const siteId of siteIds) {
      results.push(
        await step.run(`report-${siteId}`, async () => {
          try {
            const data = await generateAndSaveMonthlyReport(supabase, siteId, key);
            const to = await resolveOwnerEmail(supabase, siteId);
            if (!to) return { siteId, emailed: false, error: 'no owner email' };
            const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.growlocal360.com').replace(/\/+$/, '');
            const fmtChange = (c: number, p: number) => { const pc = pctChange(c, p); return pc === null ? null : `${pc >= 0 ? '+' : ''}${pc}%`; };
            const tiles = [
              ...(data.google.available
                ? [
                    { label: 'Views on Google', value: data.google.impressions.toLocaleString(), change: fmtChange(data.google.impressions, data.previous.google.impressions) },
                    { label: 'Calls from Google', value: String(data.google.calls), change: fmtChange(data.google.calls, data.previous.google.calls) },
                    { label: 'Direction requests', value: String(data.google.directions), change: fmtChange(data.google.directions, data.previous.google.directions) },
                  ]
                : []),
              ...(data.search.available ? [{ label: 'Website clicks from search', value: data.search.clicks.toLocaleString(), change: fmtChange(data.search.clicks, data.previous.search.clicks) }] : []),
              { label: 'Leads', value: String(data.leads.total), change: fmtChange(data.leads.total, data.previous.leads) },
              { label: 'New reviews', value: String(data.reviews.newCount), change: fmtChange(data.reviews.newCount, data.previous.newReviews) },
            ].slice(0, 6);
            const { data: site } = await supabase.from('sites').select('settings').eq('id', siteId).single();
            await sendMonthlyReportEmail({
              to,
              businessName: data.siteName,
              periodLabel: data.period.label,
              tiles,
              highlights: reportHighlights(data),
              reportUrl: `${appUrl}/dashboard/sites/${siteId}/reports?period=${key}`,
              brandColor: ((site?.settings as { brand_color?: string } | null)?.brand_color) || '#00ef99',
            });
            await supabase.from('site_reports').update({ emailed_at: new Date().toISOString() }).eq('site_id', siteId).eq('period_key', key);
            return { siteId, emailed: true };
          } catch (e) {
            return { siteId, emailed: false, error: e instanceof Error ? e.message : String(e) };
          }
        })
      );
    }
    return { period: key, sites: results.length, emailed: results.filter((r) => r.emailed).length, results };
  }
);

/** "Refresh" from the dashboard: regenerate one site + month, no email. */
export const monthlyReportRequested = inngest.createFunction(
  { id: 'monthly-report-requested', name: 'Monthly report on demand' },
  { event: 'reports/generate.requested' },
  async ({ event, step }) => {
    const { siteId, period } = event.data as { siteId: string; period: string };
    return step.run(`report-${siteId}-${period}`, async () => {
      const data = await generateAndSaveMonthlyReport(createAdminClient(), siteId, period);
      return { period, generatedAt: data.generatedAt, notes: data.notes };
    });
  }
);
