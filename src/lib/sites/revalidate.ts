import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import type { GenerationScope } from '@/types/database';

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

  const [{ data: site }, { data: services }, { data: categories }, { data: serviceAreas }, { data: neighborhoods }] =
    await Promise.all([
      supabase.from('sites').select('slug').eq('id', siteId).single(),
      supabase.from('services').select('slug, site_category_id').eq('site_id', siteId).eq('is_active', true),
      supabase
        .from('site_categories')
        .select('id, is_primary, gbp_category:gbp_categories(display_name)')
        .eq('site_id', siteId),
      supabase.from('service_areas').select('slug').eq('site_id', siteId),
      supabase.from('neighborhoods').select('slug').eq('site_id', siteId).eq('is_active', true),
    ]);

  if (!site?.slug) return;

  const base = `/sites/${site.slug}`;

  // Revalidate the layout (catches home, about, contact, etc.)
  revalidatePath(base, 'layout');

  // Revalidate listing pages
  revalidatePath(`${base}/services`, 'page');
  revalidatePath(`${base}/areas`, 'page');
  revalidatePath(`${base}/faq`, 'page');
  revalidatePath(`${base}/brands`, 'page');
  revalidatePath(`${base}/work`, 'page');

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

  // Revalidate neighborhood pages
  for (const n of neighborhoods || []) {
    revalidatePath(`${base}/neighborhoods/${n.slug}`, 'page');
  }
}

/**
 * Selectively revalidates only the pages affected by a scoped content generation.
 * Used instead of revalidateSite() when only a subset of content was regenerated.
 */
export async function revalidatePages(siteId: string, scope: GenerationScope) {
  const supabase = createAdminClient();

  const { data: site } = await supabase.from('sites').select('slug').eq('id', siteId).single();
  if (!site?.slug) return;

  const base = `/sites/${site.slug}`;

  // Always revalidate layout so header/footer updates propagate
  revalidatePath(base, 'layout');

  switch (scope.type) {
    case 'core-pages': {
      const pages = scope.pages || ['home', 'about', 'contact'];
      for (const page of pages) {
        if (page === 'home') {
          revalidatePath(base, 'page');
        } else {
          revalidatePath(`${base}/${page}`, 'page');
        }
      }
      break;
    }

    case 'services': {
      // Fetch the specific services to get their slugs and category info
      const { data: services } = await supabase
        .from('services')
        .select('slug, site_category_id')
        .in('id', scope.serviceIds);

      const { data: categories } = await supabase
        .from('site_categories')
        .select('id, is_primary, gbp_category:gbp_categories(display_name)')
        .eq('site_id', siteId);

      const catSlugMap = new Map<string, { slug: string; isPrimary: boolean }>();
      for (const cat of categories || []) {
        const gbp = Array.isArray(cat.gbp_category) ? cat.gbp_category[0] : cat.gbp_category;
        if (gbp?.display_name) {
          catSlugMap.set(cat.id, { slug: normalizeCategorySlug(gbp.display_name), isPrimary: cat.is_primary });
        }
      }

      for (const service of services || []) {
        const cat = service.site_category_id ? catSlugMap.get(service.site_category_id) : null;
        if (cat?.isPrimary) {
          revalidatePath(`${base}/${service.slug}`, 'page');
        } else if (cat) {
          revalidatePath(`${base}/${cat.slug}/${service.slug}`, 'page');
        }
        revalidatePath(`${base}/${service.slug}`, 'page');
      }

      // Also revalidate services listing
      revalidatePath(`${base}/services`, 'page');
      break;
    }

    case 'categories': {
      const { data: categories } = await supabase
        .from('site_categories')
        .select('id, gbp_category:gbp_categories(display_name)')
        .in('id', scope.categoryIds);

      for (const cat of categories || []) {
        const gbp = Array.isArray(cat.gbp_category) ? cat.gbp_category[0] : cat.gbp_category;
        if (gbp?.display_name) {
          revalidatePath(`${base}/${normalizeCategorySlug(gbp.display_name)}`, 'page');
        }
      }
      break;
    }

    case 'service-areas': {
      const { data: areas } = await supabase
        .from('service_areas')
        .select('slug')
        .in('id', scope.serviceAreaIds);

      for (const area of areas || []) {
        revalidatePath(`${base}/areas/${area.slug}`, 'page');
      }
      revalidatePath(`${base}/areas`, 'page');
      break;
    }

    case 'brands': {
      const { data: brands } = await supabase
        .from('site_brands')
        .select('slug')
        .in('id', scope.brandIds);

      for (const brand of brands || []) {
        revalidatePath(`${base}/brands/${brand.slug}`, 'page');
      }
      revalidatePath(`${base}/brands`, 'page');
      break;
    }

    case 'neighborhoods': {
      const { data: neighborhoods } = await supabase
        .from('neighborhoods')
        .select('slug')
        .in('id', scope.neighborhoodIds);

      for (const n of neighborhoods || []) {
        revalidatePath(`${base}/neighborhoods/${n.slug}`, 'page');
      }
      break;
    }

    case 'reviews':
      // Reviews affect home page (trust bar) and about page (review highlights)
      revalidatePath(base, 'page');
      revalidatePath(`${base}/about`, 'page');
      break;
  }
}
