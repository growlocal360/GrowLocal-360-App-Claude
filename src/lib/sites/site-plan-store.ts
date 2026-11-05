/**
 * v6 Site Plan store + helpers.
 * ----------------------------------------------------------------------------
 * Bridges the pure planSite() planner (src/lib/onboarding/site-plan.ts) and the
 * database. The build pipeline computes a SitePlan and persists a JSON-stable
 * projection of it to `settings.site_plan`. The sitemap, the request-time
 * routing gate, the nav and the /service-areas/ hub read it back as the source
 * of truth for which town pages (and silo pages) actually exist.
 *
 * Canonical spec: docs/architecture/growlocal360_master_prompt_v6.md
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { planSite, citySlug, type PlanInputs, type SitePlan, type BusinessType } from '@/lib/onboarding/site-plan';
import { resolvePrimaryMarket } from '@/lib/onboarding/primary-market';
import type { SiteSettings, StoredSitePlan, ServiceAreaDB } from '@/types/database';

export const SITE_PLAN_VERSION = 6;

/** Normalize a public path for set membership ("/Service-Areas/Peoria/" → "service-areas/peoria"). */
export function normalizePublicPath(path: string): string {
  return path.toLowerCase().replace(/^\/+|\/+$/g, '');
}

/** Project the pure SitePlan into the JSON-stable shape stored in settings. */
export function toStoredSitePlan(
  plan: SitePlan,
  meta: { travelStrategy: StoredSitePlan['travel_strategy']; primaryMarket: { city: string; state: string }; generatedAt: string },
): StoredSitePlan {
  return {
    version: SITE_PLAN_VERSION,
    generated_at: meta.generatedAt,
    travel_strategy: meta.travelStrategy,
    primary_market: meta.primaryMarket,
    gbp_website_link_recommendation: plan.gbpWebsiteLinkRecommendation,
    gbp_website_links: plan.gbpWebsiteLinks,
    pages: plan.pages.map((p) => ({
      url: p.url,
      page_type: p.pageType,
      associated_city: p.associatedCity,
      associated_service: p.associatedService,
    })),
    cities: plan.cities.map((c) => ({
      city: c.city,
      state: c.state,
      slug: c.slug,
      treatment: c.treatment,
      has_page: c.hasPage,
      page_url: c.pageUrl,
      distance_from_primary_market: c.distanceFromPrimaryMarket,
      reason: c.reason,
    })),
    do_not_build: plan.doNotBuild,
  };
}

/**
 * Build planSite() inputs from loaded site data. Derives the Primary Market
 * (stored settings, else inferred) and the town list (anchored + distance +
 * priority), plus the primary-category services that lead the main service list.
 */
export function buildPlanInputs(args: {
  settings: SiteSettings | null | undefined;
  primaryLocation: { city: string | null; state: string | null; address?: string | null } | null | undefined;
  /** GBP category display names, primary first. */
  gbpCategories: string[];
  /** Services of the PRIMARY category ({ name, slug }) in display order. */
  primaryServices?: Array<{ name: string; slug: string }>;
  serviceAreas: Pick<ServiceAreaDB, 'name' | 'state' | 'is_anchor' | 'distance_miles' | 'is_priority'>[];
  subServicesByService?: Record<string, string[]>;
  neighborhoods?: string[];
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

  const inputs: PlanInputs = {
    businessType,
    travelStrategy: resolved.travelStrategy,
    primaryMarket: { city: resolved.city, state: resolved.state },
    gbpCategories: args.gbpCategories.filter(Boolean),
    primaryServices: args.primaryServices,
    subServicesByService: args.subServicesByService,
    neighborhoods: args.neighborhoods,
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

/** Read the persisted plan for a site (null for sites never planned — callers fall back). */
export async function getStoredSitePlan(siteId: string): Promise<StoredSitePlan | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from('sites').select('settings').eq('id', siteId).single();
  const plan = (data?.settings as SiteSettings | null)?.site_plan;
  return plan ?? null;
}

/** True when the stored plan was produced by the v6 planner (town pages under /service-areas/). */
export function isV6Plan(plan: StoredSitePlan | null | undefined): boolean {
  return !!plan && (plan.version ?? 0) >= SITE_PLAN_VERSION;
}

/**
 * The set of normalized public paths the plan says EXIST for towns: every
 * plain town page, every location page, and every silo page under a location. The routing gate uses
 * this to 404 towns that are text-only (proximity-covered / over the cap) and
 * silo URLs under towns that are not promoted.
 */
export function plannedCityPathSet(plan: StoredSitePlan): Set<string> {
  const townPageTypes = new Set(['town_page', 'town_service', 'location_page', 'location_service', 'locations_index']);
  const set = new Set<string>();
  for (const p of plan.pages) {
    if (townPageTypes.has(p.page_type)) set.add(normalizePublicPath(p.url));
  }
  return set;
}

/**
 * Does the plan say this town / silo public path EXISTS? Sites that were never
 * planned (or still carry a v5 plan) are permissive so nothing 404s before the
 * next regenerate.
 */
export async function isPlannedCityPath(siteId: string, publicPath: string): Promise<boolean> {
  const plan = await getStoredSitePlan(siteId);
  if (!isV6Plan(plan)) return true;
  return plannedCityPathSet(plan!).has(normalizePublicPath(publicPath));
}

/** Look up a town's treatment by name (case-insensitive) for listings/nav. */
export function cityTreatmentByName(plan: StoredSitePlan): Map<string, StoredSitePlan['cities'][number]> {
  const map = new Map<string, StoredSitePlan['cities'][number]>();
  for (const c of plan.cities) map.set(c.city.trim().toLowerCase(), c);
  return map;
}

/** Look up a town's treatment by its URL slug. Old (v5) plans have no slug → derive from the name. */
export function cityTreatmentBySlug(plan: StoredSitePlan, slug: string): StoredSitePlan['cities'][number] | null {
  const want = slug.toLowerCase();
  for (const c of plan.cities) {
    const s = (c.slug || citySlug(c.city)).toLowerCase();
    if (s === want) return c;
  }
  return null;
}
