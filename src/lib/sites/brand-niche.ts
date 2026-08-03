/**
 * Dual-niche brand helpers.
 *
 * A brand may belong to one niche (a `site_categories` row, e.g. Carrier → HVAC)
 * or to all niches ("Both" = `site_category_id` null, e.g. GE). These pure helpers
 * decide which services a brand page lists and which category its content is
 * generated against. Shared so the public page and the generator stay in sync.
 */

/**
 * Services shown on a brand page: only the brand's own niche when it's tied to a
 * category; all services when the brand spans niches (null).
 */
export function filterServicesForBrand<T extends { site_category_id: string | null }>(
  services: T[],
  brandCategoryId: string | null
): T[] {
  return brandCategoryId ? services.filter((s) => s.site_category_id === brandCategoryId) : services;
}

/**
 * Category name a brand's page content is generated against: the brand's own
 * category when set + known, otherwise the fallback (the combined home label,
 * e.g. "HVAC & Appliance Repair", so a "Both" brand reads across niches).
 */
export function resolveBrandCategoryName(
  brandCategoryId: string | null,
  categoryNameById: Map<string, string>,
  fallbackLabel: string
): string {
  return (brandCategoryId && categoryNameById.get(brandCategoryId)) || fallbackLabel;
}
