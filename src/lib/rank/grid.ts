/**
 * Pure helpers for Maps grid rank tracking: the grid of coordinates around a
 * business, default keywords from its categories and services, and the roll-up
 * of a scan into the numbers owners read.
 */

export interface GridPoint { row: number; col: number; lat: number; lng: number }
/** `rank` is the business's position (Maps: 1-20; Local Pack: 1-3) or null when not shown. `noPack` marks a Local Pack point where Google showed no pack at all for the query. */
export interface ScannedPoint extends GridPoint { rank: number | null; noPack?: boolean }

/**
 * Where a rank comes from. The Local Pack is the three-business box inside a
 * normal Google search (what a customer sees first); Maps is the full ranked
 * list in the Maps app. They share an index but the pack is scored inside a web
 * search, so the two can differ at the same spot. Tracked in this order.
 */
export type RankSource = 'local_pack' | 'maps' | 'organic';
export const RANK_SOURCES: readonly RankSource[] = ['local_pack', 'maps', 'organic'] as const;
/** Sources an owner can choose to track. 'organic' (the website's spot in the web results) is never chosen: it is read for free from the same page the Local Pack scan fetches. */
export const SCANNABLE_SOURCES: readonly RankSource[] = ['local_pack', 'maps'] as const;
export const DEFAULT_RANK_SOURCES: readonly RankSource[] = SCANNABLE_SOURCES;
export function isRankSource(v: unknown): v is RankSource { return v === 'local_pack' || v === 'maps' || v === 'organic'; }
export function isScannableSource(v: unknown): v is RankSource { return v === 'local_pack' || v === 'maps'; }
export function sourceLabel(source: string): string { return source === 'local_pack' ? 'Local Pack' : source === 'maps' ? 'Google Maps' : source === 'organic' ? 'Website' : source; }
/** Order the sources the way the page shows them: pack first, then Maps, then the website. */
export function sortSources(sources: readonly RankSource[]): RankSource[] { return RANK_SOURCES.filter((s) => sources.includes(s)); }
/** Organic results only go 10 deep (the first page, the one the pack sits on); Maps goes to 20. */
export function maxRankFor(source: RankSource): number { return source === 'local_pack' ? 3 : source === 'organic' ? 10 : 20; }

export const GRID_SIZES = [5, 7, 9] as const;
export const SPACINGS_MILES = [0.5, 1, 2, 3] as const;
export const MAX_KEYWORDS = 10;

const MILES_PER_DEG_LAT = 69.0;

/** size×size points centred on (lat,lng), `spacingMiles` apart. */
export function buildGrid(lat: number, lng: number, size: number, spacingMiles: number): GridPoint[] {
  const half = (size - 1) / 2;
  const dLat = spacingMiles / MILES_PER_DEG_LAT;
  const dLng = spacingMiles / (MILES_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  const points: GridPoint[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      points.push({
        row: r,
        col: c,
        lat: +(lat + (half - r) * dLat).toFixed(6),
        lng: +(lng + (c - half) * dLng).toFixed(6),
      });
    }
  }
  return points;
}

/**
 * "Appliance repair service" -> "appliance repair"; "Oven & Range Repair" -> "oven & range repair".
 * "near me" is kept: it changes what Google thinks the searcher wants on the web
 * ("graphic designer" = jobs, "graphic designer near me" = hire one), so an owner
 * who types it means it.
 */
