import type { SupabaseClient } from '@supabase/supabase-js';
import { getStoredGoogleToken } from '@/lib/google/stored-token';
import { GSCClient } from '@/lib/google/gsc-client';
import { fetchGbpPerformanceTotals, GbpPerformanceNotEnabledError, type GbpPerformanceTotals } from '@/lib/google/gbp-performance';
import type { SiteSettings } from '@/types/database';

/**
 * Monthly report for one site: what Google showed, what people did, what the
 * site produced, and what the automation did, for one calendar month, with
 * the previous month alongside for deltas. Pure data; the page and the email
 * render it.
 */

export interface MonthPeriod { start: string; end: string; label: string; key: string; monthToDate: boolean }

export interface SearchSummary {
  available: boolean;
  reason?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  topQueries: { query: string; clicks: number; impressions: number; position: number }[];
  topPages: { page: string; clicks: number; impressions: number }[];
}

export interface GoogleSummary extends GbpPerformanceTotals {
  available: boolean;
  reason?: string;
}

export interface MonthlyReportData {
  version: 1;
  period: MonthPeriod;
  generatedAt: string;
  siteName: string;
  google: GoogleSummary;
  search: SearchSummary;
  leads: { total: number; byService: { name: string; count: number }[] };
  bookings: { created: number; completed: number };
  reviews: {
    newCount: number;
    newAverage: number | null;
    totalCount: number | null;
    averageRating: number | null;
    latest: { author: string; rating: number; comment: string | null; date: string | null }[];
  };
  activity: { repliesPosted: number; requestsSent: number; postsPublished: number; photosAdded: number; jobsPublished: number; socialPosts: number };
  /** Latest Maps grid scan per keyword inside the period, with the previous scan for deltas. */
  rankings: { keyword: string; visibility: number; top3Points: number; top10Points: number; totalPoints: number; averageRank: number | null; previousVisibility: number | null; scannedAt: string }[];
  /** Share of customer-style AI prompts that named the business in the period's latest batch. */
  aiVisibility: { mentionedShare: number; previousShare: number | null; byModel: { model: string; mentionedShare: number }[]; topCompetitors: { name: string; count: number }[] } | null;
  previous: {
    period: MonthPeriod;
    google: Pick<GoogleSummary, 'available' | 'impressions' | 'calls' | 'websiteClicks' | 'directions'>;
    search: Pick<SearchSummary, 'available' | 'clicks' | 'impressions'>;
    leads: number;
    bookings: number;
    newReviews: number;
  };
  notes: string[];
}

// ── Periods ─────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** 'YYYY-MM' -> inclusive start/end. The current month ends today (month to date). */
export function monthPeriod(key: string, now = new Date()): MonthPeriod {
  const [y, m] = key.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const lastDay = new Date(Date.UTC(y, m, 0));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthToDate = today < lastDay;
  const end = monthToDate ? today : lastDay;
  return {
    start: iso(start),
    end: iso(end),
    key,
    monthToDate,
    label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  };
}

export function previousMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
}

/** Percent change for a tile; null when there is nothing to compare against. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ── Builders ────────────────────────────────────────────────────────────────

/** Exclusive upper bound for timestamp filters: the day after `end`. */
export function dayAfter(end: string): string {
  const [y, m, d] = end.split('-').map(Number);
  return iso(new Date(Date.UTC(y, m - 1, d + 1)));
}

export async function googleFor(token: string | null, locationResource: string | null, p: Pick<MonthPeriod, 'start' | 'end'>): Promise<GoogleSummary> {
  const empty: GoogleSummary = { available: false, impressionsMaps: 0, impressionsSearch: 0, impressions: 0, calls: 0, websiteClicks: 0, directions: 0, conversations: 0, bookings: 0 };
  if (!locationResource) return { ...empty, reason: 'No Google Business Profile location linked.' };
  if (!token) return { ...empty, reason: 'Google connection expired. Reconnect the Business Profile.' };
  try {
    const totals = await fetchGbpPerformanceTotals(token, locationResource, p.start, p.end);
    return { available: true, ...totals };
  } catch (e) {
    if (e instanceof GbpPerformanceNotEnabledError) {
      return { ...empty, reason: 'The Business Profile Performance API is not enabled on the Google Cloud project yet.' };
    }
    return { ...empty, reason: e instanceof Error ? e.message : 'Google Business Profile data unavailable.' };
  }
}

