/**
 * Public render model (DTO) types and mapper functions.
 *
 * These strip full DB objects down to only the fields template components
 * actually use, reducing the serialized payload in public site HTML.
 *
 * Field names use snake_case to match existing template access patterns
 * (e.g., site.settings?.brand_color) and avoid refactoring rendering logic.
 */

import type {
  WebsiteType,
  Profile,
  SiteWithRelations,
  Location,
  Service,
  ServiceAreaDB,
  Neighborhood,
  SitePage,
  GoogleReview,
  SiteBrand,
  SiteCategory,
  GBPCategory,
  ServiceProblem,
  ServiceDetailedSection,
  ServiceFAQ,
  NeighborhoodLocalFeatures,
  BrandValueProp,
  WorkItemWithRelations,
  WorkItemImage,
  AboutPageSections,
} from '@/types/database';
import type { PublicSiteData } from './get-site';
import type { PublicTeamSource } from './get-team';

// ---------------------------------------------------------------------------
// Public render types
// ---------------------------------------------------------------------------

/** Only the ~8 settings fields templates actually use (vs ~20+ in SiteSettings) */
export interface PublicRenderSettings {
  brand_color: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  core_industry: string | null;
  cta_text: string | null;
  google_average_rating: number | null;
  google_total_reviews: number | null;
}

export interface PublicRenderSite {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  custom_domain: string | null;
  website_type: WebsiteType;
  settings: PublicRenderSettings;
}

export interface PublicRenderLocation {
  id: string;
  slug: string;
  city: string;
  state: string;
  address_line1: string;
  address_line2: string | null;
  zip_code: string;
  country: string;
  phone: string | null;
  gbp_place_id: string | null;
  latitude: number | null;
  longitude: number | null;
}

// --- Service ---

export interface PublicRenderServiceListing {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  site_category_id: string | null;
}

export interface PublicRenderServiceDetail extends PublicRenderServiceListing {
  h1: string | null;
  body_copy: string | null;
  intro_copy: string | null;
  problems: ServiceProblem[] | null;
  detailed_sections: ServiceDetailedSection[] | null;
  faqs: ServiceFAQ[] | null;
}

// --- Service Area ---

export interface PublicRenderAreaListing {
  id: string;
  name: string;
  slug: string;
  state: string | null;
}

export interface PublicRenderAreaDetail extends PublicRenderAreaListing {
  h1: string | null;
  body_copy: string | null;
}

// --- Neighborhood ---

export interface PublicRenderNeighborhoodListing {
  id: string;
  name: string;
  slug: string;
}

export interface PublicRenderNeighborhoodDetail extends PublicRenderNeighborhoodListing {
  h1: string | null;
  body_copy: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  local_features: NeighborhoodLocalFeatures | null;
  faqs: { question: string; answer: string }[] | null;
}

// --- Brand ---

export interface PublicRenderBrandListing {
  id: string;
  name: string;
  slug: string;
  hero_description: string | null;
}

export interface PublicRenderBrandDetail extends PublicRenderBrandListing {
  h1: string | null;
  hero_description: string | null;
  body_copy: string | null;
  value_props: BrandValueProp[] | null;
  faqs: ServiceFAQ[] | null;
  cta_heading: string | null;
  cta_description: string | null;
  logo_url: string | null;
}

// --- Review ---

export interface PublicRenderReview {
  author_name: string | null;
  comment: string | null;
  rating: number;
  author_photo_url: string | null;
  review_date: string | null;
  review_reply: string | null;
  reply_date: string | null;
}

// --- Page Content ---

export interface PublicRenderPageContent {
  h1: string | null;
  h2: string | null;
  hero_description: string | null;
  body_copy: string | null;
  body_copy_2: string | null;
  faqs: ServiceFAQ[] | null;
  sections: AboutPageSections | null;
}

// --- Category (for nav and page rendering) ---

export interface PublicRenderCategory {
  id: string;
  is_primary: boolean;
  gbp_category: {
    display_name: string;
    name: string;
  };
}

// --- Work Item ---

export interface PublicRenderWorkItem {
  id: string;
  slug: string;
  title: string;
  h1: string | null;
  summary: string | null;
  description: string | null;
  performed_at: string | null;
  images: WorkItemImage[];
  address_city: string | null;
  address_state: string | null;
  address_street_name: string | null;
  address_zip: string | null;
  brand_name: string | null;
  service?: { id: string; name: string; slug: string } | null;
  location?: { id: string; city: string; state: string; slug: string } | null;
}

