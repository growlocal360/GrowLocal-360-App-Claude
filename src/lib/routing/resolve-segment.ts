/**
 * v5 root-segment resolver.
 * ----------------------------------------------------------------------------
 * In the v5 flat URL structure, a single root segment "/{seg1}" is ambiguous —
 * it can be a SERVICE (brand hub), a CATEGORY (secondary), or a CITY (GBP-anchored
 * city hub). Likewise "/{seg1}/{seg2}" can be category/service (nested),
 * city/service ("/{city}/{service}"), or service/city Pattern 1 ("/{service}/{city}").
 *
 * These all share the same Next.js dynamic route files, so resolution happens at
 * request time via ordered DB lookups. This module centralizes that ordering so
 * the two route files (and the sitemap/static-params) agree on precedence.
 *
 * Resolution precedence is deliberate and documented inline.
 *
 * Canonical spec: docs/architecture/growlocal360_master_prompt_v5.md
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeCategorySlug } from '@/lib/utils/slugify';

export type SingleSegmentKind = 'service' | 'category' | 'city' | 'none';
export type DoubleSegmentKind = 'category_service' | 'city_service' | 'service_city' | 'none';

/**
 * Is this root segment a GBP-anchored CITY? A city is "anchored" when it has a
 * `service_areas` row flagged as anchored OR (for multi_location sites) a
 * `locations` row whose slug matches. Returns the matching slug + display name.
 *
 * NOTE: anchoring uses `service_areas.is_anchor` (added in the v5 migration) so a
 * single-location SAB can still declare extra GBP-anchored cities.
 */
export async function resolveCity(
  siteId: string,
  segment: string,
): Promise<{ slug: string; name: string; state: string | null } | null> {
  const supabase = createAdminClient();

  // 1) anchored service area. Select is_anchor defensively — if the v5 migration
  // (053) hasn't been applied yet, fall back to a slug-only query so routing
  // doesn't crash (the city simply won't resolve as an anchor until migrated).
  type AnchorRow = { slug: string; name: string; state: string | null; is_anchor?: boolean };
  const anchored = await supabase
    .from('service_areas')
    .select('slug, name, state, is_anchor')
    .eq('site_id', siteId)
    .eq('slug', segment)
    .maybeSingle();
  // If the v5 migration (053) isn't applied, the is_anchor column is missing and
  // the query errors — treat that as "no anchor" so routing doesn't crash.
  const area: AnchorRow | null = anchored.error ? null : (anchored.data as AnchorRow | null);
  if (area && area.is_anchor) {
    return { slug: area.slug, name: area.name, state: area.state };
  }

  // 2) a location row (multi_location anchor) whose slug matches
  const { data: loc } = await supabase
    .from('locations')
    .select('slug, city, state')
    .eq('site_id', siteId)
    .eq('slug', segment)
    .maybeSingle();
  if (loc) {
    return { slug: loc.slug, name: loc.city, state: loc.state };
  }

  return null;
}

/**
 * Does this segment match any GBP-category SERVICE slug for the site? (Used to
 * tell "/{service}/{city}" Pattern 1 from "/{category}/{service}".)
 */
export async function isServiceSlug(siteId: string, segment: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data: services } = await supabase
    .from('services')
    .select('slug')
    .eq('site_id', siteId);
  return (services || []).some((s) => s.slug === segment);
}

/** Does this segment match a (secondary) category slug? */
export async function matchCategorySlug(
  siteId: string,
  segment: string,
): Promise<{ id: string; isPrimary: boolean } | null> {
  const supabase = createAdminClient();
  const { data: cats } = await supabase
    .from('site_categories')
    .select('id, is_primary, gbp_category:gbp_categories(name, display_name)')
    .eq('site_id', siteId);
  for (const c of cats || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (c as any).gbp_category;
    if (g && (g.name === segment || normalizeCategorySlug(g.display_name) === segment)) {
      return { id: c.id, isPrimary: c.is_primary };
    }
  }
  return null;
}