export async function searchFor(token: string | null, propertyUrl: string | null, p: Pick<MonthPeriod, 'start' | 'end'>, full: boolean): Promise<SearchSummary> {
  const empty: SearchSummary = { available: false, clicks: 0, impressions: 0, ctr: 0, position: null, topQueries: [], topPages: [] };
  if (!propertyUrl) return { ...empty, reason: 'Search Console is not connected for this site.' };
  if (!token) return { ...empty, reason: 'Google connection expired. Reconnect to refresh Search Console data.' };
  try {
    const gsc = new GSCClient(token);
    const totals = await gsc.querySearchAnalytics(propertyUrl, { startDate: p.start, endDate: p.end, dimensions: [], rowLimit: 1 });
    const t = totals[0];
    const out: SearchSummary = {
      available: true,
      clicks: t?.clicks || 0,
      impressions: t?.impressions || 0,
      ctr: t?.ctr || 0,
      position: t ? Math.round(t.position * 10) / 10 : null,
      topQueries: [],
      topPages: [],
    };
    if (full) {
      const [queries, pages] = await Promise.all([
        gsc.querySearchAnalytics(propertyUrl, { startDate: p.start, endDate: p.end, dimensions: ['query'], rowLimit: 10 }),
        gsc.querySearchAnalytics(propertyUrl, { startDate: p.start, endDate: p.end, dimensions: ['page'], rowLimit: 10 }),
      ]);
      out.topQueries = queries.map((r) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: Math.round(r.position * 10) / 10 }));
      out.topPages = pages.map((r) => ({ page: r.keys[0], clicks: r.clicks, impressions: r.impressions }));
    }
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Search Console unavailable';
    return { ...empty, reason: /403|permission|forbidden/i.test(msg) ? 'Google account lacks Search Console access to this property.' : msg };
  }
}

export async function countsFor(supabase: SupabaseClient, siteId: string, p: Pick<MonthPeriod, 'start' | 'end'>) {
  const from = `${p.start}T00:00:00Z`;
  const to = `${dayAfter(p.end)}T00:00:00Z`;
  const [leads, apptsCreated, apptsCompleted, reviews, actions, requests, jobs] = await Promise.all([
    supabase.from('leads').select('service_type').eq('site_id', siteId).gte('created_at', from).lt('created_at', to),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('site_id', siteId).gte('created_at', from).lt('created_at', to),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'completed').gte('scheduled_date', p.start).lte('scheduled_date', p.end),
    supabase.from('google_reviews').select('author_name, rating, comment, review_date').eq('site_id', siteId).eq('is_visible', true).gte('review_date', from).lt('review_date', to).order('review_date', { ascending: false }),
    supabase.from('pending_actions').select('action_type, payload').eq('site_id', siteId).eq('status', 'published').gte('published_at', from).lt('published_at', to),
    supabase.from('review_requests').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'sent').gte('sent_at', from).lt('sent_at', to),
    supabase.from('work_items').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'published').gte('created_at', from).lt('created_at', to),
  ]);

  const byService = new Map<string, number>();
  for (const l of leads.data || []) {
    const k = (l.service_type as string | null)?.trim() || 'Not specified';
    byService.set(k, (byService.get(k) || 0) + 1);
  }
  const activity = { repliesPosted: 0, requestsSent: requests.count || 0, postsPublished: 0, photosAdded: 0, jobsPublished: jobs.count || 0, socialPosts: 0 };
  for (const a of actions.data || []) {
    if (a.action_type === 'review_reply') activity.repliesPosted += 1;
    else if (a.action_type === 'gbp_post') activity.postsPublished += 1;
    else if (a.action_type === 'social_post') activity.socialPosts += 1;
    else if (a.action_type === 'photo_upload') {
      const results = (a.payload as { results?: { gbp_media_name?: string }[] } | null)?.results;
      activity.photosAdded += Array.isArray(results) ? results.filter((r) => r.gbp_media_name).length : 1;
    }
  }
  const rv = (reviews.data || []) as { author_name: string | null; rating: number; comment: string | null; review_date: string | null }[];
  return {
    leads: {
      total: (leads.data || []).length,
      byService: [...byService.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    },
    bookings: { created: apptsCreated.count || 0, completed: apptsCompleted.count || 0 },
    reviews: {
      newCount: rv.length,
      newAverage: rv.length ? Math.round((rv.reduce((s, r) => s + r.rating, 0) / rv.length) * 10) / 10 : null,
      latest: rv.slice(0, 5).map((r) => ({ author: r.author_name || 'Customer', rating: r.rating, comment: r.comment, date: r.review_date })),
    },
    activity,
  };
}

