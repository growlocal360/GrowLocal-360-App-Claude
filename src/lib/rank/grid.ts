/**
 * Pure helpers for Maps grid rank tracking: the grid of coordinates around a
 * business, default keywords from its categories and services, and the roll-up
 * of a scan into the numbers owners read.
 */

export interface GridPoint { row: number; col: number; lat: number; lng: number }
export interface ScannedPoint extends GridPoint { rank: number | null }

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

/** "Appliance repair service" -> "appliance repair"; "Oven & Range Repair" -> "oven & range repair" */
export function cleanKeyword(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(services?|company|companies|contractors?|near me)\b/g, ' ')
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
  /** 0-100: average "visibility" where rank 1 = 100 and not found = 0 (rank r scores max(0, 21 - r) / 20). */
  visibility: number;
}

export function summarize(points: ScannedPoint[]): ScanSummary {
  const found = points.filter((p) => p.rank !== null) as (ScannedPoint & { rank: number })[];
  const score = points.reduce((s, p) => s + (p.rank === null ? 0 : Math.max(0, 21 - p.rank) / 20), 0);
  return {
    totalPoints: points.length,
    foundPoints: found.length,
    top3Points: found.filter((p) => p.rank <= 3).length,
    top10Points: found.filter((p) => p.rank <= 10).length,
    averageRank: found.length ? Math.round((found.reduce((s, p) => s + p.rank, 0) / found.length) * 10) / 10 : null,
    visibility: Math.round((score / Math.max(1, points.length)) * 100),
  };
}

/** Colour bucket for a cell, used by the page and the email. */
export function rankTone(rank: number | null): 'top3' | 'top10' | 'top20' | 'none' {
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
