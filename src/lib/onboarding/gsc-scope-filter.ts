/**
 * GSC data scope filter — v4 onboarding analysis PART 0.
 * ----------------------------------------------------------------------------
 * Pure function: takes the user's raw GSC queries + a SiteScope and returns
 * only the queries relevant to the geography the site is being built for.
 *
 * Why this exists: a multi-city business's GSC property mixes search demand
 * from ALL the cities they serve. When the user builds a microsite or
 * city-specific section, using the raw aggregate would treat demand from
 * other cities as if it belonged to the target city — bad recommendations.
 *
 * This filter runs BEFORE any analysis. See growlocal360_master_prompt_v4.md
 * "NEW v4 GSC FILTERING LOGIC" for the spec this implements.
 *
 * No DB calls, no side effects — pure logic, easy to unit-test.
 */

import { isFilteredScope, type SiteScope } from './site-scope';

/**
 * Subset of the `gsc_queries` row shape the filter needs. Callers pass
 * rows straight from a Supabase query — only these columns are read.
 */
export interface GscQueryForFilter {
  query: string;
  page_url: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * The threshold below which we tell the user "this scope shows very low
 * demand — verify before investing." Per v4 spec.
 */
export const LOW_SIGNAL_IMPRESSIONS_THRESHOLD = 100;

export type FilteringConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface FilteringReport {
  /** What scope was applied (echoed for audit). */
  scope_type: SiteScope['scope_type'];
  target_city: string | null;
  /** Total queries in the input set. */
  original_query_count: number;
  /** Queries that passed the filter. */
  filtered_query_count: number;
  /** Sum of impressions across input queries. */
  original_impressions: number;
  /** Sum of impressions across filtered queries. */
  filtered_impressions: number;
  /** % of original impressions retained (0–100). */
  retention_pct: number;
  /** Queries dropped because they explicitly mentioned an excluded city. */
  excluded_by_city_mention: number;
  /** Triggered when filtered_impressions < LOW_SIGNAL_IMPRESSIONS_THRESHOLD. */
  low_signal_warning: boolean;
  /** When >80% of input was dropped, the scope may be too narrow OR the GSC property is multi-city. */
  high_drop_warning: boolean;
  /**
   * Confidence in the filtered dataset:
   *   - HIGH:   FULL_BUSINESS scope OR filtered count >= 50% of original
   *   - MEDIUM: 20% <= retention < 50%
   *   - LOW:    retention < 20%, or low_signal_warning fired
   */
  confidence: FilteringConfidence;
}

export interface FilterResult {
  /** Queries that pass the filter, original order preserved. */
  scoped_queries: GscQueryForFilter[];
  /** Summary stats + warnings. */
  filtering_report: FilteringReport;
}

/**
 * Filter raw GSC queries down to those relevant to the given SiteScope.
 *
 * FULL_BUSINESS scope returns the input set unchanged with a HIGH-confidence
 * report. MICROSITE / CITY_SPECIFIC scopes apply the v4 inclusion/exclusion
 * rules:
 *
 *   Include if ANY of:
 *     - query text contains any city variant (case-insensitive substring)
 *     - query text contains any target zip code
 *     - page_url contains the existing_url_pattern (for migrations)
 *
 *   Then exclude if:
 *     - query text explicitly mentions any excluded city
 *
 * Per v4 spec, exclusion takes precedence over inclusion: a query mentioning
 * both target_city AND an excluded_city is dropped (ambiguous intent).
 */
export function filterGscByScope(
  queries: GscQueryForFilter[],
  scope: SiteScope
): FilterResult {
  const originalQueryCount = queries.length;
  const originalImpressions = sumImpressions(queries);

  // FULL_BUSINESS — pass everything through unchanged.
  if (!isFilteredScope(scope)) {
    return {
      scoped_queries: queries,
      filtering_report: {
        scope_type: scope.scope_type,
        target_city: scope.target_city,
        original_query_count: originalQueryCount,
        filtered_query_count: originalQueryCount,
        original_impressions: originalImpressions,
        filtered_impressions: originalImpressions,
        retention_pct: 100,
        excluded_by_city_mention: 0,
        low_signal_warning: false,
        high_drop_warning: false,
        confidence: 'HIGH',
      },
    };
  }

  // Normalize the lookup tokens once, not per-query.
  const cityVariants = scope.city_variants
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0);
  const zipCodes = scope.zip_codes
    .map((z) => z.trim())
    .filter((z) => z.length > 0);
  const excludedCities = scope.excluded_cities
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);
  const urlPattern = scope.existing_url_pattern?.toLowerCase() || null;

  let excludedByCityMention = 0;
  const scoped: GscQueryForFilter[] = [];

  for (const q of queries) {
    const text = (q.query || '').toLowerCase();
    const page = (q.page_url || '').toLowerCase();

    // ── Inclusion checks (any one passes) ──────────────────────────────
    let include = false;
    if (cityVariants.some((v) => text.includes(v))) include = true;
    if (!include && zipCodes.some((z) => text.includes(z))) include = true;
    if (!include && urlPattern && page.includes(urlPattern)) include = true;

    if (!include) continue;

    // ── Exclusion check (precedence over inclusion) ────────────────────
    const mentionsExcluded = excludedCities.some((c) => text.includes(c));
    if (mentionsExcluded) {
      excludedByCityMention++;
      continue;
    }

    scoped.push(q);
  }

  const filteredQueryCount = scoped.length;
  const filteredImpressions = sumImpressions(scoped);
  const retentionPct =
    originalImpressions === 0
      ? 0
      : Math.round((filteredImpressions / originalImpressions) * 100);
  const lowSignal = filteredImpressions < LOW_SIGNAL_IMPRESSIONS_THRESHOLD;

  let confidence: FilteringConfidence = 'HIGH';
  if (lowSignal) {
    confidence = 'LOW';
  } else if (retentionPct < 20) {
    confidence = 'LOW';
  } else if (retentionPct < 50) {
    confidence = 'MEDIUM';
  }

  return {
    scoped_queries: scoped,
    filtering_report: {
      scope_type: scope.scope_type,
      target_city: scope.target_city,
      original_query_count: originalQueryCount,
      filtered_query_count: filteredQueryCount,
      original_impressions: originalImpressions,
      filtered_impressions: filteredImpressions,
      retention_pct: retentionPct,
      excluded_by_city_mention: excludedByCityMention,
      low_signal_warning: lowSignal,
      high_drop_warning: originalQueryCount > 0 && retentionPct < 20,
      confidence,
    },
  };
}

function sumImpressions(qs: GscQueryForFilter[]): number {
  let total = 0;
  for (const q of qs) total += q.impressions || 0;
  return total;
}
