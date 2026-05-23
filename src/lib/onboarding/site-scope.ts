/**
 * SiteScope — runtime representation of v4 SITE_SCOPE.
 * ----------------------------------------------------------------------------
 * Built during the wizard step "Site Scope", persisted to the sites table
 * columns (scope_type, scope_target_city, scope_city_variants, etc.), and
 * read back by the GSC scope filter, the Claude orchestrator, and any
 * future analysis steps that need to know "what geography is this site for?"
 *
 * Three scope types (REGION_SPECIFIC deferred to v4.1):
 *   - FULL_BUSINESS  — site covers everything the user serves; no GSC filter
 *   - MICROSITE      — separate domain or microsite focused on one city
 *   - CITY_SPECIFIC  — subdirectory or section of a larger site focused on
 *                      one city (e.g., main site with /lakewood-ranch/)
 */

import type { ScopeType, Site } from '@/types/database';

export interface SiteScope {
  scope_type: ScopeType;
  target_city: string | null;
  city_variants: string[];
  zip_codes: string[];
  excluded_cities: string[];
  existing_url_pattern: string | null;
}

/**
 * Default scope when no scoping is needed (or for legacy sites that
 * predate migration 050).
 */
export const FULL_BUSINESS_SCOPE: SiteScope = {
  scope_type: 'FULL_BUSINESS',
  target_city: null,
  city_variants: [],
  zip_codes: [],
  excluded_cities: [],
  existing_url_pattern: null,
};

/**
 * Read the persisted scope off a Site row. Returns FULL_BUSINESS_SCOPE
 * when scope_type is NULL (legacy site or wizard step skipped).
 */
export function siteScopeFromRow(site: Pick<
  Site,
  | 'scope_type'
  | 'scope_target_city'
  | 'scope_city_variants'
  | 'scope_zip_codes'
  | 'scope_excluded_cities'
  | 'scope_existing_url_pattern'
>): SiteScope {
  if (!site.scope_type) return FULL_BUSINESS_SCOPE;
  return {
    scope_type: site.scope_type,
    target_city: site.scope_target_city,
    city_variants: site.scope_city_variants ?? [],
    zip_codes: site.scope_zip_codes ?? [],
    excluded_cities: site.scope_excluded_cities ?? [],
    existing_url_pattern: site.scope_existing_url_pattern,
  };
}

/**
 * True when the scope says "filter GSC data" — i.e., MICROSITE or
 * CITY_SPECIFIC. FULL_BUSINESS skips filtering entirely.
 */
export function isFilteredScope(scope: SiteScope): boolean {
  return scope.scope_type === 'MICROSITE' || scope.scope_type === 'CITY_SPECIFIC';
}

/**
 * True when the scope has enough signal to actually filter meaningfully.
 * A MICROSITE with no city variants / zips / URL pattern is effectively
 * unscopable — the filter would either pass everything or reject everything.
 */
export function hasFilteringSignal(scope: SiteScope): boolean {
  if (!isFilteredScope(scope)) return false;
  return (
    scope.city_variants.length > 0 ||
    scope.zip_codes.length > 0 ||
    !!scope.existing_url_pattern
  );
}
