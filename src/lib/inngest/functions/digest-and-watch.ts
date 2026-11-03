import { inngest } from '@/lib/inngest/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildWeeklyDigest, digestHasNews } from '@/lib/reports/weekly';
import { watchSiteProfile } from '@/lib/automation/profile-watch';
import { resolveOwnerEmail } from '@/lib/sites/owner-email';
import { sendWeeklyDigestEmail, sendProfileChangeAlertEmail } from '@/lib/email/resend';
import { googleMapsUrlForPlaceId } from '@/lib/sites/profiles';
import type { SiteSettings } from '@/types/database';

type Flags = { digest?: { enabled?: boolean }; profile_alerts?: { enabled?: boolean } };
const flags = (settings: SiteSettings | null) => ((settings as { automation?: Flags } | null)?.automation) || {};
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://app.growlocal360.com').replace(/\/+$/, '');

async function activeSites() {
  const supabase = createAdminClient();
  const { data } = await supabase.from('sites').select('id, settings').eq('status', 'active');
  return (data || []) as { id: string; settings: SiteSettings | null }[];
}

/** Monday 8:00 ET: last week's digest to every owner who has it on and had any news. */
export const weeklyDigest = inngest.createFunction(
  { id: 'weekly-digest', name: 'Weekly owner digest', concurrency: { limit: 3 } },
  { cron: 'TZ=America/New_York 0 8 * * 1' },
  async ({ step }) => {
    const supabase = createAdminClient();
    const sites = await step.run('list-sites', activeSites);
    const results: { siteId: string; sent: boolean; reason?: string }[] = [];
    for (const site of sites) {
      if (flags(site.settings).digest?.enabled === false) { results.push({ siteId: site.id, sent: false, reason: 'off' }); continue; }
      results.push(
        await step.run(`digest-${site.id}`, async () => {
          try {
            const d = await buildWeeklyDigest(supabase, site.id);
            if (!digestHasNews(d)) return { siteId: site.id, sent: false, reason: 'quiet week' };
            const to = await resolveOwnerEmail(supabase, site.id);
            if (!to) return { siteId: site.id, sent: false, reason: 'no owner email' };
            const a = d.activity;
            const lines = [
              d.google.available ? `${d.google.impressions.toLocaleString()} people saw you on Google; ${d.google.calls} called, ${d.google.websiteClicks} visited the site, ${d.google.directions} asked for directions.` : null,
              d.leads || d.bookings ? `${d.leads} new lead${d.leads === 1 ? '' : 's'} and ${d.bookings} booking${d.bookings === 1 ? '' : 's'} from the website.` : null,
              d.newReviews ? `${d.newReviews} new Google review${d.newReviews === 1 ? '' : 's'}${d.newReviewAverage ? ` averaging ${d.newReviewAverage} stars` : ''}${d.unansweredReviews ? ` (${d.unansweredReviews} still unanswered)` : ''}.` : null,
              a.repliesPosted + a.requestsSent + a.postsPublished + a.photosAdded + a.jobsPublished + a.socialPosts > 0
                ? `Done for you: ${[
                    a.repliesPosted ? `${a.repliesPosted} review repl${a.repliesPosted === 1 ? 'y' : 'ies'}` : null,
                    a.requestsSent ? `${a.requestsSent} review request${a.requestsSent === 1 ? '' : 's'}` : null,
                    a.postsPublished ? `${a.postsPublished} Google post${a.postsPublished === 1 ? '' : 's'}` : null,
                    a.photosAdded ? `${a.photosAdded} photo${a.photosAdded === 1 ? '' : 's'} added to Google` : null,
                    a.socialPosts ? `${a.socialPosts} Facebook or Instagram post${a.socialPosts === 1 ? '' : 's'}` : null,
                    a.jobsPublished ? `${a.jobsPublished} job${a.jobsPublished === 1 ? '' : 's'} published` : null,
                  ].filter(Boolean).join(', ')}.`
                : null,
            ].filter((x): x is string => !!x);
            const fmt = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
            await sendWeeklyDigestEmail({
              to,
              businessName: d.siteName,
              rangeLabel: `${fmt(d.start)} to ${fmt(d.end)}`,
              lines,
              pendingApprovals: d.pendingApprovals,
              profileChanges: d.profileChanges.flatMap((c) => c.changes),
              automationUrl: `${appUrl()}/dashboard/sites/${site.id}/automation`,
              brandColor: site.settings?.brand_color || '#00ef99',
            });
            return { siteId: site.id, sent: true };
          } catch (e) {
            return { siteId: site.id, sent: false, reason: e instanceof Error ? e.message : String(e) };
          }
        })
      );
    }
    return { sites: results.length, sent: results.filter((r) => r.sent).length, results };
  }
);

/** Nightly 2:30 ET: snapshot every linked profile, email the owner the same morning when something changed. */
export const profileWatchNightly = inngest.createFunction(
  { id: 'gbp-profile-watch', name: 'GBP profile change watch', concurrency: { limit: 3 } },
  { cron: 'TZ=America/New_York 30 2 * * *' },
  async ({ step }) => {
    const supabase = createAdminClient();
    const sites = await step.run('list-sites', activeSites);
    const results: { siteId: string; status: string; alerted?: boolean }[] = [];
    for (const site of sites) {
      results.push(
        await step.run(`watch-${site.id}`, async () => {
          try {
            const r = await watchSiteProfile(supabase, site.id);
            if (r.status !== 'changed' || !r.changes?.length) return { siteId: site.id, status: r.status };
            if (flags(site.settings).profile_alerts?.enabled === false) return { siteId: site.id, status: 'changed', alerted: false };
            const to = await resolveOwnerEmail(supabase, site.id);
            if (!to) return { siteId: site.id, status: 'changed', alerted: false };
            const { data: loc } = await supabase.from('locations').select('gbp_place_id').eq('site_id', site.id).order('is_primary', { ascending: false }).limit(1).maybeSingle();
            await sendProfileChangeAlertEmail({
              to,
              businessName: (await supabase.from('sites').select('name').eq('id', site.id).single()).data?.name || 'your business',
              changes: r.changes,
              mapsUrl: loc?.gbp_place_id ? googleMapsUrlForPlaceId(loc.gbp_place_id) : null,
              brandColor: site.settings?.brand_color || '#00ef99',
            });
            await supabase.from('gbp_profile_changes').update({ emailed_at: new Date().toISOString() }).eq('site_id', site.id).is('emailed_at', null);
            return { siteId: site.id, status: 'changed', alerted: true };
          } catch (e) {
            return { siteId: site.id, status: `error: ${e instanceof Error ? e.message : String(e)}` };
          }
        })
      );
    }
    return { sites: results.length, changed: results.filter((r) => r.status === 'changed').length, results };
  }
);
