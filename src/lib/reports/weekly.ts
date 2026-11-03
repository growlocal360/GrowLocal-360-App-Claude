import type { SupabaseClient } from '@supabase/supabase-js';
import { getStoredGoogleToken } from '@/lib/google/stored-token';
import { countsFor, googleFor, iso, type GoogleSummary } from './monthly';
import type { ProfileChange } from '@/lib/automation/profile-watch';

/**
 * Weekly digest: the last seven full days for one site. Short on purpose:
 * what came in, what went out, what is waiting, and anything that changed
 * on the Google profile.
 */
export interface WeeklyDigest {
  siteId: string;
  siteName: string;
  start: string;
  end: string;
  google: GoogleSummary;
  leads: number;
  bookings: number;
  newReviews: number;
  newReviewAverage: number | null;
  activity: { repliesPosted: number; requestsSent: number; postsPublished: number; photosAdded: number; jobsPublished: number; socialPosts: number };
  pendingApprovals: number;
  profileChanges: { detectedAt: string; changes: ProfileChange[] }[];
  unansweredReviews: number;
}

/** Monday..Sunday of the week that just ended, relative to `now` (UTC dates). */
export function lastWeekRange(now = new Date()): { start: string; end: string } {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(today); end.setUTCDate(end.getUTCDate() - 1); // yesterday
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
  return { start: iso(start), end: iso(end) };
}

export async function buildWeeklyDigest(supabase: SupabaseClient, siteId: string, range = lastWeekRange()): Promise<WeeklyDigest> {
  const [{ data: site }, { data: location }] = await Promise.all([
    supabase.from('sites').select('id, name').eq('id', siteId).single(),
    supabase.from('locations').select('gbp_location_id').eq('site_id', siteId).order('is_primary', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!site) throw new Error('Site not found');
  const token = await getStoredGoogleToken(supabase, siteId);

  const [google, counts, { count: pending }, { data: changes }, { count: unanswered }] = await Promise.all([
    googleFor(token, location?.gbp_location_id || null, range),
    countsFor(supabase, siteId, range),
    supabase.from('pending_actions').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'pending'),
    supabase.from('gbp_profile_changes').select('changes, detected_at').eq('site_id', siteId).gte('detected_at', `${range.start}T00:00:00Z`).order('detected_at', { ascending: false }).limit(10),
    supabase.from('google_reviews').select('id', { count: 'exact', head: true }).eq('site_id', siteId).is('review_reply', null).gte('review_date', `${range.start}T00:00:00Z`),
  ]);

  return {
    siteId,
    siteName: site.name,
    start: range.start,
    end: range.end,
    google,
    leads: counts.leads.total,
    bookings: counts.bookings.created,
    newReviews: counts.reviews.newCount,
    newReviewAverage: counts.reviews.newAverage,
    activity: counts.activity,
    pendingApprovals: pending || 0,
    profileChanges: (changes || []).map((c) => ({ detectedAt: c.detected_at as string, changes: c.changes as ProfileChange[] })),
    unansweredReviews: unanswered || 0,
  };
}

/** Skip the email when the week was completely quiet, so the digest never becomes noise. */
export function digestHasNews(d: WeeklyDigest): boolean {
  const a = d.activity;
  return (
    d.leads + d.bookings + d.newReviews + d.pendingApprovals + d.profileChanges.length > 0 ||
    a.repliesPosted + a.requestsSent + a.postsPublished + a.photosAdded + a.jobsPublished + a.socialPosts > 0 ||
    (d.google.available && d.google.calls + d.google.websiteClicks + d.google.directions > 0)
  );
}
