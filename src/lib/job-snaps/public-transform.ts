/**
 * Transforms a published work item into a fully-computed public output object.
 *
 * Consumed by:
 *   - work detail page routes (generateMetadata)
 *   - any future public API endpoint that needs SEO-ready work item data
 *
 * Does NOT depend on React or Next.js internals — pure TS, importable anywhere.
 */

import type { WorkItemWithRelations } from '@/types/database';
import type { SchemaBreadcrumbItem } from '@/lib/schema';
import { formatPublicAddressWithVisibility, resolveAddressVisibility } from './address';

export type { AddressVisibility } from './address';

// ─── Input context ─────────────────────────────────────────────────────────────

export interface PublicJobSiteContext {
  siteName: string;
  /** Already-resolved domain: custom_domain || `${siteSlug}.${appDomain}` */
  domain: string;
  /** Present for multi-location sites */
  locationSlug?: string;
}

// ─── Output types ──────────────────────────────────────────────────────────────

export interface PublicJobAddress {
  /** Street name only — house number already stripped at publish time */
  streetName: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  /** Human-readable single line for UI display */
  displayLine: string;
  /** schema.org PostalAddress fragment, safe to embed in JSON-LD */
  schemaPostalAddress: {
    '@type': 'PostalAddress';
    streetAddress?: string;
    addressLocality: string;
    addressRegion: string;
    postalCode?: string;
    addressCountry: 'US';
  };
}

export interface PublicJobImage {
  url: string;
  /** Computed: "{service} in {city}, {state} – {title}" or best available fallback */
  alt: string;
  width?: number;
  height?: number;
  role?: 'primary' | 'before' | 'after' | 'process' | 'detail';
  pairGroup?: number;
}

export interface PublicJobOutput {
  // Identity
  slug: string;
  canonicalUrl: string;

  // Content
  title: string;
  description: string | null;
  summary: string | null;

  // SEO metadata
  /** ≤ 120 chars. Uses work_item.meta_title if set, otherwise computed. */
  metaTitle: string;
  /** ≤ 155 chars */
  metaDescription: string;
  /** ≤ 95 chars (Twitter card truncation point) */
  ogTitle: string;
  /** ≤ 200 chars */
  ogDescription: string;

  // Address (privacy-safe — no house number)
  address: PublicJobAddress;

  // Images with computed alts
  featuredImage: PublicJobImage | null;
  images: PublicJobImage[];

  // Navigation
  breadcrumbs: SchemaBreadcrumbItem[];

  // Related references
  service: { id: string; name: string; slug: string } | null;
  city: string | null;
  state: string | null;
  performedAt: string | null;
}

// ─── Image alt builder ─────────────────────────────────────────────────────────

/**
 * Builds an SEO-friendly alt text following the format:
 *   "{service} in {city}, {state} – {title}"
 *
 * Falls back gracefully when fields are missing.
 * Uses the stored alt if non-empty (set during media upload/publish).
 */
export function buildWorkItemImageAlt(
  item: Pick<WorkItemWithRelations, 'title' | 'address_city' | 'address_state' | 'service'>,
  storedAlt: string | undefined,
): string {
  if (storedAlt && storedAlt.trim()) return storedAlt;

  const servicePart = item.service?.name || null;
  const locationPart =
    item.address_city && item.address_state
      ? `${item.address_city}, ${item.address_state}`
      : null;
  const titlePart = item.title;

  if (servicePart && locationPart) {
    return `${servicePart} in ${locationPart} – ${titlePart}`;
  }
  if (locationPart) {
    return `${titlePart} in ${locationPart}`;
  }
  return titlePart;
}

// ─── Main transformer ──────────────────────────────────────────────────────────

function trimTo(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1).trimEnd() + '…';
}

export function toPublicJobOutput(
  item: WorkItemWithRelations,
  ctx: PublicJobSiteContext,
): PublicJobOutput {
  const { siteName, domain, locationSlug } = ctx;

  const city = item.address_city ?? null;
  const state = item.address_state ?? null;
  const locationTag = city && state ? `${city}, ${state}` : city ?? null;
  const serviceName = item.service?.name ?? null;

  // ── Canonical URL ──────────────────────────────────────────────────────────
  const locationBase = locationSlug ? `/${locationSlug}` : '';
  const canonicalUrl = `https://${domain}${locationBase}/work/${item.slug}`;

  // ── Meta title ────────────────────────────────────────────────────────────
  const computedTitle = [
    item.brand_name,
    serviceName,
    locationTag ? `in ${locationTag}` : null,
    `| ${siteName}`,
  ].filter(Boolean).join(' ');
  const metaTitle = trimTo(item.meta_title || computedTitle, 120);

  // ── Meta description ──────────────────────────────────────────────────────
  const baseDesc = item.meta_description ||
    (item.description
      ? `${item.title} by ${siteName}${locationTag ? ` in ${locationTag}` : ''}. ${item.description}`
      : `${item.title} by ${siteName}${locationTag ? ` in ${locationTag}` : ''}. View project details and photos.`);
  const metaDescription = trimTo(baseDesc, 155);

  // ── OG fields ─────────────────────────────────────────────────────────────
  const ogTitle = trimTo(item.meta_title || computedTitle, 95);
  const ogDescription = trimTo(baseDesc, 200);

  // ── Address ───────────────────────────────────────────────────────────────
  const visibility = resolveAddressVisibility(null); // default: street-name-only
  const displayLine = formatPublicAddressWithVisibility(
    { streetName: item.address_street_name, city, state, zip: item.address_zip },
    visibility,
  );
  const address: PublicJobAddress = {
    streetName: item.address_street_name,
    city,
    state,
    zip: item.address_zip,
    displayLine,
    schemaPostalAddress: {
      '@type': 'PostalAddress',
      ...(item.address_street_name ? { streetAddress: item.address_street_name } : {}),
      addressLocality: city ?? '',
      addressRegion: state ?? '',
      ...(item.address_zip ? { postalCode: item.address_zip } : {}),
      addressCountry: 'US',
    },
  };

  // ── Images with computed alts ──────────────────────────────────────────────
  const images: PublicJobImage[] = (item.images ?? []).map((img) => ({
    url: img.url,
    alt: buildWorkItemImageAlt(item, img.alt),
    width: img.width,
    height: img.height,
    role: img.role,
    pairGroup: img.pairGroup,
  }));
  const featuredImage = images[0] ?? null;

  // ── Breadcrumbs ────────────────────────────────────────────────────────────
  const h1 = item.h1 ||
    [item.brand_name, serviceName, locationTag ? `in ${locationTag}` : null]
      .filter(Boolean).join(' ') ||
    item.title;
  const breadcrumbs: SchemaBreadcrumbItem[] = [
    { name: 'Home', url: `https://${domain}${locationBase}/` },
    { name: 'Our Work', url: `https://${domain}${locationBase}/work` },
    { name: h1, url: canonicalUrl },
  ];

  return {
    slug: item.slug,
    canonicalUrl,
    title: item.title,
    description: item.description,
    summary: item.summary,
    metaTitle,
    metaDescription,
    ogTitle,
    ogDescription,
    address,
    featuredImage,
    images,
    breadcrumbs,
    service: item.service ?? null,
    city,
    state,
    performedAt: item.performed_at,
  };
}
