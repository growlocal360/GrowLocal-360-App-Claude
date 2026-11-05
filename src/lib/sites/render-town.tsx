/**
 * v6 town pages — shared loader + renderers.
 * ----------------------------------------------------------------------------
 *   /service-areas/{city}/            → renderTownPage()      (plain town, no GBP)
 *   /locations/{city}/                → renderTownPage()      (location: town with its own GBP)
 *   /locations/{city}/{service}/      → renderTownService()   (silo under a location)
 * The routes 301 between the two folders so each town has ONE canonical URL.
 *
 * Canonical spec: docs/architecture/growlocal360_master_prompt_v6.md
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { getSiteBySlug, type PublicSiteData } from '@/lib/sites/get-site';
import { getCategoriesWithServices, getServiceBySlugSingleLocation } from '@/lib/sites/get-services';
import { getAllGoogleReviewsForSite } from '@/lib/sites/get-reviews';
import { matchReviewsToCategory, matchReviewsToService } from '@/lib/sites/match-reviews';
import { getWorkItemsForPlace, getPublishedWorkItemsCount } from '@/lib/sites/get-work-items';
import { siteHasActiveBrands } from '@/lib/sites/has-active-brands';
import { getTemplate } from '@/lib/templates/registry';
import { isV6Plan, cityTreatmentBySlug, cityTreatmentByName } from '@/lib/sites/site-plan-store';
import { citySlugify } from '@/lib/routing/resolve-segment';
import { buildMainServiceList, type MainServiceEntry } from '@/lib/sites/main-service-list';
import { renderCategoryInCity } from '@/lib/sites/render-city-category';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import {
  toPublicSite, toPublicLocation, toPublicAreaDetail, toPublicAreaListing, toPublicCategory,
  toPublicServiceListing, toPublicServiceDetail, toPublicReview, toPublicWorkItem,
} from '@/lib/sites/public-render-model';
import type { ServiceAreaDB, SiteSettings, StoredSitePlan, Location } from '@/types/database';
import * as paths from '@/lib/routing/paths';

export interface TownContext {
  base: PublicSiteData;
  area: ServiceAreaDB;
  plan: StoredSitePlan | null;
  /** The town IS the Primary Market → its page is the home page. */
  isPrimaryMarket: boolean;
  /** The plan says this town has a page (always true for unplanned / v5-planned sites). */
  hasPage: boolean;
  /** Own GBP → lives under /locations/ with a silo beneath it. */
  promoted: boolean;
  /** The branch's own locations row (address, phone) when one matches the town. */
  branch: Location | null;
  primaryCategoryName: string;
  primaryCategorySlug: string;
}

/** The one canonical public path for a town: /locations/{city} when promoted, else /service-areas/{city}. */
export function canonicalTownPath(ctx: TownContext): string {
  return ctx.promoted ? paths.locationPage(ctx.area.slug) : paths.townPage(ctx.area.slug);
}

/**
 * Resolve a town by its URL slug. Returns 'primary_market' when the slug is the
 * Primary Market itself (its page is the home page — callers redirect), null
 * when the site or the town is unknown.
 */
export async function loadTown(siteSlug: string, townSlug: string): Promise<TownContext | 'primary_market' | null> {
  const base = await getSiteBySlug(siteSlug);
  if (!base) return null;
  const settings = (base.site.settings || {}) as SiteSettings;
  const plan = settings.site_plan ?? null;
  const v6 = isV6Plan(plan);
  const treatment = v6 && plan ? cityTreatmentBySlug(plan, townSlug) : null;
  const pmSlug = citySlugify(settings.primary_market_city || base.primaryLocation?.city || '');
  if (treatment?.treatment === 'primary_market' || (!!pmSlug && townSlug === pmSlug)) return 'primary_market';

  const area = base.serviceAreas.find((a) => a.slug === townSlug);
  if (!area) return null;
  const isPrimaryMarket = false;

  const { categories } = await getCategoriesWithServices(base.site.id);
  const primary = categories.find((c) => c.is_primary) || categories[0];
  const primaryCategoryName = primary?.gbp_category?.display_name || settings.core_industry || 'Services';
  const promoted = v6 ? treatment?.treatment === 'promoted' : !!area.is_anchor;
  const areaKey = area.name.trim().toLowerCase();
  const branch = promoted
    ? base.locations.find((l) => !l.is_primary && (l.slug === townSlug || (l.representative_city || l.city || '').trim().toLowerCase() === areaKey)) || null
    : null;

  return {
    base,
    area,
    plan,
    isPrimaryMarket,
    hasPage: v6 ? !!treatment?.has_page : true,
    promoted,
    branch,
    primaryCategoryName,
    primaryCategorySlug: normalizeCategorySlug(primaryCategoryName),
  };
}

/** Public URL of every town (linked only when the plan gave it a page). */
function areasWithPageUrls(base: PublicSiteData, plan: StoredSitePlan | null) {
  const treatment = isV6Plan(plan) && plan ? cityTreatmentByName(plan) : null;
  return base.serviceAreas.map((a) => {
    const listing = toPublicAreaListing(a);
    // No v6 plan yet → every town links (the town route renders permissively too).
    if (!treatment) return { ...listing, pageUrl: paths.townPage(a.slug) };
    const c = treatment.get(a.name.trim().toLowerCase());
    return { ...listing, pageUrl: c?.has_page && c.page_url && c.page_url !== '/' ? c.page_url.replace(/\/$/, '') : null };
  });
}

