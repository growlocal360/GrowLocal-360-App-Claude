/**
 * Cheap lookup: does this site have any active brand rows?
 * ----------------------------------------------------------------------------
 * Used by page-level data loaders that don't already load the full brands
 * list but still need to feed `toPublicSite(site, { hasBrands })` so the
 * "Brands" nav link surfaces correctly on every page.
 *
 * Returns a single boolean from a HEAD count query — no row payload
 * transferred. ~1ms latency, indexable.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export async function siteHasActiveBrands(siteId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from('site_brands')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('is_active', true);
  return (count ?? 0) > 0;
}
