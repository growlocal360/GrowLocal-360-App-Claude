import type { SupabaseClient } from '@supabase/supabase-js';
import { buildGrid, defaultKeywords, findRank, findPackRank, summarize, sortSources, isRankSource, GRID_SIZES, SPACINGS_MILES, MAX_KEYWORDS, DEFAULT_RANK_SOURCES, type RankSource, type ScannedPoint, type ScanSummary } from './grid';
import { mapsSearch, localPackSearch, mapLimit, dataForSeoConfigured, checkDataForSeoAccount } from './dataforseo';
import type { SiteSettings } from '@/types/database';

/**
 * Maps grid rank scans. One scan = one keyword × one grid, stored with every
 * point's rank so the page can draw the heatmap and the report can compare
 * months.
 */

export interface RankSettings {
  enabled: boolean;
  keywords: string[];
  gridSize: number;
  spacingMiles: number;
  /** Which Google surfaces to scan, pack first. Default both. */
  sources: RankSource[];
}

export function rankSettings(settings: SiteSettings | null | undefined): RankSettings {
  const raw = ((settings as { automation?: { rank_tracking?: Record<string, unknown> } } | null)?.automation?.rank_tracking) || {};
  const size = Number(raw.grid_size);
  const spacing = Number(raw.spacing_miles);
  return {
    enabled: raw.enabled !== false,
    keywords: Array.isArray(raw.keywords) ? (raw.keywords as unknown[]).filter((k): k is string => typeof k === 'string' && k.trim().length > 0).map((k) => k.trim().toLowerCase()).slice(0, MAX_KEYWORDS) : [],
    gridSize: (GRID_SIZES as readonly number[]).includes(size) ? size : 7,
    spacingMiles: (SPACINGS_MILES as readonly number[]).includes(spacing) ? spacing : 1,
    sources: (() => {
      const picked = Array.isArray(raw.sources) ? sortSources((raw.sources as unknown[]).filter(isRankSource)) : [];
      return picked.length ? picked : [...DEFAULT_RANK_SOURCES];
    })(),
  };
}

/** Keywords to scan: the saved list, or sensible defaults from the site's own categories and services. */
export async function resolveKeywords(supabase: SupabaseClient, siteId: string, settings: RankSettings): Promise<string[]> {
  if (settings.keywords.length) return settings.keywords;
  const [{ data: cat }, { data: services }] = await Promise.all([
    supabase.from('site_categories').select('gbp_category:gbp_categories(display_name)').eq('site_id', siteId).eq('is_primary', true).limit(1).maybeSingle(),
    supabase.from('services').select('name').eq('site_id', siteId).eq('is_active', true).order('sort_order').limit(8),
  ]);
  const primary = ((cat?.gbp_category as unknown as { display_name?: string } | null)?.display_name) || null;
  return defaultKeywords(primary, (services || []).map((s) => s.name as string));
}

interface Center { lat: number; lng: number; placeId: string | null; city: string | null }