/** Render the town page. Callers handle the Primary Market redirect + the plan gate first. */
export async function renderTownPage(ctx: TownContext, siteSlug: string) {
  const { base, area } = ctx;
  const siteId = base.site.id;
  const admin = createAdminClient();
  const [{ categories, services }, allReviews, { data: schedulingConfig }, hasBrands, workItemsCount] = await Promise.all([
    getCategoriesWithServices(siteId),
    getAllGoogleReviewsForSite(siteId),
    admin.from('scheduling_configs').select('is_active, cta_style').eq('site_id', siteId).single(),
    siteHasActiveBrands(siteId),
    getPublishedWorkItemsCount(siteId),
  ]);
  const mainServices: MainServiceEntry[] = buildMainServiceList(categories, services);
  const { items: workItems, localCount } = await getWorkItemsForPlace(siteId, { city: area.name, areaId: area.id, limit: 6 });

  const publicReviews = allReviews.map(toPublicReview);
  const matched = matchReviewsToCategory(publicReviews, `${ctx.primaryCategoryName} ${area.name}`, services.map((s) => s.name));
  const displayReviews = matched.length > 0 ? matched : publicReviews.slice(0, 10);

  const introMap = ((base.site.settings as SiteSettings | null)?.city_page_intros) || {};
  const intro = introMap[`${ctx.primaryCategorySlug}/${area.slug}`.toLowerCase()] || null;

  const location = base.primaryLocation;
  if (!location) return null;

  const Area = getTemplate(base.site.template_id).Area;
  return (
    <Area
      data={{
        site: toPublicSite(base.site, { hasBrands }),
        location: toPublicLocation(location),
        serviceArea: toPublicAreaDetail(area),
        allServiceAreas: areasWithPageUrls(base, ctx.plan),
        services: services.map(toPublicServiceListing),
        categories: categories.map(toPublicCategory),
        mainServices,
        promoted: ctx.promoted,
        branch: ctx.branch ? toPublicLocation(ctx.branch) : null,
        primaryCategoryName: ctx.primaryCategoryName,
      }}
      siteSlug={siteSlug}
      googleReviews={displayReviews}
      recentWorkItems={workItems.map(toPublicWorkItem)}
      recentWorkTitle={localCount > 0 ? `Recent work in ${area.name}` : undefined}
      intro={intro}
      workItemsCount={workItemsCount}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
    />
  );
}

/** Which main-service entry a silo child slug refers to, or null. */
export async function resolveTownChild(siteId: string, childSlug: string): Promise<MainServiceEntry | null> {
  const { categories, services } = await getCategoriesWithServices(siteId);
  return buildMainServiceList(categories, services).find((m) => m.slug === childSlug) || null;
}

/**
 * Render a silo page under a PROMOTED town: the main-service entry localized
 * to the town. Categories reuse the category-in-city renderer; primary-category
 * services render the Service template with the town as its city.
 */
export async function renderTownService(ctx: TownContext, siteSlug: string, entry: MainServiceEntry) {
  const { base, area } = ctx;
  const city = { name: area.name, state: area.state || base.primaryLocation?.state || null };

  if (entry.kind === 'category') {
    return renderCategoryInCity({ siteSlug, categorySlug: entry.slug, citySeg: area.slug, city });
  }

  const data = await getServiceBySlugSingleLocation(siteSlug, entry.slug);
  if (!data) return null;
  const siteId = base.site.id;
  const admin = createAdminClient();
  const [allReviews, { categories }, { data: schedulingConfig }, hasBrands] = await Promise.all([
    getAllGoogleReviewsForSite(siteId),
    getCategoriesWithServices(siteId),
    admin.from('scheduling_configs').select('is_active, cta_style').eq('site_id', siteId).single(),
    siteHasActiveBrands(siteId),
  ]);
  const { items: workItems } = await getWorkItemsForPlace(siteId, { city: area.name, areaId: area.id, fallbackServiceIds: [data.service.id], limit: 6 });

  const navCategories: NavCategory[] = categories.map((c) => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));
  const publicReviews = allReviews.map(toPublicReview);
  const matched = matchReviewsToService(publicReviews, data.service.name);
  const displayReviews = matched.length > 0 ? matched : publicReviews.slice(0, 10);

  const introMap = ((base.site.settings as SiteSettings | null)?.city_page_intros) || {};
  const intro = introMap[`${entry.slug}/${area.slug}`.toLowerCase()] || null;
  const cityLabel = city.state ? `${city.name}, ${city.state}` : city.name;
  const service = toPublicServiceDetail(data.service);

  const Svc = getTemplate(base.site.template_id).Service;
  return (
    <Svc
      data={{
        site: toPublicSite(base.site, { hasBrands }),
        location: { ...toPublicLocation(data.location), city: city.name, state: city.state || data.location.state },
        service: { ...service, h1: `${data.service.name} in ${cityLabel}`, intro_copy: intro || service.intro_copy },
        category: toPublicCategory(data.category),
        siblingServices: data.siblingServices.map(toPublicServiceListing),
      }}
      siteSlug={siteSlug}
      isPrimaryCategory={data.category.is_primary}
      googleReviews={displayReviews}
      categories={navCategories}
      serviceAreas={areasWithPageUrls(base, ctx.plan)}
      recentWorkItems={workItems.map(toPublicWorkItem)}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
    />
  );
}
