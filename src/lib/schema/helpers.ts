import type { SchemaBusinessInput, SchemaLocationInput } from './types';
import { profileLinks, type SiteProfiles } from '@/lib/sites/profiles';

interface SiteInput {
  name: string;
  slug: string;
  domain: string | null;
  custom_domain: string | null;
  custom_domain_verified?: boolean | null;
  settings: {
    phone?: string | null;
    email?: string | null;
    logo_url?: string | null;
    google_average_rating?: number | null;
    google_total_reviews?: number | null;
    profiles?: unknown;
  };
}

interface LocationInput {
  address_line1: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
}

/** Convert Site + Location DB types to SchemaBusinessInput */
export function toBusinessInput(
  site: SiteInput,
  location: LocationInput | null
): SchemaBusinessInput {
  return {
    siteName: site.name,
    siteSlug: site.slug,
    domain: site.domain,
    customDomain: site.custom_domain_verified ? site.custom_domain : null,
    phone: site.settings?.phone || location?.phone || null,
    email: site.settings?.email || null,
    logoUrl: site.settings?.logo_url || null,
    averageRating: site.settings?.google_average_rating ?? null,
    totalReviews: site.settings?.google_total_reviews ?? null,
    sameAs: sameAsFrom(site.settings?.profiles),
  };
}

/** Convert Location DB type to SchemaLocationInput */
export function toLocationInput(location: LocationInput): SchemaLocationInput {
  return {
    streetAddress: location.address_line1,
    city: location.city,
    state: location.state,
    zipCode: location.zip_code,
    country: location.country || 'US',
    latitude: location.latitude,
    longitude: location.longitude,
  };
}

/** Accepts the raw settings.profiles map or the already-ordered ProfileLink[] from the public render model. */
function sameAsFrom(profiles: unknown): string[] {
  if (!profiles) return [];
  if (Array.isArray(profiles)) {
    return profiles.map((p) => (p && typeof p === 'object' ? (p as { url?: string }).url : null)).filter((u): u is string => !!u);
  }
  return profileLinks(profiles as SiteProfiles).map((p) => p.url);
}
