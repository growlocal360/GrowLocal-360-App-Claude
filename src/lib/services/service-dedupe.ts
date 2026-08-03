/**
 * Cross-category service de-duplication for the wizard Services step.
 *
 * Overlapping GBP categories (e.g. "Air conditioning repair service" +
 * "Air conditioning contractor" + "HVAC contractor") make the LLM suggest the
 * same sub-service under several categories. These pure helpers enforce the rule
 * that a given sub-service lives under exactly ONE category — used by the suggest
 * route (server), the Services step (custom-add + move checks), and tests.
 *
 * Industry-generic: no hardcoded brand/trade names.
 */

/** A service as it exists in wizard state (subset needed for de-dup). */
export interface DedupeService {
  name: string;
  categoryGcid: string;
  categoryName: string;
}

const FILLER = new Set(['and', 'the', 'your', 'a', 'an', 'of', 'for']);
// Interchangeable trailing nouns that don't change the underlying service, so
// "Indoor Air Quality Services" ≡ "Indoor Air Quality Solutions".
const INTERCHANGEABLE_TAIL = new Set(['services', 'service', 'solutions', 'solution']);

/**
 * Canonical key for comparing two service names. Lowercases, strips punctuation
 * and filler words, and drops a trailing interchangeable noun.
 *
 * @example
 *   normalizeServiceName('Indoor Air Quality Services')  // 'indoor air quality'
 *   normalizeServiceName('Indoor Air Quality Solutions') // 'indoor air quality'
 *   normalizeServiceName('AC Repair & Diagnostic Service') // 'ac repair diagnostic'
 */
export function normalizeServiceName(name: string): string {
  const tokens = (name || '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !FILLER.has(t));
  while (tokens.length > 1 && INTERCHANGEABLE_TAIL.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(' ');
}

/**
 * Find an existing service whose normalized name matches `name`. Used to warn on
 * custom-add and to block a move that would create a duplicate. Optionally scope
 * to a single category (for move-collision checks).
 */
export function findDuplicateService<T extends DedupeService>(
  name: string,
  services: T[],
  opts?: { inCategoryGcid?: string; excludeName?: string }
): T | null {
  const key = normalizeServiceName(name);
  if (!key) return null;
  const excludeKey = opts?.excludeName ? normalizeServiceName(opts.excludeName) : null;
  return (
    services.find(
      (s) =>
        normalizeServiceName(s.name) === key &&
        (opts?.inCategoryGcid ? s.categoryGcid === opts.inCategoryGcid : true) &&
        (excludeKey ? normalizeServiceName(s.name) !== excludeKey || s.name === name : true)
    ) || null
  );
}

interface DedupeOpts {
  primaryGcid?: string;
  /** gcid → category display name, used for best-fit keeper selection. */
  categoryNameById?: Record<string, string>;
}

/**
 * When the same (normalized) service appears under multiple categories, keep ONE
 * best-fit copy and drop the rest — a deterministic safety net behind the LLM's
 * single-pass generation. Preserves original order otherwise. Industry-generic.
 *
 * Keeper preference for a colliding service:
 *   1. repair/diagnostic-type name → category whose name mentions repair/service
 *   2. install/replace-type name    → category whose name mentions contractor/install
 *   3. whole-system name (duct/thermostat/air quality/system) → broadest category
 *   4. the primary category
 *   5. first occurrence
 */
export function dedupeGeneratedServices<T extends DedupeService>(
  services: T[],
  opts: DedupeOpts = {}
): T[] {
  const groups = new Map<string, T[]>();
  const order: string[] = [];
  for (const s of services) {
    const key = normalizeServiceName(s.name);
    if (!key) continue;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(s);
  }

  const catName = (gcid: string) =>
    (opts.categoryNameById?.[gcid] || '').toLowerCase();

  const pickKeeper = (copies: T[]): T => {
    if (copies.length === 1) return copies[0];
    const n = normalizeServiceName(copies[0].name);
    const byCat = (re: RegExp) => copies.find((c) => re.test(catName(c.categoryGcid)));

    if (/\b(repair|diagnos|service|maintenance)\b/.test(n)) {
      const hit = byCat(/repair|service/);
      if (hit) return hit;
    }
    if (/\b(install|replace|installation|replacement)\b/.test(n)) {
      const hit = byCat(/contractor|install/);
      if (hit) return hit;
    }
    if (/\b(duct|ductwork|thermostat|air quality|system|zoning)\b/.test(n)) {
      // Whole-system services belong under the BROADEST category: prefer a
      // "contractor" category, and among candidates the one with the fewest
      // words in its name (e.g. "HVAC contractor" over "Air conditioning contractor").
      const contractors = copies.filter((c) => /contractor/.test(catName(c.categoryGcid)));
      const pool = contractors.length ? contractors : copies;
      return [...pool].sort(
        (a, b) => catName(a.categoryGcid).split(' ').length - catName(b.categoryGcid).split(' ').length
      )[0];
    }
    if (opts.primaryGcid) {
      const prim = copies.find((c) => c.categoryGcid === opts.primaryGcid);
      if (prim) return prim;
    }
    return copies[0];
  };

  return order.map((key) => pickKeeper(groups.get(key)!));
}

/**
 * Re-home a service under a different category, preserving everything else
 * (name, description, selection, custom flag). Appends to the end of the target
 * group's sort order so it renders last there. Returns a NEW array.
 */
export function moveService<T extends DedupeService & { id: string; sortOrder?: number }>(
  services: T[],
  id: string,
  targetGcid: string,
  targetName: string
): T[] {
  const maxSort = services.reduce((m, s) => Math.max(m, s.sortOrder ?? 0), 0);
  return services.map((s) =>
    s.id === id
      ? { ...s, categoryGcid: targetGcid, categoryName: targetName, sortOrder: maxSort + 1 }
      : s
  );
}
