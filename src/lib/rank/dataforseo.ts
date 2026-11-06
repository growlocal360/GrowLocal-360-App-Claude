/**
 * DataForSEO Google Maps SERP (live, advanced).
 * https://docs.dataforseo.com/v3/serp/google/maps/live/advanced/
 *
 * One task per call, HTTP Basic auth with the account login/password. A call
 * costs about $0.002 at depth ≤ 100; a 7×7 grid for one keyword is ~$0.10.
 */

export interface MapsItem {
  type?: string;
  rank_group?: number;
  rank_absolute?: number;
  title?: string | null;
  place_id?: string | null;
  cid?: string | null;
  rating?: { value?: number; votes_count?: number } | null;
  category?: string | null;
  address?: string | null;
}

export function dataForSeoConfigured(): boolean {
  return !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`).toString('base64');
}

/**
 * Free account-info call: proves the login works and reports the balance before a
 * run spends hundreds of requests that would all fail the same way.
 */
export async function checkDataForSeoAccount(): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  if (!dataForSeoConfigured()) return { ok: false, error: 'DataForSEO not configured' };
  try {
    const res = await fetch('https://api.dataforseo.com/v3/appendix/user_data', { headers: { Authorization: authHeader() } });
    const json = (await res.json().catch(() => ({}))) as { status_code?: number; status_message?: string; tasks?: { result?: { money?: { balance?: number } }[] }[] };
    if (json.status_code === 40100 || res.status === 401) return { ok: false, error: 'DataForSEO rejected the API login. Use the API password from app.dataforseo.com/api-access, not the account password.' };
    if (json.status_code !== 20000) return { ok: false, error: `DataForSEO: ${json.status_message || `HTTP ${res.status}`}` };
    const balance = json.tasks?.[0]?.result?.[0]?.money?.balance ?? 0;
    if (balance <= 0) return { ok: false, error: 'DataForSEO balance is empty. Add funds at app.dataforseo.com.' };
    return { ok: true, balance };
  } catch (e) {
    return { ok: false, error: `DataForSEO unreachable: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export interface MapsSearchResult { items: MapsItem[]; cost: number }

/** Google Maps results as seen from one coordinate. Zoom 15z ≈ a neighbourhood view. */
export async function mapsSearch(keyword: string, lat: number, lng: number, opts: { zoom?: number; depth?: number } = {}): Promise<MapsSearchResult> {
  if (!dataForSeoConfigured()) throw new Error('DataForSEO is not configured (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).');
  const body = [
    {
      keyword,
      location_coordinate: `${lat.toFixed(6)},${lng.toFixed(6)},${opts.zoom ?? 15}z`,
      language_code: 'en',
      device: 'mobile',
      os: 'ios',
      depth: opts.depth ?? 20,
      search_this_area: false,
    },
  ];
  const res = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    status_code?: number; status_message?: string; cost?: number;
    tasks?: { status_code?: number; status_message?: string; cost?: number; result?: { items?: MapsItem[] }[] }[];
  };
  if (!res.ok || (json.status_code && json.status_code >= 40000)) {
    throw new Error(json.status_message || `DataForSEO HTTP ${res.status}`);
  }
  const task = json.tasks?.[0];
  if (!task || (task.status_code && task.status_code >= 40000)) {
    throw new Error(task?.status_message || 'DataForSEO task failed');
  }
  return { items: task.result?.[0]?.items || [], cost: task.cost ?? json.cost ?? 0 };
}

export interface PackItem { type?: string; rank_group?: number; rank_absolute?: number; title?: string | null; domain?: string | null; is_paid?: boolean; cid?: string | null; rating?: { value?: number; votes_count?: number } | null }
export interface LocalPackResult { items: PackItem[]; cost: number }

/**
 * A normal Google web search as seen from one coordinate, so the Local Pack
 * (type 'local_pack' items) can be read. Depth 10 = the first page, which is
 * the only place the pack appears. Same price as a Maps call.
 * https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/
 */
export async function localPackSearch(keyword: string, lat: number, lng: number): Promise<LocalPackResult> {
  if (!dataForSeoConfigured()) throw new Error('DataForSEO is not configured (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).');
  // location_coordinate is "lat,lng,radius" with the radius in metres (min 199). 500 m keeps the searcher at the grid point.
  const body = [{ keyword, location_coordinate: `${lat.toFixed(6)},${lng.toFixed(6)},500`, language_code: 'en', device: 'mobile', os: 'ios', depth: 10 }];
  const res = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    status_code?: number; status_message?: string; cost?: number;
    tasks?: { status_code?: number; status_message?: string; cost?: number; result?: { items?: PackItem[] }[] }[];
  };
  if (!res.ok || (json.status_code && json.status_code >= 40000)) throw new Error(json.status_message || `DataForSEO HTTP ${res.status}`);
  const task = json.tasks?.[0];
  if (!task || (task.status_code && task.status_code >= 40000)) throw new Error(task?.status_message || 'DataForSEO task failed');
  return { items: task.result?.[0]?.items || [], cost: task.cost ?? json.cost ?? 0 };
}

/** Run `fn` over items with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export interface AiModeResult { markdown: string; references: { title: string; domain: string; url: string }[]; cost: number }

/**
 * Google AI Mode answer for a question, as seen by a searcher at (lat, lng).
 * https://docs.dataforseo.com/v3/serp/google/ai_mode/live/advanced/ (about $0.004 per call).
 */
export async function aiModeSearch(keyword: string, lat: number, lng: number): Promise<AiModeResult> {
  const body = [{ keyword, location_coordinate: `${lat.toFixed(6)},${lng.toFixed(6)}`, language_code: 'en' }];
  const res = await fetch('https://api.dataforseo.com/v3/serp/google/ai_mode/live/advanced', {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    status_code?: number; status_message?: string;
    tasks?: { status_code?: number; status_message?: string; cost?: number; result?: { items?: { type?: string; markdown?: string; items?: { text?: string; title?: string }[]; references?: { title?: string; domain?: string; url?: string }[] }[] }[] }[];
  };
  const task = json.tasks?.[0];
  if (!res.ok || json.status_code !== 20000) throw new Error(`DataForSEO ${json.status_code ?? res.status}: ${json.status_message || 'request failed'}`);
  if (!task || (task.status_code && task.status_code !== 20000)) throw new Error(`DataForSEO task ${task?.status_code}: ${task?.status_message || 'failed'}`);
  const block = task.result?.[0]?.items?.find((i) => i.type === 'ai_overview') || task.result?.[0]?.items?.[0];
  const markdown = block?.markdown || (block?.items || []).map((i) => [i.title, i.text].filter(Boolean).join('\n')).join('\n') || '';
  const references = (block?.references || []).map((r) => ({ title: r.title || '', domain: r.domain || '', url: r.url || '' }));
  return { markdown, references, cost: task.cost ?? 0 };
}
