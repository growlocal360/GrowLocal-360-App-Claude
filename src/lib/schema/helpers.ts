import type { SchemaBusinessInput, SchemaLocationInput } from './types';

interface SiteInput {
  name: string;
  slug: string;
  domain: string | null;
  custom_domain: string | null;
  settings: {
    phone?: string;
    email?: string;
    logo_url?: string;
    google_average_rating?: number;
    google_total_reviews?: number;
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
    customDomain: site.custom_domain,
    phone: site.settings?.phone || location?.phone || null,
    email: site.settings?.email || null,
    logoUrl: site.settings?.logo_url || null,
    averageRating: site.settings?.google_average_rating ?? null,
    totalReviews: site.settings?.google_total_reviews ?? null,
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
