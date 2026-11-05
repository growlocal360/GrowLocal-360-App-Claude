/**
 * Centralized path builder — v6 Town Page URL structure.
 * See docs/architecture/growlocal360_master_prompt_v6.md.
 *
 *   /                                 home = primary category in the Primary Market
 *   /{service}/                       main service pages, flat at root
 *   /{category}/{service}/            secondary-category services under their hub
 *   /service-areas/                   locations hub
 *   /service-areas/{city}/            town page (plain or promoted)
 *   /service-areas/{city}/{service}/  silo page under a PROMOTED town
 *   /neighborhoods/{slug}/            Primary Market neighborhoods
 *
 * `locationSlug` is a legacy multi-location prefix; single-market sites pass
 * undefined and everything lives at "/".
 */

function base(locationSlug?: string): string {
  return locationSlug ? `/${locationSlug}` : '';
}

/** GBP-anchored city hub — "/" for the primary single-market site, "/{city}" for a city hub. */
export function locationHome(locationSlug?: string): string {
  return locationSlug ? `/${locationSlug}` : '/';
}

/** v6 town page: "/service-areas/{city}". */
export function townPage(citySlug: string, locationSlug?: string): string {
  return `${base(locationSlug)}/service-areas/${citySlug}`;
}

/** v6 silo page under a PROMOTED town: "/service-areas/{city}/{service}". */
export function townServicePage(citySlug: string, serviceSlug: string, locationSlug?: string): string {
  return `${base(locationSlug)}/service-areas/${citySlug}/${serviceSlug}`;
}

/** @deprecated v5 city-first hub. v6 has no /{city}/ at root — resolves to the town page. */
export function cityHub(citySlug: string): string {
  return townPage(citySlug);
}

/** @deprecated v5 Pattern 1. v6 has no /{service}/{city}/ — resolves to the town page. */
export function serviceCityPage(_serviceSlug: string, citySlug: string, locationSlug?: string): string {
  void _serviceSlug;
  return townPage(citySlug, locationSlug);
}

/** /services or /{city}/services */
export function servicesIndex(locationSlug?: string): string {
  return `${base(locationSlug)}/services`;
}

/** The locations hub: "/service-areas/". Town pages are its children. */
export function serviceAreasIndex(locationSlug?: string): string {
  return `${base(locationSlug)}/service-areas`;
}

/** Alias of serviceAreasIndex(). */
export function areasIndex(locationSlug?: string): string {
  return serviceAreasIndex(locationSlug);
}

/**
 * Link target for a served town from generic listings (footer, areas sections)
 * that don't know whether the town earned a page. Points at the hub so no link
 * can 404; surfaces that DO know (nav, /service-areas/, town pages) use the
 * plan's page_url / townPage() instead.
 */
export function areaPage(_areaSlug: string, locationSlug?: string): string {
  void _areaSlug;
  return serviceAreasIndex(locationSlug);
}

/** /neighborhoods or /{locationSlug}/neighborhoods */
export function neighborhoodsIndex(locationSlug?: string): string {
  return `${base(locationSlug)}/neighborhoods`;
}

/** /neighborhoods/{slug} or /{locationSlug}/neighborhoods/{slug} */
export function neighborhoodPage(neighborhoodSlug: string, locationSlug?: string): string {
  return `${base(locationSlug)}/neighborhoods/${neighborhoodSlug}`;
}

/**
 * Category page URL.
 *   Primary category → locationHome (the GBP anchor IS the primary category page)
 *   Secondary category → /{categorySlug}
 */
export function categoryPage(categorySlug: string, isPrimary: boolean, locationSlug?: string): string {
  if (isPrimary) {
    return locationHome(locationSlug);
  }
  return `${base(locationSlug)}/${categorySlug}`;
}

/**
 * Service page URL.
 *   Primary-category service (top-level): /{serviceSlug}
 *   Secondary-category service (nested):  /{categorySlug}/{serviceSlug}
 */
export function servicePage(
  serviceSlug: string,
  categorySlug?: string,
  isPrimaryCategory?: boolean,
  locationSlug?: string,
): string {
  if (isPrimaryCategory || !categorySlug) {
    return `${base(locationSlug)}/${serviceSlug}`;
  }
  return `${base(locationSlug)}/${categorySlug}/${serviceSlug}`;
}

/**
 * Problem / sub-service page nested under a category.
 *   /{categorySlug}/{problemSlug}
 */
export function problemPage(categorySlug: string, problemSlug: string, locationSlug?: string): string {
  return `${base(locationSlug)}/${categorySlug}/${problemSlug}`;
}

/** /about or /{locationSlug}/about */
export function aboutPage(locationSlug?: string): string {
  return `${base(locationSlug)}/about`;
}

/** /contact or /{locationSlug}/contact */
export function contactPage(locationSlug?: string): string {
  return `${base(locationSlug)}/contact`;
}

/** /book or /{locationSlug}/book — the dedicated booking / estimate page */
export function bookPage(locationSlug?: string): string {
  return `${base(locationSlug)}/book`;
}

/** /work or /{locationSlug}/work */
export function workHub(locationSlug?: string): string {
  return `${base(locationSlug)}/work`;
}

/** /work/{slug} or /{locationSlug}/work/{slug} */
export function workDetail(workSlug: string, locationSlug?: string): string {
  return `${base(locationSlug)}/work/${workSlug}`;
}

/** /faq or /{locationSlug}/faq */
export function faqPage(locationSlug?: string): string {
  return `${base(locationSlug)}/faq`;
}

/** /reviews or /{locationSlug}/reviews */
export function reviewsIndex(locationSlug?: string): string {
  return `${base(locationSlug)}/reviews`;
}

/** /brands or /{locationSlug}/brands */
export function brandsIndex(locationSlug?: string): string {
  return `${base(locationSlug)}/brands`;
}

/** /brands/{brandSlug} or /{locationSlug}/brands/{brandSlug} */
export function brandPage(brandSlug: string, locationSlug?: string): string {
  return `${base(locationSlug)}/brands/${brandSlug}`;
}