/** Business coordinates from the primary location, geocoding the address once if they are missing. */
export async function resolveCenter(supabase: SupabaseClient, siteId: string): Promise<Center | null> {
  const { data: loc } = await supabase
    .from('locations')
    .select('id, latitude, longitude, gbp_place_id, address_line1, city, state, zip_code')
    .eq('site_id', siteId)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!loc) return null;
  if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
    return { lat: loc.latitude, lng: loc.longitude, placeId: loc.gbp_place_id, city: loc.city };
  }
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const address = [loc.address_line1, loc.city, loc.state, loc.zip_code].filter(Boolean).join(', ');
  // A street address the owner entered wins; otherwise the GBP place id gives the exact pin.
  const query = loc.address_line1 && address ? `address=${encodeURIComponent(address)}` : loc.gbp_place_id ? `place_id=${encodeURIComponent(loc.gbp_place_id)}` : null;
  if (!key || !query) return null;
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${query}&key=${key}`);
    const json = (await res.json()) as { results?: { geometry?: { location?: { lat: number; lng: number } } }[] };
    const g = json.results?.[0]?.geometry?.location;
    if (!g) return null;
    await supabase.from('locations').update({ latitude: g.lat, longitude: g.lng }).eq('id', loc.id);
    return { lat: g.lat, lng: g.lng, placeId: loc.gbp_place_id, city: loc.city };
  } catch {
    return null;
  }
}

export interface ScanResult { keyword: string; source: RankSource; scanId?: string; summary?: ScanSummary; cost?: number; error?: string }

/** One keyword × one grid × one source. */
export async function scanKeyword(
  supabase: SupabaseClient,
  siteId: string,
  keyword: string,
  settings: RankSettings,
  center: Center,
  businessName: string,
  source: RankSource = 'maps'
): Promise<ScanResult> {
  const grid = buildGrid(center.lat, center.lng, settings.gridSize, settings.spacingMiles);
  let cost = 0;
  let failures = 0;
  const points: ScannedPoint[] = await mapLimit(grid, 5, async (p) => {
    try {
      if (source === 'local_pack') {
        const r = await localPackSearch(keyword, p.lat, p.lng);
        cost += r.cost;
        const hit = findPackRank(r.items, businessName);
        return hit.packShown ? { ...p, rank: hit.rank } : { ...p, rank: null, noPack: true };
      }
      const r = await mapsSearch(keyword, p.lat, p.lng);
      cost += r.cost;
      return { ...p, rank: findRank(r.items, center.placeId, businessName) };
    } catch {
      failures += 1;
      return { ...p, rank: null };
    }
  });
  if (failures === grid.length) return { keyword, source, error: 'Every grid point failed. Check the DataForSEO account and balance.' };

  const summary = summarize(points, source);
  const { data, error } = await supabase
    .from('rank_scans')
    .insert({
      site_id: siteId,
      keyword,
      source,
      grid_size: settings.gridSize,
      spacing_miles: settings.spacingMiles,
      center_lat: center.lat,
      center_lng: center.lng,
      points,
      summary,
      cost_usd: Math.round(cost * 10000) / 10000,
      failed_points: failures,
      provider: 'dataforseo',
    })
    .select('id')
    .single();
  if (error || !data) return { keyword, source, error: error?.message || 'Could not save scan' };
  return { keyword, source, scanId: data.id, summary, cost };
}

export interface SiteScanRun { siteId: string; skipped?: string; results: ScanResult[]; totalCost: number }

export interface RankLastRun { at: string; ok: boolean; message: string; scanned: number; failed: number }

/** A run that was started (and paid for) but has not reported back yet. `sources` is missing on runs recorded before Local Pack tracking (Maps only). */
export interface RankPendingRun { at: string; keywords: string[]; sources?: RankSource[] }

/** Everything a run needs, resolved once so each keyword can be its own step. */
export interface ScanPrep { settings: RankSettings; center: Center; keywords: string[]; businessName: string }

export async function prepareRankScan(supabase: SupabaseClient, siteId: string, only?: string[]): Promise<{ skipped: string } | ScanPrep> {
  if (!dataForSeoConfigured()) return { skipped: 'DataForSEO not configured' };
  const { data: site } = await supabase.from('sites').select('name, settings, status').eq('id', siteId).single();
  if (!site || site.status !== 'active') return { skipped: 'site inactive' };
  const settings = rankSettings(site.settings);
  if (!settings.enabled) return { skipped: 'rank tracking off' };
  const center = await resolveCenter(supabase, siteId);
  if (!center) return { skipped: 'no coordinates for the business address' };
  const keywords = (only && only.length ? only : await resolveKeywords(supabase, siteId, settings)).slice(0, MAX_KEYWORDS);
  if (keywords.length === 0) return { skipped: 'no keywords' };
  const account = await checkDataForSeoAccount();
  if (!account.ok) return { skipped: account.error };
  return { settings, center, keywords, businessName: site.name as string };
}

async function updateRankTracking(supabase: SupabaseClient, siteId: string, patch: Record<string, unknown>): Promise<void> {
  const { data: site } = await supabase.from('sites').select('settings').eq('id', siteId).single();
  const settings = (site?.settings as Record<string, unknown> | null) || {};
  const automation = (settings.automation as Record<string, unknown> | undefined) || {};
  const rank = (automation.rank_tracking as Record<string, unknown> | undefined) || {};
  await supabase.from('sites').update({ settings: { ...settings, automation: { ...automation, rank_tracking: { ...rank, ...patch } } } }).eq('id', siteId);
}

/** Mark a run as started so the page can keep showing progress after a reload. Cleared by recordLastRun. */
export async function recordPendingRun(supabase: SupabaseClient, siteId: string, keywords: string[], sources: RankSource[]): Promise<RankPendingRun> {
  const pending: RankPendingRun = { at: new Date().toISOString(), keywords, sources };
  await updateRankTracking(supabase, siteId, { pending_run: pending });
  return pending;
}

/** The run in progress, if one started in the last hour and has not reported back. */
export function pendingRunOf(settings: SiteSettings | null | undefined): RankPendingRun | null {
  const rt = ((settings as { automation?: { rank_tracking?: { pending_run?: RankPendingRun; last_run?: RankLastRun } } } | null)?.automation?.rank_tracking) || {};
  const p = rt.pending_run;
  if (!p || typeof p.at !== 'string') return null;
  const started = new Date(p.at).getTime();
  if (Number.isNaN(started) || Date.now() - started > 60 * 60 * 1000) return null;
  if (rt.last_run && new Date(rt.last_run.at).getTime() >= started) return null;
  return p;
}

/** Outcome of the most recent run, kept on the site so the dashboard can show why nothing appeared. */
export async function recordLastRun(supabase: SupabaseClient, siteId: string, run: SiteScanRun): Promise<RankLastRun> {
  const scanned = run.results.filter((r) => !r.error).length;
  const failed = run.results.filter((r) => r.error).length;
  const sources = new Set(run.results.map((r) => r.source));
  const unit = sources.size > 1 ? 'heatmap' : 'keyword';
  const message = run.skipped
    ? run.skipped
    : failed === 0
      ? `Scanned ${scanned} ${unit}${scanned === 1 ? '' : 's'}`
      : scanned === 0
        ? run.results[0]?.error || `Every ${unit} failed`
        : `${scanned} scanned, ${failed} failed: ${run.results.find((r) => r.error)?.error}`;
  const last: RankLastRun = { at: new Date().toISOString(), ok: !run.skipped && failed === 0 && scanned > 0, message, scanned, failed };
  await updateRankTracking(supabase, siteId, { last_run: last, pending_run: null });
  return last;
}

export function lastRunOf(settings: SiteSettings | null | undefined): RankLastRun | null {
  const raw = ((settings as { automation?: { rank_tracking?: { last_run?: RankLastRun } } } | null)?.automation?.rank_tracking?.last_run) || null;
  return raw && typeof raw.at === 'string' ? raw : null;
}

/** Scan every keyword for a site (the monthly cron and "Scan now"). */
export async function runRankScans(supabase: SupabaseClient, siteId: string, only?: string[]): Promise<SiteScanRun> {
  const run = await runRankScansInner(supabase, siteId, only);
  await recordLastRun(supabase, siteId, run).catch(() => undefined);
  return run;
}

async function runRankScansInner(supabase: SupabaseClient, siteId: string, only?: string[]): Promise<SiteScanRun> {
  const out: SiteScanRun = { siteId, results: [], totalCost: 0 };
  const prep = await prepareRankScan(supabase, siteId, only);
  if ('skipped' in prep) return { ...out, skipped: prep.skipped };
  for (const keyword of prep.keywords) {
    for (const source of prep.settings.sources) {
      const r = await scanKeyword(supabase, siteId, keyword, prep.settings, prep.center, prep.businessName, source);
      out.results.push(r);
      out.totalCost += r.cost || 0;
    }
  }
  return out;
}

const SCAN_COLUMNS = 'id, keyword, source, grid_size, spacing_miles, center_lat, center_lng, points, summary, scanned_at, cost_usd, failed_points';

/** Latest scan per keyword × source plus the one before it, for deltas. Pack rows come first within a keyword. */
export async function latestScans(supabase: SupabaseClient, siteId: string) {
  const { data } = await supabase
    .from('rank_scans')
    .select(SCAN_COLUMNS)
    .eq('site_id', siteId)
    .order('scanned_at', { ascending: false })
    .limit(400);
  const byKey = new Map<string, typeof data>();
  for (const row of data || []) {
    const key = `${row.keyword}\u0000${row.source}`;
    const list = byKey.get(key) || [];
    if (list.length < 2) list.push(row);
    byKey.set(key, list);
  }
  return [...byKey.values()].map((rows) => ({ keyword: rows![0].keyword as string, source: rows![0].source as RankSource, latest: rows![0], previous: rows![1] || null }));
}

/** Every scan for one keyword (optionally one source), newest first, for side-by-side comparison on the Rankings page. */
export async function scanHistory(supabase: SupabaseClient, siteId: string, keyword: string, source?: RankSource, limit = 24) {
  let q = supabase
    .from('rank_scans')
    .select(SCAN_COLUMNS)
    .eq('site_id', siteId)
    .eq('keyword', keyword);
  if (source) q = q.eq('source', source);
  const { data } = await q.order('scanned_at', { ascending: false }).limit(limit);
  return data || [];
}