// --- Aggregated render data for home page ---

export interface PublicRenderData {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  locations: PublicRenderLocation[];
  serviceAreas: PublicRenderAreaListing[];
  neighborhoods: PublicRenderNeighborhoodListing[];
  brands: PublicRenderBrandListing[];
  reviews: PublicRenderReview[];
  sitePages: PublicRenderPageContent[];
}

// --- Team member ---

export interface PublicRenderTeamMember {
  id: string;
  full_name: string;
  title: string | null;
  bio: string | null;
  avatar_url: string | null;
  role: string;
}

// ---------------------------------------------------------------------------
// URL sanitization
// ---------------------------------------------------------------------------

/**
 * Convert a raw Supabase storage URL to a clean /public/ proxy path.
 * - Already-clean path (/public/...) → pass through
 * - Supabase storage URL → /public/assets/{assetType}/{filename}
 * - External URL (http) → pass through unchanged
 * - null/undefined → null
 */
function sanitizeAssetUrl(
  url: string | null | undefined,
  assetType: 'brand' | 'site'
): string | null {
  if (!url) return null;
  if (url.startsWith('/public/')) return url;
  // Raw Supabase storage URL — extract filename
  const supabaseMatch = url.match(
    /\/storage\/v1\/object\/public\/[^/]+\/(?:sites\/[^/]+\/)?(.+)$/
  );
  if (supabaseMatch) {
    const filename = supabaseMatch[1];
    return `/public/assets/${assetType}/${filename}`;
  }
  // External URL (Google photos, CDN, etc.) — pass through
  if (url.startsWith('http')) return url;
  return url;
}

/**
 * Convert an avatar Supabase URL to a clean /public/ proxy path.
 * Avatars are stored at avatars/{profileId}/{filename} in site-assets bucket.
 */
function sanitizeAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/public/')) return url;
  // Raw Supabase storage URL — extract avatars/{profileId}/{filename}
  const match = url.match(
    /\/storage\/v1\/object\/public\/[^/]+\/(avatars\/.+)$/
  );
  if (match) {
    return `/public/${match[1]}`;
  }
  if (url.startsWith('http')) return url;
  return url;
}

// ---------------------------------------------------------------------------
// Mapper functions
// ---------------------------------------------------------------------------

export function toPublicSite(site: SiteWithRelations): PublicRenderSite {
  const s = site.settings || {};
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    domain: site.domain,
    custom_domain: site.custom_domain,
    website_type: site.website_type,
    settings: {
      brand_color: s.brand_color || '#00ef99',
      logo_url: sanitizeAssetUrl(s.logo_url, 'brand'),
      phone: s.phone || null,
      email: s.email || null,
      core_industry: s.core_industry || null,
      cta_text: s.cta_text || null,
      google_average_rating: s.google_average_rating ?? null,
      google_total_reviews: s.google_total_reviews ?? null,
    },
  };
}

export function toPublicLocation(loc: Location): PublicRenderLocation {
  return {
    id: loc.id,
    slug: loc.slug,
    city: loc.city,
    state: loc.state,
    address_line1: loc.address_line1,
    address_line2: loc.address_line2,
    zip_code: loc.zip_code,
    country: loc.country,
    phone: loc.phone,
    gbp_place_id: loc.gbp_place_id,
    latitude: loc.latitude,
    longitude: loc.longitude,
  };
}

export function toPublicServiceListing(svc: Service): PublicRenderServiceListing {
  return {
    id: svc.id,
    name: svc.name,
    slug: svc.slug,
    description: svc.description,
    site_category_id: svc.site_category_id,
  };
}

export function toPublicServiceDetail(svc: Service): PublicRenderServiceDetail {
  return {
    ...toPublicServiceListing(svc),
    h1: svc.h1,
    body_copy: svc.body_copy,
    intro_copy: svc.intro_copy,
    problems: svc.problems,
    detailed_sections: svc.detailed_sections,
    faqs: svc.faqs,
  };
}

export function toPublicAreaListing(area: ServiceAreaDB): PublicRenderAreaListing {
  return {
    id: area.id,
    name: area.name,
    slug: area.slug,
    state: area.state,
  };
}

