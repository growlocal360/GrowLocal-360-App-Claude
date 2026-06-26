/**
 * Site Plan — v5 Primary Market model page-inventory planner.
 * ----------------------------------------------------------------------------
 * Pure, deterministic function that turns onboarding inputs into the page
 * inventory, internal-linking map, service-area treatment table, and the GBP
 * website-link recommendation, applying the v5 URL structure rules.
 *
 * Canonical spec: docs/architecture/growlocal360_master_prompt_v5.md
 *
 * This module makes NO database / network calls — it's the planning brain. The
 * generation pipeline (and the test harness) call planSite() and act on the
 * result. Keeping it pure makes the rules testable in isolation.
 */

import { normalizeCategorySlug } from '@/lib/utils/slugify';
import type { TravelStrategy } from '@/types/wizard';

export type BusinessType = 'physical' | 'sab' | 'hybrid';

export type PageType =
  | 'homepage'
  | 'primary_market_hub'
  | 'primary_market_service'
  | 'brand_service_hub'
  | 'sub_service'
  | 'pattern_1_city'
  | 'city_hub'
  | 'city_hub_service'
  | 'service_areas'
  | 'utility';

export type CityTreatment =
  | 'primary_market'
  | 'proximity_covered'
  | 'has_pattern_1_page'
  | 'has_city_hub'
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
  treatment: CityTreatment;
  hasPage: boolean;
  pageUrl: string | null;
  distanceFromPrimaryMarket: number | null;
}

export interface PlanInputs {
  businessType: BusinessType;
  travelStrategy: TravelStrategy;
  primaryMarket: { city: string; state: string };
  /** GBP category service names (primary first). The first is the "core" service. */
  gbpCategories: string[];
  /** Sub-services keyed by their parent GBP category service name. */
  subServicesByService?: Record<string, string[]>;
  /** Cities served. anchored=true means the city has its own GBP listing. */
  serviceAreaCities: Array<{
    city: string;
    state: string;
    anchored?: boolean;
    distanceMiles?: number | null;
  }>;
  /** Explicit top revenue services (names). If omitted, first 2-3 GBP categories are used. */
  topServices?: string[];
}

export interface SitePlan {
  pages: PlannedPage[];
  cities: CityPlan[];
  /** GBP website-link recommendation target (the Primary Market hub path). */
  gbpWebsiteLinkRecommendation: string;
  /** Pages intentionally NOT built, with reasons (for the DO_NOT_BUILD output). */
  doNotBuild: Array<{ what: string; reason: string }>;
}

const PROXIMITY_MILES = 10;
const PATTERN1_CAP: Record<TravelStrategy, number> = {
  local: 0,        // Local builds NO Pattern 1 pages
  regional: 9,
  metro: 12,
  'multi-market': 12,
};

