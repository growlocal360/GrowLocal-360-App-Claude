/**
 * Centralized path builder for GBP Location Silos.
 *
 * Every public link on the site MUST use these functions so that:
 *   • Single-location sites keep all links relative to "/"
 *   • Multi-location sites scope links under "/{locationSlug}"
 *
 * Pass `locationSlug` = undefined for single_location / microsite.
 * Pass `locationSlug` = location.slug for multi_location.
 */

function base(locationSlug?: string): string {
  return locationSlug ? `/${locationSlug}` : '';
}

/** GBP location anchor — "/" for single, "/{locationSlug}" for multi */
export function locationHome(locationSlug?: string): string {
  return locationSlug ? `/${locationSlug}` : '/';
}

/** /services or /{locationSlug}/services */
export function servicesIndex(locationSlug?: string): string {
  return `${base(locationSlug)}/services`;
}

/** /areas or /{locationSlug}/areas */
export function areasIndex(locationSlug?: string): string {
  return `${base(locationSlug)}/areas`;
}

/** /areas/{areaSlug} or /{locationSlug}/areas/{areaSlug} */
export function areaPage(areaSlug: string, locationSlug?: string): string {
  return `${base(locationSlug)}/areas/${areaSlug}`;
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

/** /jobs or /{locationSlug}/jobs */
export function jobsPage(locationSlug?: string): string {
  return `${base(locationSlug)}/jobs`;
}

/** /work or /{locationSlug}/work */
export function workHub(locationSlug?: string): string {
  return `${base(locationSlug)}/work`;
}

/** /work/{slug} or /{locationSlug}/work/{slug} */
export function workDetail(workSlug: string, locationSlug?: string): string {
  return `${base(locationSlug)}/work/${workSlug}`;
}
