/**
 * v5 Site Plan store + helpers.
 * ----------------------------------------------------------------------------
 * Bridges the pure planSite() planner (src/lib/onboarding/site-plan.ts) and the
 * database. The build pipeline computes a SitePlan and persists a JSON-stable
 * projection of it to `settings.site_plan`. The sitemap, the request-time
 * routing gate, and the /service-areas/ page read it back as the source of
 * truth for which v5 URLs actually exist.
 *
 * Canonical spec: docs/architecture/growlocal360_master_prompt_v5.md
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { planSite, type PlanInputs, type SitePlan, type BusinessType } from '@/lib/onboarding/site-plan';
import { resolvePrimaryMarket } from '@/lib/onboarding/primary-market';
import type { SiteSettings, StoredSitePlan, ServiceAreaDB } from '@/types/database';

/** Normalize a public path for set membership ("/Appliance-Repair/Peoria/" → "appliance-repair/peoria"). */
export function normalizePublicPath(path: string): string {
  return path.toLowerCase().replace(/^\/+|\/+$/g, '');
}

/** Project the pure SitePlan into the JSON-stable shape stored in settings. */
export function toStoredSitePlan(
  plan: SitePlan,
  meta: { travelStrategy: StoredSitePlan['travel_strategy']; primaryMarket: { city: string; state: string }; generatedAt: string },
): StoredSitePlan {
  return {
    generated_at: meta.generatedAt,
    travel_strategy: meta.travelStrategy,
    primary_market: meta.primaryMarket,
    gbp_website_link_recommendation: plan.gbpWebsiteLinkRecommendation,
    pages: plan.pages.map((p) => ({
      url: p.url,
      page_type: p.pageType,
      associated_city: p.associatedCity,
      associated_service: p.associatedService,
    })),
    cities: plan.cities.map((c) => ({
      city: c.city,
      state: c.state,
      treatment: c.treatment,
      has_page: c.hasPage,
      page_url: c.pageUrl,
      distance_from_primary_market: c.distanceFromPrimaryMarket,
    })),
    do_not_build: plan.doNotBuild,
  };
}

/**
 * Build planSite() inputs from loaded site data. Derives the Primary Market
 * (stored v5 settings, else inferred) and the city list (anchored + distance).
 *
 * `businessType` is derived simply: a primary location with a street address is
 * treated as Physical, otherwise SAB. (There's no dedicated field yet; this only
 * affects copy framing, not the URL rules that the test relies on.)
 */
export function buildPlanInputs(args: {
  settings: SiteSettings | null | undefined;
  primaryLocation: { city: string | null; state: string | null; address?: string | null } | null | undefined;
  /** GBP category display names, primary first. */
  gbpCategories: string[];
  serviceAreas: Pick<ServiceAreaDB, 'name' | 'state' | 'is_anchor' | 'distance_miles' | 'is_priority'>[];
  subServicesByService?: Record<string, string[]>;
}): { inputs: PlanInputs; primaryMarket: { city: string; state: string }; travelStrategy: PlanInputs['travelStrategy']; needsReview: boolean } {
  const resolved = resolvePrimaryMarket(args.settings, {
    fallbackCity: args.primaryLocation?.city,
    fallbackState: args.primaryLocation?.state,
    serviceAreaCount: args.serviceAreas.length,
    serviceAreaMaxMiles: args.serviceAreas.reduce<number | null>(
      (max, a) => (a.distance_miles != null ? Math.max(max ?? 0, a.distance_miles) : max),
      null,
    ),
  });

  const hasAddress = !!(args.primaryLocation?.address && args.primaryLocation.address.trim());
  const businessType: BusinessType = hasAddress ? 'physical' : 'sab';

  const gbpCategories = args.gbpCategories.filter(Boolean);

  // Top-services policy (which services get Pattern 1 city-page depth). The v5
  // rule is "top 2-3 services only" to prevent thin-page bloat. Until services
  // are ranked by real demand (GSC/keyword volume — see the GSC feedback loop),
  // we default to the top 3 GBP categories by list order. Top 3 (not 2) so a
  // high-demand service like washer/dryer repair isn't dropped just for being
  // listed third. This is a deliberate heuristic; the proper fix ranks by
  // evidence rather than order.
  const TOP_SERVICES_COUNT = 3;
  const topServices = gbpCategories.slice(0, TOP_SERVICES_COUNT);

  const inputs: PlanInputs = {
    businessType,
    travelStrategy: resolved.travelStrategy,
    primaryMarket: { city: resolved.city, state: resolved.state },
    gbpCategories,
    topServices,
    homepageIsPrimaryMarket: args.settings?.homepage_is_primary_market === true,
    subServicesByService: args.subServicesByService,
    serviceAreaCities: args.serviceAreas.map((a) => ({
      city: a.name,
      state: a.state || resolved.state,
      anchored: !!a.is_anchor,
      distanceMiles: a.distance_miles,
      priority: !!a.is_priority,
    })),
  };

  return { inputs, primaryMarket: { city: resolved.city, state: resolved.state }, travelStrategy: resolved.travelStrategy, needsReview: resolved.needsReview };
}

/** Convenience: build inputs and run the planner in one call. */
export function computeSitePlan(args: Parameters<typeof buildPlanInputs>[0]): {
  plan: SitePlan;
  primaryMarket: { city: string; state: string };
  travelStrategy: PlanInputs['travelStrategy'];
  needsReview: boolean;
} {
  const { inputs, primaryMarket, travelStrategy, needsReview } = buildPlanInputs(args);
  return { plan: planSite(inputs), primaryMarket, travelStrategy, needsReview };
}

/** Read the persisted plan for a site (null for pre-v5 sites — callers fall back). */
export async function getStoredSitePlan(siteId: string): Promise<StoredSitePlan | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from('sites').select('settings').eq('id', siteId).single();
  const plan = (data?.settings as SiteSettings | null)?.site_plan;
  return plan ?? null;
}

/**
 * The set of normalized public paths the plan says EXIST (city hubs + their
 * services + Pattern 1 + Primary Market hub/services). The routing gate uses
 * this to 404 un-planned city/service combos (proximity-covered, non-top
 * services) so thin pages never render.
 */
export function plannedCityPathSet(plan: StoredSitePlan): Set<string> {
  const cityPageTypes = new Set([
    'primary_market_hub',
    'primary_market_service',
    'pattern_1_city',
    'city_hub',
    'city_hub_service',
  ]);
  const set = new Set<string>();
  for (const p of plan.pages) {
    if (cityPageTypes.has(p.page_type)) set.add(normalizePublicPath(p.url));
  }
  return set;
}

/**
 * Does the plan say this two-segment city/service public path EXISTS? Used by the
 * routing gate so proximity-covered cities and non-top services 404 instead of
 * rendering a thin page. Backwards-compat: pre-v5 sites have no plan → permissive
 * (returns true) so existing sites keep working.
 */
export async function isPlannedCityPath(siteId: string, publicPath: string): Promise<boolean> {
  const plan = await getStoredSitePlan(siteId);
  if (!plan) return true; // no plan (pre-v5) → don't gate
  return plannedCityPathSet(plan).has(normalizePublicPath(publicPath));
}

/** Look up a city's treatment by name (case-insensitive) for the /service-areas/ listing. */
export function cityTreatmentByName(plan: StoredSitePlan): Map<string, StoredSitePlan['cities'][number]> {
  const map = new Map<string, StoredSitePlan['cities'][number]>();
  for (const c of plan.cities) map.set(c.city.trim().toLowerCase(), c);
  return map;
}
