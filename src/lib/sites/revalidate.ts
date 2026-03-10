import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeCategorySlug } from '@/lib/utils/slugify';

/**
 * Revalidates all cached pages for a site.
 * Call this after any settings change (branding, business info, services, etc.)
 * so the public site updates immediately instead of waiting for ISR expiry.
 *
 * This aggressively revalidates individual service/category/area paths
 * because cached 404 responses may not be busted by layout-level revalidation alone.
 */
export async function revalidateSite(siteId: string) {
  const supabase = createAdminClient();

  const [{ data: site }, { data: services }, { data: categories }, { data: serviceAreas }] =
    await Promise.all([
      supabase.from('sites').select('slug').eq('id', siteId).single(),
      supabase.from('services').select('slug, site_category_id').eq('site_id', siteId).eq('is_active', true),
      supabase
        .from('site_categories')
        .select('id, is_primary, gbp_category:gbp_categories(display_name)')
        .eq('site_id', siteId),
      supabase.from('service_areas').select('slug').eq('site_id', siteId),
    ]);

  if (!site?.slug) return;

  const base = `/sites/${site.slug}`;

  // Revalidate the layout (catches home, about, contact, etc.)
  revalidatePath(base, 'layout');

  // Revalidate the services listing page and FAQ hub
  revalidatePath(`${base}/services`, 'page');
  revalidatePath(`${base}/faq`, 'page');

  // Build category slug map
  const catSlugMap = new Map<string, { slug: string; isPrimary: boolean }>();
  for (const cat of categories || []) {
    const gbp = Array.isArray(cat.gbp_category) ? cat.gbp_category[0] : cat.gbp_category;
    if (gbp?.display_name) {
      catSlugMap.set(cat.id, {
        slug: normalizeCategorySlug(gbp.display_name),
        isPrimary: cat.is_primary,
      });
    }
  }

  // Revalidate each category page
  for (const [, cat] of catSlugMap) {
    revalidatePath(`${base}/${cat.slug}`, 'page');
  }

  // Revalidate each service page (both primary root-level and nested under category)
  for (const service of services || []) {
    const cat = service.site_category_id ? catSlugMap.get(service.site_category_id) : null;
    if (cat?.isPrimary) {
      // Primary category services live at /sites/slug/service-slug
      revalidatePath(`${base}/${service.slug}`, 'page');
    } else if (cat) {
      // Secondary category services live at /sites/slug/category-slug/service-slug
      revalidatePath(`${base}/${cat.slug}/${service.slug}`, 'page');
    }
    // Also revalidate at root level in case service was recently moved
    revalidatePath(`${base}/${service.slug}`, 'page');
  }

  // Revalidate service area pages
  for (const area of serviceAreas || []) {
    revalidatePath(`${base}/areas/${area.slug}`, 'page');
  }
}
