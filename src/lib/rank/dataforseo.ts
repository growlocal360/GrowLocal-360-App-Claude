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
