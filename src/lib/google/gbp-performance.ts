/**
 * Google Business Profile Performance API (v1).
 * https://developers.google.com/my-business/reference/performance/rest
 *
 * Uses the same OAuth token / business.manage scope as the rest of GBP, but
 * the API itself must be enabled on the Google Cloud project. When it is not,
 * Google answers 403 with "has not been used in project" and we surface that
 * as a readable reason instead of a crash.
 */

export const GBP_DAILY_METRICS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'CALL_CLICKS',
  'WEBSITE_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
  'BUSINESS_CONVERSATIONS',
  'BUSINESS_BOOKINGS',
] as const;
export type GbpDailyMetric = (typeof GBP_DAILY_METRICS)[number];

export interface GbpPerformanceTotals {
  impressionsMaps: number;
  impressionsSearch: number;
  impressions: number;
  calls: number;
  websiteClicks: number;
  directions: number;
  conversations: number;
  bookings: number;
}

interface DatedValue { date: { year: number; month: number; day: number }; value?: string }
interface SeriesResponse {
  multiDailyMetricTimeSeries?: { dailyMetricTimeSeries?: { dailyMetric: GbpDailyMetric; timeSeries?: { datedValues?: DatedValue[] } }[] }[];
}

export class GbpPerformanceNotEnabledError extends Error {
  constructor(message: string) { super(message); this.name = 'GbpPerformanceNotEnabledError'; }
}

/** "locations/123" or "123" -> "123" */
export function locationIdOf(resource: string): string {
  return resource.replace(/^locations\//, '');
}

/**
 * Sum the daily metrics for [start, end] (inclusive, YYYY-MM-DD).
 * Google reports with a 2-3 day lag, so the last few days of a month-to-date
 * range come back as zero; callers should say so.
 */
export async function fetchGbpPerformanceTotals(
  accessToken: string,
  locationResource: string,
  start: string,
  end: string
): Promise<GbpPerformanceTotals> {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const params = new URLSearchParams();
  for (const m of GBP_DAILY_METRICS) params.append('dailyMetrics', m);
  params.set('dailyRange.startDate.year', String(sy));
  params.set('dailyRange.startDate.month', String(sm));
  params.set('dailyRange.startDate.day', String(sd));
  params.set('dailyRange.endDate.year', String(ey));
  params.set('dailyRange.endDate.month', String(em));
  params.set('dailyRange.endDate.day', String(ed));

  const url = `https://businessprofileperformance.googleapis.com/v1/locations/${locationIdOf(locationResource)}:fetchMultiDailyMetricsTimeSeries?${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message: string = body?.error?.message || `Performance API error ${res.status}`;
    if (res.status === 403 && /has not been used|is disabled|not enabled|accessNotConfigured/i.test(message + JSON.stringify(body?.error?.details || ''))) {
      throw new GbpPerformanceNotEnabledError(message);
    }
    throw new Error(message);
  }
  const json = (await res.json()) as SeriesResponse;

  const sums: Record<string, number> = {};
  for (const multi of json.multiDailyMetricTimeSeries || []) {
    for (const series of multi.dailyMetricTimeSeries || []) {
      let total = 0;
      for (const dv of series.timeSeries?.datedValues || []) total += Number(dv.value || 0);
      sums[series.dailyMetric] = (sums[series.dailyMetric] || 0) + total;
    }
  }
  const n = (k: GbpDailyMetric) => sums[k] || 0;
  const impressionsMaps = n('BUSINESS_IMPRESSIONS_DESKTOP_MAPS') + n('BUSINESS_IMPRESSIONS_MOBILE_MAPS');
  const impressionsSearch = n('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH') + n('BUSINESS_IMPRESSIONS_MOBILE_SEARCH');
  return {
    impressionsMaps,
    impressionsSearch,
    impressions: impressionsMaps + impressionsSearch,
    calls: n('CALL_CLICKS'),
    websiteClicks: n('WEBSITE_CLICKS'),
    directions: n('BUSINESS_DIRECTION_REQUESTS'),
    conversations: n('BUSINESS_CONVERSATIONS'),
    bookings: n('BUSINESS_BOOKINGS'),
  };
}