export function cleanKeyword(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(services?|company|companies|contractors?)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Up to five starting keywords: the primary category, then the first services. */
export function defaultKeywords(primaryCategory: string | null, serviceNames: string[]): string[] {
  const out: string[] = [];
  const push = (k: string) => { const c = cleanKeyword(k); if (c.length >= 4 && !out.includes(c)) out.push(c); };
  if (primaryCategory) push(primaryCategory);
  for (const s of serviceNames) { if (out.length >= 5) break; push(s); }
  return out.slice(0, 5);
}

export interface ScanSummary {
  totalPoints: number;
  foundPoints: number;
  top3Points: number;
  top10Points: number;
  /** Average rank over found points only; null when never found. */
  averageRank: number | null;
  /**
   * 0-100. Maps / Website: average "visibility" where rank 1 = 100 and not found = 0 (rank r scores max(0, max+1 - r) / max; max = 20 on Maps, 10 on the web page).
   * Local Pack: share of points where the business is in the pack (being in the box is what counts, not the slot).
   */
  visibility: number;
  /** Local Pack only: points where Google showed a pack at all. Points without one are not held against the business. */
  packShownPoints?: number;
}

export function summarize(points: ScannedPoint[], source: RankSource = 'maps'): ScanSummary {
  const found = points.filter((p) => p.rank !== null) as (ScannedPoint & { rank: number })[];
  const base = {
    totalPoints: points.length,
    foundPoints: found.length,
    top3Points: found.filter((p) => p.rank <= 3).length,
    top10Points: found.filter((p) => p.rank <= 10).length,
    averageRank: found.length ? Math.round((found.reduce((s, p) => s + p.rank, 0) / found.length) * 10) / 10 : null,
  };
  if (source === 'local_pack') {
    const shown = points.filter((p) => !p.noPack).length;
    return { ...base, packShownPoints: shown, visibility: Math.round((found.length / Math.max(1, shown)) * 100) };
  }
  const max = maxRankFor(source);
  const score = points.reduce((s, p) => s + (p.rank === null ? 0 : Math.max(0, max + 1 - p.rank) / max), 0);
  return { ...base, visibility: Math.round((score / Math.max(1, points.length)) * 100) };
}

/** Colour bucket for a cell, used by the page and the email. `nopack` = Google showed no Local Pack at that spot. */
export function rankTone(rank: number | null, noPack = false): 'top3' | 'top10' | 'top20' | 'none' | 'nopack' {
  if (noPack) return 'nopack';
  if (rank === null) return 'none';
  if (rank <= 3) return 'top3';
  if (rank <= 10) return 'top10';
  return 'top20';
}

/**
 * Find the business in a Maps result list: Place ID first, then a tolerant
 * title match (Google sometimes shows a slightly different name).
 */
export function findRank(
  items: { rank_group?: number; type?: string; place_id?: string | null; title?: string | null }[],
  placeId: string | null,
  businessName: string
): number | null {
  const organic = items.filter((i) => i.type === 'maps_search');
  if (placeId) {
    const hit = organic.find((i) => i.place_id === placeId);
    if (hit?.rank_group) return hit.rank_group;
  }
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const target = norm(businessName);
  if (!target) return null;
  const hit = organic.find((i) => {
    const t = norm(i.title || '');
    return t === target || t.startsWith(target) || target.startsWith(t) && t.length >= 8;
  });
  return hit?.rank_group ?? null;
}

/**
 * Find the business in the Local Pack of a web search: a tolerant title match
 * over the organic pack entries (ads in the pack are skipped and do not take a
 * slot). Returns null when the pack is there but the business is not.
 */
export function findPackRank(
  items: { type?: string; rank_group?: number; title?: string | null; is_paid?: boolean }[],
  businessName: string
): { rank: number | null; packShown: boolean } {
  const pack = items.filter((i) => i.type === 'local_pack');
  if (pack.length === 0) return { rank: null, packShown: false };
  const organic = pack.filter((i) => !i.is_paid);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const target = norm(businessName);
  if (!target) return { rank: null, packShown: true };
  const idx = organic.findIndex((i) => {
    const t = norm(i.title || '');
    return t === target || t.startsWith(target) || (target.startsWith(t) && t.length >= 8);
  });
  return { rank: idx === -1 ? null : idx + 1, packShown: true };
}

/** "https://www.Example.com/x" / "example.com" -> "example.com" */
export function normalizeHost(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase();
    return host.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/**
 * The website's position among the organic (non-ad) results of a web search:
 * the first entry whose domain is one of the site's hosts. Null when not on
 * the page fetched.
 */
export function findOrganicRank(
  items: { type?: string; rank_group?: number; domain?: string | null; url?: string | null }[],
  hosts: readonly string[]
): number | null {
  const wanted = new Set(hosts.map((h) => normalizeHost(h)).filter((h): h is string => !!h));
  if (wanted.size === 0) return null;
  const organic = items.filter((i) => i.type === 'organic');
  const idx = organic.findIndex((i) => {
    const host = normalizeHost(i.domain || i.url || '');
    return !!host && (wanted.has(host) || [...wanted].some((w) => host.endsWith(`.${w}`)));
  });
  return idx === -1 ? null : idx + 1;
}

/**
 * Web Mercator helpers for drawing scanned points over a Google Static Map.
 * At zoom z the world is 256 * 2^z pixels wide; a point's offset from the map
 * centre in pixels is the difference of their projected coordinates.
 */
function mercator(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const world = 256 * Math.pow(2, zoom);
  const sin = Math.sin((Math.min(85, Math.max(-85, lat)) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * world,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world,
  };
}

/** Largest integer zoom at which the whole grid fits within `fill` of a square map `sizePx` wide. */
export function fitZoom(points: { lat: number; lng: number }[], sizePx: number, fill = 0.82): number {
  if (points.length === 0) return 12;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const n = Math.max(...lats), s = Math.min(...lats), e = Math.max(...lngs), w = Math.min(...lngs);
  for (let z = 16; z >= 6; z--) {
    const a = mercator(n, w, z);
    const b = mercator(s, e, z);
    if (Math.abs(b.x - a.x) <= sizePx * fill && Math.abs(b.y - a.y) <= sizePx * fill) return z;
  }
  return 6;
}

/** Position of a point on a square static map centred on (cLat, cLng), as percentages of the map's width and height. */
export function mapPercent(lat: number, lng: number, cLat: number, cLng: number, zoom: number, sizePx: number): { left: number; top: number } {
  const c = mercator(cLat, cLng, zoom);
  const p = mercator(lat, lng, zoom);
  return { left: ((p.x - c.x) / sizePx + 0.5) * 100, top: ((p.y - c.y) / sizePx + 0.5) * 100 };
}

/** Display names for the assistants checked for AI visibility. Browser-safe. */
export function aiModelLabel(model: string): string {
  return model === 'claude' ? 'Claude' : model === 'openai' ? 'ChatGPT' : model === 'google_ai' ? 'Google AI Mode' : model;
}