async function rankingsFor(supabase: SupabaseClient, siteId: string, p: MonthPeriod): Promise<MonthlyReportData['rankings']> {
  const { data } = await supabase
    .from('rank_scans')
    .select('keyword, summary, scanned_at')
    .eq('site_id', siteId)
    .lt('scanned_at', `${dayAfter(p.end)}T00:00:00Z`)
    .order('scanned_at', { ascending: false })
    .limit(200);
  const seen = new Map<string, { latest?: { summary: ScanSummaryLite; scanned_at: string }; previous?: { summary: ScanSummaryLite } }>();
  for (const row of data || []) {
    const e = seen.get(row.keyword) || {};
    if (!e.latest) {
      // Only count as "this month" when the latest scan falls inside the period.
      if (row.scanned_at < `${p.start}T00:00:00Z`) continue;
      e.latest = { summary: row.summary as ScanSummaryLite, scanned_at: row.scanned_at };
    } else if (!e.previous) e.previous = { summary: row.summary as ScanSummaryLite };
    seen.set(row.keyword, e);
  }
  return [...seen.entries()]
    .filter(([, e]) => e.latest)
    .map(([keyword, e]) => ({
      keyword,
      visibility: e.latest!.summary.visibility,
      top3Points: e.latest!.summary.top3Points,
      top10Points: e.latest!.summary.top10Points,
      totalPoints: e.latest!.summary.totalPoints,
      averageRank: e.latest!.summary.averageRank,
      previousVisibility: e.previous?.summary.visibility ?? null,
      scannedAt: e.latest!.scanned_at,
    }))
    .sort((a, b) => b.visibility - a.visibility);
}
type ScanSummaryLite = { visibility: number; top3Points: number; top10Points: number; totalPoints: number; averageRank: number | null };

async function aiVisibilityFor(supabase: SupabaseClient, siteId: string, p: MonthPeriod): Promise<MonthlyReportData['aiVisibility']> {
  const { data } = await supabase
    .from('ai_visibility_checks')
    .select('batch_at, model, mentioned, competitors')
    .eq('site_id', siteId)
    .lt('batch_at', `${dayAfter(p.end)}T00:00:00Z`)
    .order('batch_at', { ascending: false })
    .limit(60);
  const rows = data || [];
  if (!rows.length || rows[0].batch_at < `${p.start}T00:00:00Z`) return null;
  const latest = rows[0].batch_at;
  const batch = rows.filter((r) => r.batch_at === latest);
  const prevAt = rows.find((r) => r.batch_at !== latest)?.batch_at;
  const prev = prevAt ? rows.filter((r) => r.batch_at === prevAt) : [];
  const share = (l: typeof rows) => (l.length ? Math.round((l.filter((r) => r.mentioned).length / l.length) * 100) : 0);
  const counts = new Map<string, number>();
  for (const r of batch) for (const c of (r.competitors as string[]) || []) counts.set(c, (counts.get(c) || 0) + 1);
  return {
    mentionedShare: share(batch),
    previousShare: prev.length ? share(prev) : null,
    byModel: Array.from(new Set(batch.map((r) => r.model as string))).map((m) => ({ model: m, mentionedShare: share(batch.filter((r) => r.model === m)) })),
    topCompetitors: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
  };
}

