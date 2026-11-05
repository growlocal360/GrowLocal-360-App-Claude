/**
 * Site Plan — v6 Town Page model page-inventory planner.
 * ----------------------------------------------------------------------------
 * Pure, deterministic function that turns onboarding inputs into the page
 * inventory, internal-linking map, town treatment table, and the GBP
 * website-link recommendations, applying the v6 URL rules.
 *
 * Canonical spec: docs/architecture/growlocal360_master_prompt_v6.md
 *
 * The tree (four clicks, everything links up):
 *
 *   /                                   {primary category} in {Primary Market}  ← GBP #1
 *   /{service}/                         main service list, flat at root
 *   /{category}/{service}/              secondary-category services nest under their hub
 *   /service-areas/                     hub: towns WITHOUT their own GBP
 *   /service-areas/{city}/              one page per town, ALL main services, cards → root
 *   /locations/                         hub: pages WITH their own GBP
 *   /locations/{city}/                  location page (GBP #2+ landing page), cards → its silo
 *   /locations/{city}/{service}/        silo — only under a location
 *   /neighborhoods/{slug}/              Primary Market neighborhoods
 *
 * This module makes NO database / network calls — it's the planning brain. The
 * generation pipeline (and the tests) call planSite() and act on the result.
 */

import { normalizeCategorySlug } from '@/lib/utils/slugify';
import type { TravelStrategy } from '@/types/wizard';

export type BusinessType = 'physical' | 'sab' | 'hybrid';

export type PageType =
  | 'homepage'
  /** A primary-category service at the root: /{service}/ */
  | 'main_service'
  /** A secondary GBP category hub at the root: /{category}/ */
  | 'category_hub'
  /** A secondary-category service nested under its hub: /{category}/{service}/ */
  | 'sub_service'
  | 'service_areas'
  /** /service-areas/{city}/ — plain town page (no GBP of its own) */
  | 'town_page'
  /** /locations/ — hub of every page with its own GBP (only when at least one exists) */
  | 'locations_index'
  /** /locations/{city}/ — location page: a town / branch with its own GBP (PROMOTED) */
  | 'location_page'
  /** /locations/{city}/{service}/ — silo page under a location */
  | 'location_service'
  /** /neighborhoods/{slug}/ — Primary Market neighborhood */
  | 'neighborhood'
  | 'utility';

export type CityTreatment =
  /** The Primary Market: its page is the home page. */
  | 'primary_market'
  /** Town has its own GBP listing → /locations/{city}/ + silo beneath it. */
  | 'promoted'
  /** Town page with the full main service list, cards → root pages. */
  | 'plain_page'
  /** Within ~10 mi of the Primary Market → text on /service-areas/ only. */
  | 'proximity_covered'
  /** Over the travel-strategy cap → text on /service-areas/ only. */
  | 'text_mention_only'
  | 'excluded';

export interface PlannedPage {
  url: string;
  pageType: PageType;
  title: string;
  associatedCity: string | null;
  associatedService: string | null;
  /** URLs this page links to (internal-linking map). */
  links: string[];
}

export interface CityPlan {
  city: string;
  state: string;
  slug: string;
  treatment: CityTreatment;
  hasPage: boolean;
  pageUrl: string | null;
  distanceFromPrimaryMarket: number | null;
  /** Why the town got this treatment (surfaced in the dashboard + DO_NOT_BUILD). */
  reason: string;
}

/** One entry of the main service list (home-page order). */
export interface MainServiceInput {
  name: string;
  /** The public slug exactly as routed (service.slug for services; normalized display name for categories). */
  slug: string;
}