function citySlug(city: string): string {
  return city.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function svcSlug(service: string): string {
  return normalizeCategorySlug(service);
}
function titleCity(city: string, state: string): string {
  return state ? `${city}, ${state}` : city;
}

/**
 * Build the full site plan from onboarding inputs, applying the v5 rules.
 */
export function planSite(input: PlanInputs): SitePlan {
  const { travelStrategy, primaryMarket, gbpCategories } = input;
  const pmSlug = citySlug(primaryMarket.city);
  const services = gbpCategories.filter(Boolean);
  const coreService = services[0];
  const topServices = (input.topServices && input.topServices.length > 0
    ? input.topServices
    : services.slice(0, 3)
  ).map(svcSlug);

  const pages: PlannedPage[] = [];
  const doNotBuild: SitePlan['doNotBuild'] = [];

  // ── URLs we know up-front (for linking) ──────────────────────────────────
  const homeUrl = '/';
  const pmHubUrl = `/${pmSlug}/`;
  const serviceAreasUrl = '/service-areas/';
  const brandHubUrls = services.map((s) => `/${svcSlug(s)}/`);
  const pmServiceUrls = services.map((s) => `/${pmSlug}/${svcSlug(s)}/`);

  // ── ALWAYS: homepage (brand-level) ───────────────────────────────────────
  pages.push({
    url: homeUrl,
    pageType: 'homepage',
    title: 'Home',
    associatedCity: null,
    associatedService: null,
    links: [...brandHubUrls, pmHubUrl, serviceAreasUrl, '/about/', '/contact/', '/reviews/', '/work/'],
  });

  // ── ALWAYS: Primary Market hub + its per-service pages ───────────────────
  pages.push({
    url: pmHubUrl,
    pageType: 'primary_market_hub',
    title: `${primaryMarket.city} ${coreService || 'Services'}`,
    associatedCity: primaryMarket.city,
    associatedService: null,
    links: [homeUrl, ...pmServiceUrls, ...brandHubUrls, serviceAreasUrl],
  });
  services.forEach((s) => {
    pages.push({
      url: `/${pmSlug}/${svcSlug(s)}/`,
      pageType: 'primary_market_service',
      title: `${s} in ${primaryMarket.city}`,
      associatedCity: primaryMarket.city,
      associatedService: s,
      links: [pmHubUrl, `/${svcSlug(s)}/`, serviceAreasUrl],
    });
  });

  // ── ALWAYS: brand service hubs + their sub-services ──────────────────────
  services.forEach((s) => {
    const hub = `/${svcSlug(s)}/`;
    const subs = input.subServicesByService?.[s] ?? [];
    const subUrls = subs.map((sub) => `${hub}${svcSlug(sub)}/`);
    pages.push({
      url: hub,
      pageType: 'brand_service_hub',
      title: s,
      associatedCity: null,
      associatedService: s,
      // brand hub links DOWN to sub-services + PM service page; SIDEWAYS to other hubs + service-areas
      links: [...subUrls, `/${pmSlug}/${svcSlug(s)}/`, ...brandHubUrls.filter((u) => u !== hub), serviceAreasUrl],
    });
    subs.forEach((sub) => {
      pages.push({
        url: `${hub}${svcSlug(sub)}/`,
        pageType: 'sub_service',
        title: sub,
        associatedCity: null,
        associatedService: s,
        // sub-services link UP to parent + SIDEWAYS to siblings; NEVER to city pages
        links: [hub, ...subUrls.filter((u) => u !== `${hub}${svcSlug(sub)}/`)],
      });
    });
  });

  // ── City treatment + city/Pattern-1 pages ────────────────────────────────
  const cities: CityPlan[] = [];
  const pattern1Cap = PATTERN1_CAP[travelStrategy];
  let pattern1Count = 0;
  const builtCityPageUrls: string[] = [];

  // Primary market itself is its own treatment (hub already built above).
  cities.push({
    city: primaryMarket.city,
    state: primaryMarket.state,
    treatment: 'primary_market',
    hasPage: true,
    pageUrl: pmHubUrl,
    distanceFromPrimaryMarket: 0,
  });

  for (const c of input.serviceAreaCities) {
    if (c.city.toLowerCase() === primaryMarket.city.toLowerCase()) continue; // already handled

    const dist = c.distanceMiles ?? null;

    // 1) GBP-anchored city → city-first hub + per-service pages
    if (c.anchored) {
      const cSlug = citySlug(c.city);
      const hubUrl = `/${cSlug}/`;
      pages.push({
        url: hubUrl,
        pageType: 'city_hub',
        title: `${coreService || 'Services'} in ${c.city}`,
        associatedCity: c.city,
        associatedService: null,
        links: [homeUrl, serviceAreasUrl, ...services.map((s) => `/${cSlug}/${svcSlug(s)}/`)],
      });
      services.forEach((s) => {
        pages.push({
          url: `/${cSlug}/${svcSlug(s)}/`,
          pageType: 'city_hub_service',
          title: `${s} in ${c.city}`,
          associatedCity: c.city,
          associatedService: s,
          links: [hubUrl, `/${svcSlug(s)}/`, serviceAreasUrl],
        });
      });
      builtCityPageUrls.push(hubUrl);
      cities.push({ city: c.city, state: c.state, treatment: 'has_city_hub', hasPage: true, pageUrl: hubUrl, distanceFromPrimaryMarket: dist });
      continue;
    }

    // 2) Within proximity of Primary Market → covered, text-only on service-areas
    if (dist !== null && dist <= PROXIMITY_MILES) {
      cities.push({ city: c.city, state: c.state, treatment: 'proximity_covered', hasPage: false, pageUrl: null, distanceFromPrimaryMarket: dist });
      continue;
    }

    // 3) Pattern 1 for the top 2-3 services (respecting the per-strategy cap)
    if (pattern1Cap > 0) {
      const built: string[] = [];
      for (const s of services) {
        if (!topServices.includes(svcSlug(s))) continue; // top services only
        if (pattern1Count >= pattern1Cap) break;
        // No duplicate-intent: PM service page already covers the primary market.
        const url = `/${svcSlug(s)}/${citySlug(c.city)}/`;
        pages.push({
          url,
          pageType: 'pattern_1_city',
          title: `${s} in ${titleCity(c.city, c.state)}`,
          associatedCity: c.city,
          associatedService: s,
          // Pattern 1 links UP to brand hub + service-areas; SIDEWAYS lightly to siblings
          links: [`/${svcSlug(s)}/`, serviceAreasUrl],
        });
        built.push(url);
        pattern1Count++;
      }
      if (built.length > 0) {
        builtCityPageUrls.push(...built);
        cities.push({ city: c.city, state: c.state, treatment: 'has_pattern_1_page', hasPage: true, pageUrl: built[0], distanceFromPrimaryMarket: dist });
        continue;
      }
    }

    // 4) Everything else → text mention only on /service-areas/
    cities.push({ city: c.city, state: c.state, treatment: 'text_mention_only', hasPage: false, pageUrl: null, distanceFromPrimaryMarket: dist });
  }

  if (travelStrategy === 'local') {
    doNotBuild.push({ what: 'Pattern 1 city pages', reason: 'Local travel strategy — primary market + proximity coverage only.' });
  }

  // ── ALWAYS: /service-areas/ (single page; links built city pages, text for rest) ──
  pages.push({
    url: serviceAreasUrl,
    pageType: 'service_areas',
    title: 'Service Areas',
    associatedCity: null,
    associatedService: null,
    links: [pmHubUrl, ...builtCityPageUrls, ...brandHubUrls, homeUrl],
  });

  // ── ALWAYS: utility pages ────────────────────────────────────────────────
  for (const u of ['/about/', '/contact/', '/reviews/', '/work/']) {
    pages.push({ url: u, pageType: 'utility', title: u.replace(/\//g, '') || 'Home', associatedCity: null, associatedService: null, links: [homeUrl] });
  }

  return {
    pages,
    cities,
    gbpWebsiteLinkRecommendation: pmHubUrl,
    doNotBuild,
  };
}