export async function buildMonthlyReport(supabase: SupabaseClient, siteId: string, key: string, now = new Date()): Promise<MonthlyReportData> {
  const period = monthPeriod(key, now);
  const prevPeriod = monthPeriod(previousMonthKey(key), now);

  const [{ data: site }, { data: location }] = await Promise.all([
    supabase.from('sites').select('id, name, settings').eq('id', siteId).single(),
    supabase.from('locations').select('gbp_location_id').eq('site_id', siteId).order('is_primary', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!site) throw new Error('Site not found');
  const settings = (site.settings || {}) as SiteSettings & { gsc_property_url?: string; google_total_reviews?: number; google_average_rating?: number };
  const token = await getStoredGoogleToken(supabase, siteId);
  const locationResource = location?.gbp_location_id || null;
  const propertyUrl = settings.gsc_property_url || null;

  const [rankings, aiVisibility] = await Promise.all([rankingsFor(supabase, siteId, period), aiVisibilityFor(supabase, siteId, period)]);
  const [google, search, counts, prevGoogle, prevSearch, prevCounts] = await Promise.all([
    googleFor(token, locationResource, period),
    searchFor(token, propertyUrl, period, true),
    countsFor(supabase, siteId, period),
    googleFor(token, locationResource, prevPeriod),
    searchFor(token, propertyUrl, prevPeriod, false),
    countsFor(supabase, siteId, prevPeriod),
  ]);

  const notes: string[] = [];
  if (!google.available && google.reason) notes.push(google.reason);
  if (!search.available && search.reason) notes.push(search.reason);
  if (google.available && period.monthToDate) notes.push('Google Business Profile numbers run 2 to 3 days behind, so the last few days of this month are not in yet.');

  return {
    version: 1,
    period,
    generatedAt: new Date().toISOString(),
    siteName: site.name,
    google,
    search,
    leads: counts.leads,
    bookings: counts.bookings,
    reviews: {
      ...counts.reviews,
      totalCount: typeof settings.google_total_reviews === 'number' ? settings.google_total_reviews : null,
      averageRating: typeof settings.google_average_rating === 'number' ? settings.google_average_rating : null,
    },
    activity: counts.activity,
    rankings,
    aiVisibility,
    previous: {
      period: prevPeriod,
      google: { available: prevGoogle.available, impressions: prevGoogle.impressions, calls: prevGoogle.calls, websiteClicks: prevGoogle.websiteClicks, directions: prevGoogle.directions },
      search: { available: prevSearch.available, clicks: prevSearch.clicks, impressions: prevSearch.impressions },
      leads: prevCounts.leads.total,
      bookings: prevCounts.bookings.created,
      newReviews: prevCounts.reviews.newCount,
    },
    notes,
  };
}

/** Build and store (upsert per site + month). */
export async function generateAndSaveMonthlyReport(supabase: SupabaseClient, siteId: string, key: string): Promise<MonthlyReportData> {
  const data = await buildMonthlyReport(supabase, siteId, key);
  await supabase.from('site_reports').upsert(
    { site_id: siteId, period_key: key, period_start: data.period.start, period_end: data.period.end, data, generated_at: data.generatedAt },
    { onConflict: 'site_id,period_key' }
  );
  return data;
}

/** Owner-facing one-liners for the email and the page header. */
export function reportHighlights(d: MonthlyReportData): string[] {
  const out: string[] = [];
  const up = (c: number, p: number) => { const pc = pctChange(c, p); return pc === null ? '' : pc >= 0 ? ` (up ${pc}%)` : ` (down ${Math.abs(pc)}%)`; };
  if (d.google.available) {
    out.push(`${d.google.impressions.toLocaleString()} people saw the business on Google Search and Maps${up(d.google.impressions, d.previous.google.impressions)}.`);
    const actions = d.google.calls + d.google.websiteClicks + d.google.directions;
    if (actions) out.push(`${actions.toLocaleString()} took action from the listing: ${d.google.calls} calls, ${d.google.websiteClicks} website visits, ${d.google.directions} direction requests.`);
  }
  if (d.search.available) out.push(`The website earned ${d.search.clicks.toLocaleString()} clicks from ${d.search.impressions.toLocaleString()} Google searches${up(d.search.clicks, d.previous.search.clicks)}.`);
  if (d.leads.total || d.bookings.created) out.push(`${d.leads.total} lead${d.leads.total === 1 ? '' : 's'} and ${d.bookings.created} booking${d.bookings.created === 1 ? '' : 's'} came through the site${up(d.leads.total, d.previous.leads)}.`);
  if (d.reviews.newCount) out.push(`${d.reviews.newCount} new Google review${d.reviews.newCount === 1 ? '' : 's'}${d.reviews.newAverage ? `, averaging ${d.reviews.newAverage} stars` : ''}.`);
  if (d.rankings.length) {
    const best = d.rankings[0];
    out.push(`On Google Maps, "${best.keyword}" shows in the top 3 from ${best.top3Points} of ${best.totalPoints} spots around town${best.previousVisibility !== null ? up(best.visibility, best.previousVisibility).replace('up', 'visibility up').replace('down', 'visibility down') : ''}.`);
  }
  if (d.aiVisibility) out.push(`AI assistants named the business in ${d.aiVisibility.mentionedShare}% of customer-style questions${d.aiVisibility.previousShare !== null ? ` (${d.aiVisibility.previousShare}% last time)` : ''}.`);
  const a = d.activity;
  const did = [
    a.repliesPosted ? `${a.repliesPosted} review repl${a.repliesPosted === 1 ? 'y' : 'ies'}` : null,
    a.requestsSent ? `${a.requestsSent} review request${a.requestsSent === 1 ? '' : 's'}` : null,
    a.postsPublished ? `${a.postsPublished} Google post${a.postsPublished === 1 ? '' : 's'}` : null,
    a.photosAdded ? `${a.photosAdded} profile photo${a.photosAdded === 1 ? '' : 's'}` : null,
    a.socialPosts ? `${a.socialPosts} Facebook or Instagram post${a.socialPosts === 1 ? '' : 's'}` : null,
    a.jobsPublished ? `${a.jobsPublished} job${a.jobsPublished === 1 ? '' : 's'} published to the site` : null,
  ].filter(Boolean);
  if (did.length) out.push(`Done for you this month: ${did.join(', ')}.`);
  return out;
}
