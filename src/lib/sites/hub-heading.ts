/**
 * Whether brand-level hub pages (the /services index) should name the primary
 * city. Mirrors v5 rule 11 for the home page: a single-location site's hubs
 * stay brand-level so they don't compete with the Primary Market page, UNLESS
 * the owner designated the home page as the Primary Market page. Multi-location
 * sites are always brand-level.
 */
export function hubCityFor(
  site: { website_type?: string | null; settings?: { homepage_is_primary_market?: boolean | null } | null },
  city: string | null | undefined
): string | null {
  if (!city) return null;
  const single = (site.website_type ?? 'single_location') === 'single_location';
  return single && site.settings?.homepage_is_primary_market === true ? city : null;
}

/** "Englewood, Venice, Sarasota and 5 more communities" from a service-area list. */
export function servedCommunitiesLabel(areas: { name: string }[], max = 3): string | null {
  if (!areas.length) return null;
  const names = areas.slice(0, max).map((a) => a.name);
  const rest = areas.length - names.length;
  // "A, B and C" when that's everyone; "A, B, C and 4 more communities" when it isn't.
  if (rest > 0) return `${names.join(', ')} and ${rest} more ${rest === 1 ? 'community' : 'communities'}`;
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
}