export interface PlanInputs {
  businessType: BusinessType;
  travelStrategy: TravelStrategy;
  primaryMarket: { city: string; state: string };
  /** GBP category display names, PRIMARY FIRST. The primary category is the home page. */
  gbpCategories: string[];
  /**
   * Services that belong to the PRIMARY category. They live flat at root
   * (/{slug}/) and lead the main service list. Optional for callers that only
   * know categories (the plan then has secondary hubs only).
   */
  primaryServices?: MainServiceInput[];
  /** Secondary-category services keyed by the category display name; nested under the hub. */
  subServicesByService?: Record<string, string[]>;
  /** Towns served. anchored=true means the town has its own GBP listing (→ promoted). */
  serviceAreaCities: Array<{
    city: string;
    state: string;
    anchored?: boolean;
    distanceMiles?: number | null;
    /** Owner-forced "Dedicated page": a plain town page regardless of proximity or cap. */
    priority?: boolean;
  }>;
  /** Primary Market neighborhoods (names). */
  neighborhoods?: string[];
  /**
   * v5 compatibility. v6 ALWAYS treats the home page as the Primary Market page;
   * this flag is accepted and ignored so old callers compile.
   */
  homepageIsPrimaryMarket?: boolean;
  /** @deprecated v5 — ignored. */
  topServices?: string[];
  /** @deprecated v5 — ignored. */
  niches?: Array<{ key: string; topService: string }>;
}

export interface SitePlan {
  pages: PlannedPage[];
  cities: CityPlan[];
  /** GBP #1 website link. Always "/" in v6. */
  gbpWebsiteLinkRecommendation: string;
  /** Every GBP's recommended website link: the first → "/", each promoted town → its town page. */
  gbpWebsiteLinks: Array<{ city: string; url: string }>;
  /** Pages intentionally NOT built, with reasons (for the DO_NOT_BUILD output). */
  doNotBuild: Array<{ what: string; reason: string }>;
}

export const PROXIMITY_MILES = 10;
/** How many PLAIN town pages a travel strategy allows. Promoted + priority towns are not counted. */
export const TOWN_PAGE_CAP: Record<TravelStrategy, number> = {
  local: 0,
  regional: 9,
  metro: 12,
  'multi-market': 12,
};

