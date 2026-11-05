/**
 * The MAIN SERVICE LIST (v6).
 * ----------------------------------------------------------------------------
 * One ordered list, rendered identically on the home page, every town page,
 * the footer and the sitemap:
 *   1. every service of the PRIMARY GBP category   → /{service}/
 *   2. every SECONDARY GBP category as a hub        → /{category}/
 * Never filtered by category. On a LOCATION page (a town with its own GBP) the
 * same list links into the location's silo (/locations/{city}/{slug}/) instead
 * of the root pages.
 *
 * Pure — safe to import from client components. The server loader lives in
 * ./main-service-list.server.ts.
 */

import { normalizeCategorySlug } from '@/lib/utils/slugify';
import * as paths from '@/lib/routing/paths';

export interface MainServiceEntry {
  kind: 'service' | 'category';
  id: string;
  name: string;
  /** Public slug exactly as routed. */
  slug: string;
  description: string | null;
  /** The root page: /{service}/ or /{category}/ (no trailing slash, matches paths.*). */
  href: string;
}

interface CategoryLike {
  id: string;
  is_primary: boolean;
  gbp_category: { display_name: string } | null | undefined;
}
interface ServiceLike {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  site_category_id: string | null;
}

/** Build the list from already-loaded categories (sorted) and active services (sorted). */
export function buildMainServiceList(categories: CategoryLike[], services: ServiceLike[], locationSlug?: string): MainServiceEntry[] {
  const primary = categories.find((c) => c.is_primary) || categories[0];
  const primarySlug = primary?.gbp_category?.display_name ? normalizeCategorySlug(primary.gbp_category.display_name) : undefined;
  const primaryServices = primary
    ? services.filter((s) => s.site_category_id === primary.id || !s.site_category_id)
    : services;
  const out: MainServiceEntry[] = primaryServices.map((s) => ({
    kind: 'service',
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description ?? null,
    href: paths.servicePage(s.slug, primarySlug, true, locationSlug),
  }));
  for (const c of categories) {
    if (c.is_primary || c === primary || !c.gbp_category?.display_name) continue;
    const slug = normalizeCategorySlug(c.gbp_category.display_name);
    out.push({
      kind: 'category',
      id: c.id,
      name: c.gbp_category.display_name,
      slug,
      description: null,
      href: paths.categoryPage(slug, false, locationSlug),
    });
  }
  return out;
}

/** Where a main-service card points on a town page: the root page, or the location's silo when promoted. */
export function townServiceHref(entry: MainServiceEntry, townSlug: string, promoted: boolean): string {
  return promoted ? paths.locationServicePage(townSlug, entry.slug) : entry.href;
}