export function toPublicAreaDetail(area: ServiceAreaDB): PublicRenderAreaDetail {
  return {
    ...toPublicAreaListing(area),
    h1: area.h1,
    body_copy: area.body_copy,
  };
}

export function toPublicNeighborhoodListing(n: Neighborhood): PublicRenderNeighborhoodListing {
  return {
    id: n.id,
    name: n.name,
    slug: n.slug,
  };
}

export function toPublicNeighborhoodDetail(n: Neighborhood): PublicRenderNeighborhoodDetail {
  return {
    ...toPublicNeighborhoodListing(n),
    h1: n.h1,
    body_copy: n.body_copy,
    description: n.description,
    latitude: n.latitude,
    longitude: n.longitude,
    local_features: n.local_features,
    faqs: n.faqs,
  };
}

export function toPublicBrandListing(brand: SiteBrand): PublicRenderBrandListing {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    hero_description: brand.hero_description,
  };
}

export function toPublicBrandDetail(brand: SiteBrand): PublicRenderBrandDetail {
  return {
    ...toPublicBrandListing(brand),
    h1: brand.h1,
    hero_description: brand.hero_description,
    body_copy: brand.body_copy,
    value_props: brand.value_props,
    faqs: brand.faqs,
    cta_heading: brand.cta_heading,
    cta_description: brand.cta_description,
    logo_url: sanitizeAssetUrl(brand.logo_url, 'brand'),
  };
}

export function toPublicReview(review: GoogleReview): PublicRenderReview {
  return {
    author_name: review.author_name,
    comment: review.comment,
    rating: review.rating,
    author_photo_url: review.author_photo_url,
    review_date: review.review_date,
    review_reply: review.review_reply,
    reply_date: review.reply_date,
  };
}

export function toPublicPageContent(page: SitePage): PublicRenderPageContent {
  return {
    h1: page.h1,
    h2: page.h2,
    hero_description: page.hero_description,
    body_copy: page.body_copy,
    body_copy_2: page.body_copy_2,
    faqs: page.faqs,
    sections: page.sections ?? null,
  };
}

export function toPublicCategory(
  cat: SiteCategory & { gbp_category: GBPCategory }
): PublicRenderCategory {
  return {
    id: cat.id,
    is_primary: cat.is_primary,
    gbp_category: {
      display_name: cat.gbp_category.display_name,
      name: cat.gbp_category.name,
    },
  };
}

export function toPublicWorkItem(item: WorkItemWithRelations): PublicRenderWorkItem {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    h1: item.h1,
    summary: item.summary,
    description: item.description,
    performed_at: item.performed_at,
    images: item.images,
    address_city: item.address_city,
    address_state: item.address_state,
    address_street_name: item.address_street_name,
    address_zip: item.address_zip,
    brand_name: item.brand_name,
    service: item.service || null,
    location: item.location || null,
  };
}

export function toPublicTeamMember(source: PublicTeamSource): PublicRenderTeamMember {
  if ('_isStaff' in source) {
    // StaffMember (no auth)
    return {
      id: source.id,
      full_name: source.full_name,
      title: source.title,
      bio: source.bio,
      avatar_url: sanitizeAvatarUrl(source.avatar_url),
      role: 'staff',
    };
  }
  // Profile (auth user)
  return {
    id: source.id,
    full_name: source.full_name || 'Team Member',
    title: source.title,
    bio: source.bio,
    avatar_url: sanitizeAvatarUrl(source.avatar_url),
    role: source.role,
  };
}

/** Transform full PublicSiteData into the stripped render model for home page */
export function toPublicRenderData(data: PublicSiteData): PublicRenderData {
  const homePage = data.sitePages?.find(p => p.page_type === 'home');

  return {
    site: toPublicSite(data.site),
    primaryLocation: data.primaryLocation ? toPublicLocation(data.primaryLocation) : null,
    locations: data.locations.map(toPublicLocation),
    serviceAreas: data.serviceAreas.map(toPublicAreaListing),
    neighborhoods: data.neighborhoods.map(toPublicNeighborhoodListing),
    brands: data.brands.map(toPublicBrandListing),
    reviews: data.googleReviews.map(toPublicReview),
    sitePages: homePage ? [toPublicPageContent(homePage)] : [],
  };
}