export function citySlug(city: string): string {
  return city.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function svcSlug(service: string): string {
  return normalizeCategorySlug(service);
}
function titleCity(city: string, state: string): string {
  return state ? `${city}, ${state}` : city;
}

export const SERVICE_AREAS_URL = '/service-areas/';
export const LOCATIONS_URL = '/locations/';
export function townPageUrl(city: string): string {
  return `${SERVICE_AREAS_URL}${citySlug(city)}/`;
}
export function locationPageUrl(city: string): string {
  return `${LOCATIONS_URL}${citySlug(city)}/`;
}

/**
 * Build the full site plan from onboarding inputs, applying the v6 rules.
 */
export function planSite(input: PlanInputs): SitePlan {
  const { travelStrategy, primaryMarket } = input;
  const categories = input.gbpCategories.filter(Boolean);
  const primaryCategory = categories[0] || 'Services';
  const secondaryCategories = categories.slice(1);
  const pmSlug = citySlug(primaryMarket.city);
  const pmLabel = titleCity(primaryMarket.city, primaryMarket.state);

  const pages: PlannedPage[] = [];
  const doNotBuild: SitePlan['doNotBuild'] = [];
  const homeUrl = '/';

  // ── The main service list (home-page order): primary services, then secondary hubs ──
  const mainList: Array<{ name: string; slug: string; url: string; kind: 'service' | 'category' }> = [
    ...(input.primaryServices || []).map((s) => ({ name: s.name, slug: s.slug, url: `/${s.slug}/`, kind: 'service' as const })),
    ...secondaryCategories.map((c) => ({ name: c, slug: svcSlug(c), url: `/${svcSlug(c)}/`, kind: 'category' as const })),
  ];
  const mainUrls = mainList.map((m) => m.url);
  const neighborhoodUrls = (input.neighborhoods || []).map((n) => `/neighborhoods/${citySlug(n)}/`);
  const utilityUrls = ['/about/', '/contact/', '/reviews/', '/work/'];

  // ── CLICK 0: home = primary category in the Primary Market ───────────────
  pages.push({
    url: homeUrl,
    pageType: 'homepage',
    title: `${primaryCategory} in ${pmLabel}`,
    associatedCity: primaryMarket.city,
    associatedService: primaryCategory,
    links: [...mainUrls, SERVICE_AREAS_URL, ...neighborhoodUrls, ...utilityUrls],
  });

  // ── CLICK 1: main service pages (flat at root) ────────────────────────────
  for (const m of mainList) {
    if (m.kind === 'service') {
      pages.push({
        url: m.url,
        pageType: 'main_service',
        title: m.name,
        associatedCity: null,
        associatedService: m.name,
        links: [homeUrl, ...mainUrls.filter((u) => u !== m.url), SERVICE_AREAS_URL],
      });
    } else {
      const subs = input.subServicesByService?.[m.name] ?? [];
      const subUrls = subs.map((sub) => `${m.url}${svcSlug(sub)}/`);
      pages.push({
        url: m.url,
        pageType: 'category_hub',
        title: m.name,
        associatedCity: null,
        associatedService: m.name,
        links: [homeUrl, ...subUrls, ...mainUrls.filter((u) => u !== m.url), SERVICE_AREAS_URL],
      });
      subs.forEach((sub) => {
        const url = `${m.url}${svcSlug(sub)}/`;
        pages.push({
          url,
          pageType: 'sub_service',
          title: sub,
          associatedCity: null,
          associatedService: m.name,
          // sub-services link UP to their hub + SIDEWAYS to siblings; NEVER to town pages
          links: [m.url, ...subUrls.filter((u) => u !== url)],
        });
      });
    }
  }

  // ── CLICK 2/3: town treatment ────────────────────────────────────────────
  const cities: CityPlan[] = [];
  const cap = TOWN_PAGE_CAP[travelStrategy];
  let plainCount = 0;
  const townPageUrls: string[] = [];
  const locationPageUrls: string[] = [];
  const gbpWebsiteLinks: SitePlan['gbpWebsiteLinks'] = [{ city: primaryMarket.city, url: homeUrl }];

  cities.push({
    city: primaryMarket.city,
    state: primaryMarket.state,
    slug: pmSlug,
    treatment: 'primary_market',
    hasPage: true,
    pageUrl: homeUrl,
    distanceFromPrimaryMarket: 0,
    reason: 'Primary Market — the home page is its page.',
  });
  doNotBuild.push({ what: townPageUrl(primaryMarket.city), reason: 'The Primary Market never gets a town page; it redirects to the home page.' });

  const seen = new Set<string>([pmSlug]);
  for (const c of input.serviceAreaCities) {
    const slug = citySlug(c.city);
    if (!slug || seen.has(slug)) continue; // PM or duplicate
    seen.add(slug);
    const dist = c.distanceMiles ?? null;
    const url = townPageUrl(c.city);
    const label = titleCity(c.city, c.state);

    // 1) Own GBP → PROMOTED: a LOCATION page under /locations/ + a silo page per main service.
    if (c.anchored) {
      const locUrl = locationPageUrl(c.city);
      const siloUrls = mainList.map((m) => `${locUrl}${m.slug}/`);
      pages.push({
        url: locUrl,
        pageType: 'location_page',
        title: `${primaryCategory} in ${label}`,
        associatedCity: c.city,
        associatedService: null,
        links: [LOCATIONS_URL, homeUrl, ...siloUrls],
      });
      mainList.forEach((m, i) => {
        pages.push({
          url: siloUrls[i],
          pageType: 'location_service',
          title: `${m.name} in ${label}`,
          associatedCity: c.city,
          associatedService: m.name,
          links: [locUrl, m.url, ...siloUrls.filter((u) => u !== siloUrls[i])],
        });
      });
      locationPageUrls.push(locUrl);
      gbpWebsiteLinks.push({ city: c.city, url: locUrl });
      cities.push({ city: c.city, state: c.state, slug, treatment: 'promoted', hasPage: true, pageUrl: locUrl, distanceFromPrimaryMarket: dist, reason: 'Has its own Google Business Profile — location page under /locations/ with a service silo beneath it.' });
      doNotBuild.push({ what: url, reason: `${c.city} has its own GBP, so it lives at ${locUrl} instead.` });
      continue;
    }

    // 2) Owner-forced priority → plain town page, bypassing proximity + cap.
    if (c.priority) {
      pages.push({
        url,
        pageType: 'town_page',
        title: `${primaryCategory} in ${label}`,
        associatedCity: c.city,
        associatedService: null,
        links: [SERVICE_AREAS_URL, homeUrl, ...mainUrls],
      });
      townPageUrls.push(url);
      cities.push({ city: c.city, state: c.state, slug, treatment: 'plain_page', hasPage: true, pageUrl: url, distanceFromPrimaryMarket: dist, reason: 'Owner marked this town "Dedicated page".' });
      continue;
    }

    // 3) Within proximity of the Primary Market → covered by the home page.
    if (dist !== null && dist <= PROXIMITY_MILES) {
      cities.push({ city: c.city, state: c.state, slug, treatment: 'proximity_covered', hasPage: false, pageUrl: null, distanceFromPrimaryMarket: dist, reason: `Within ${PROXIMITY_MILES} miles of ${primaryMarket.city} — named on the home page and the service-areas index.` });
      doNotBuild.push({ what: url, reason: `Proximity-covered (${dist} mi from ${primaryMarket.city}).` });
      continue;
    }

    // 4) Plain town page while the travel-strategy cap allows.
    if (plainCount < cap) {
      pages.push({
        url,
        pageType: 'town_page',
        title: `${primaryCategory} in ${label}`,
        associatedCity: c.city,
        associatedService: null,
        links: [SERVICE_AREAS_URL, homeUrl, ...mainUrls],
      });
      plainCount++;
      townPageUrls.push(url);
      cities.push({ city: c.city, state: c.state, slug, treatment: 'plain_page', hasPage: true, pageUrl: url, distanceFromPrimaryMarket: dist, reason: `Within the ${travelStrategy} travel strategy (${cap} town pages).` });
      continue;
    }

    // 5) Over the cap → text only.
    cities.push({ city: c.city, state: c.state, slug, treatment: 'text_mention_only', hasPage: false, pageUrl: null, distanceFromPrimaryMarket: dist, reason: cap === 0 ? 'Local travel strategy builds no town pages.' : `Over the ${travelStrategy} cap of ${cap} town pages.` });
    doNotBuild.push({ what: url, reason: cap === 0 ? 'Local travel strategy — no town pages.' : `Over the ${travelStrategy} cap (${cap}). Mark it "Dedicated page" to force one.` });
  }

  if (travelStrategy === 'local') {
    doNotBuild.push({ what: 'Town pages', reason: 'Local travel strategy — every town is text on /service-areas/ unless marked "Dedicated page" or promoted by its own GBP.' });
  }

  // Town pages link sideways (lightly) to the other towns that have pages.
  for (const p of pages) {
    if (p.pageType === 'town_page') {
      p.links.push(...townPageUrls.filter((u) => u !== p.url));
    }
  }

  // ── CLICK 1: /service-areas/ hub (towns without a GBP) ────────────────────
  pages.push({
    url: SERVICE_AREAS_URL,
    pageType: 'service_areas',
    title: 'Service Areas',
    associatedCity: null,
    associatedService: null,
    links: [homeUrl, ...townPageUrls, ...(locationPageUrls.length ? [LOCATIONS_URL] : [])],
  });

  // ── CLICK 1: /locations/ hub (pages with their own GBP) — only once any exist ──
  if (locationPageUrls.length > 0) {
    pages.push({
      url: LOCATIONS_URL,
      pageType: 'locations_index',
      title: 'Locations',
      associatedCity: null,
      associatedService: null,
      links: [homeUrl, ...locationPageUrls],
    });
    // Home links DIRECTLY to every location page (click depth is about links).
    const home = pages.find((p) => p.pageType === 'homepage');
    if (home) home.links.push(LOCATIONS_URL, ...locationPageUrls);
  }

  // ── Primary Market neighborhoods hang off home ───────────────────────────
  (input.neighborhoods || []).forEach((n, i) => {
    pages.push({
      url: neighborhoodUrls[i],
      pageType: 'neighborhood',
      title: `${primaryCategory} in ${n}, ${primaryMarket.city}`,
      associatedCity: primaryMarket.city,
      associatedService: null,
      links: [homeUrl, ...neighborhoodUrls.filter((u) => u !== neighborhoodUrls[i])],
    });
  });

  // ── Utility ──────────────────────────────────────────────────────────────
  for (const u of utilityUrls) {
    pages.push({ url: u, pageType: 'utility', title: u.replace(/\//g, '') || 'Home', associatedCity: null, associatedService: null, links: [homeUrl] });
  }

  return {
    pages,
    cities,
    gbpWebsiteLinkRecommendation: homeUrl,
    gbpWebsiteLinks,
    doNotBuild,
  };
}
