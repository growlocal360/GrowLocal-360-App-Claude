/**
 * Centralized path builder — v5 Primary Market URL structure.
 * See docs/architecture/growlocal360_master_prompt_v5.md.
 *
 * v5 flattens the old "/locations/{loc}/" silo: GBP-anchored cities become
 * city-first hubs at ROOT — "/{city}/". The `locationSlug` argument therefore
 * now means "this link is scoped to a city hub" and is prefixed at root
 * (NOT under /locations/). Single-market sites pass `locationSlug` = undefined
 * and everything lives at "/".
 *
 * Key v5 changes vs v4:
 *  - `/areas/` (folder) → `/service-areas/` (single page); area detail pages are
 *    GONE — every city is either a city hub, a Pattern-1 page, or a text mention.
 *  - `/locations/{loc}/` prefix → `/{loc}/` (flat city hub at root).
 *  - New: `cityHub()` and `serviceCityPage()` (Pattern 1).
 */

function base(locationSlug?: string): string {
  return locationSlug ? `/${locationSlug}` : '';
}

/** GBP-anchored city hub — "/" for the primary single-market site, "/{city}" for a city hub. */
export function locationHome(locationSlug?: string): string {
  return locationSlug ? `/${locationSlug}` : '/';
}

/** City-first hub for a GBP-anchored city: "/{city}/". */
export function cityHub(citySlug: string): string {
  return `/${citySlug}`;
}

/** Pattern 1 — non-anchored city page for a service: "/{service}/{city}/". */
export function serviceCityPage(serviceSlug: string, citySlug: string, locationSlug?: string): string {
  return `${base(locationSlug)}/${serviceSlug}/${citySlug}`;
}

/** /services or /{city}/services */
export function servicesIndex(locationSlug?: string): string {
  return `${base(locationSlug)}/services`;
}

/** v5: the single Service Areas page. "/service-areas/" — never a folder. */
export function serviceAreasIndex(locationSlug?: string): string {
  return `${base(locationSlug)}/service-areas`;
}

/**
 * @deprecated v5 has no per-area detail pages. Kept as an alias so legacy
 * callers compile; it now points at the single /service-areas/ page.
 */
export function areasIndex(locationSlug?: string): string {
  return serviceAreasIndex(locationSlug);
}

/**
 * @deprecated v5 removed area detail pages. A served city is either a city hub
 * (/{city}/), a Pattern-1 page (/{service}/{city}/), or a text mention on
 * /service-areas/. This now resolves to the /service-areas/ page so old links
 * don't 404; callers should migrate to cityHub() / serviceCityPage().
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
