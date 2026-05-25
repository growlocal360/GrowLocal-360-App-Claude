import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import type { GenerationScope } from '@/types/database';

/**
 * Revalidates every cached path for a site.
 *
 * Called after any user-facing edit (settings, services, brands, content,
 * scheduling, etc.) so changes appear immediately rather than waiting up
 * to an hour for ISR to expire. Users equate "instant" with "it worked"
 * — if they don't see a change in a few seconds they'll re-save and waste
 * a regeneration.
 *
 * Covers: root listings, every category/service/area/neighborhood/brand/work
 * detail page, the home page, /about, /contact, /faq, /reviews, /job-snaps,
 * and the full /locations/{loc}/* multi-location subtree.
 */
export async function revalidateSite(siteId: string) {
  console.log('[revalidateSite] start', { siteId });
  const startedAt = Date.now();
  const supabase = createAdminClient();

  const [
    { data: site },
    { data: services },
    { data: categories },
    { data: serviceAreas },
    { data: neighborhoods },
    { data: brands },
    { data: locations },
    { data: workItems },
  ] = await Promise.all([
    supabase.from('sites').select('slug').eq('id', siteId).single(),
    supabase.from('services').select('slug, site_category_id').eq('site_id', siteId).eq('is_active', true),
    supabase
      .from('site_categories')
      .select('id, is_primary, gbp_category:gbp_categories(display_name)')
      .eq('site_id', siteId),
    supabase.from('service_areas').select('slug').eq('site_id', siteId),
    supabase.from('neighborhoods').select('slug').eq('site_id', siteId).eq('is_active', true),
    supabase.from('site_brands').select('slug').eq('site_id', siteId).eq('is_active', true),
    supabase.from('locations').select('slug').eq('site_id', siteId),
    supabase.from('work_items').select('slug').eq('site_id', siteId).eq('status', 'published'),
  ]);

  if (!site?.slug) return;

  const base = `/sites/${site.slug}`;

  // Layout revalidation catches shared header/footer state across all pages
  revalidatePath(base, 'layout');

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

  // -------- Root paths (single-location + multi-location root) --------
  revalidatePath(base, 'page'); // home
  for (const path of ['/about', '/contact', '/faq', '/services', '/areas', '/brands', '/work', '/reviews', '/job-snaps']) {
    revalidatePath(`${base}${path}`, 'page');
  }

  // Brand detail pages (site-wide, not per-location)
  for (const brand of brands || []) {
    revalidatePath(`${base}/brands/${brand.slug}`, 'page');
  }

  // Category pages
  for (const [, cat] of catSlugMap) {
    revalidatePath(`${base}/${cat.slug}`, 'page');
  }

  // Service pages (primary at root, secondary nested under category)
  for (const service of services || []) {
    const cat = service.site_category_id ? catSlugMap.get(service.site_category_id) : null;
    if (cat?.isPrimary) {
      revalidatePath(`${base}/${service.slug}`, 'page');
    } else if (cat) {
      revalidatePath(`${base}/${cat.slug}/${service.slug}`, 'page');
    }
    // Defensive: revalidate root-level path too in case service was recently moved between categories
    revalidatePath(`${base}/${service.slug}`, 'page');
  }

  // Service areas + neighborhoods
  for (const area of serviceAreas || []) {
    revalidatePath(`${base}/areas/${area.slug}`, 'page');
  }
  for (const n of neighborhoods || []) {
    revalidatePath(`${base}/neighborhoods/${n.slug}`, 'page');
  }

  // Work detail pages
  for (const w of workItems || []) {
    revalidatePath(`${base}/work/${w.slug}`, 'page');
  }

  // -------- Multi-location subtree --------
  // Every location mirrors most of the root paths under /locations/{loc}/
  for (const loc of locations || []) {
    const locBase = `${base}/locations/${loc.slug}`;
    revalidatePath(locBase, 'page'); // location home
    for (const path of ['/about', '/contact', '/services', '/areas', '/work', '/job-snaps']) {
      revalidatePath(`${locBase}${path}`, 'page');
    }
    for (const [, cat] of catSlugMap) {
      revalidatePath(`${locBase}/${cat.slug}`, 'page');
    }
    for (const service of services || []) {
      const cat = service.site_category_id ? catSlugMap.get(service.site_category_id) : null;
      if (cat?.isPrimary) {
        revalidatePath(`${locBase}/${service.slug}`, 'page');
      } else if (cat) {
        revalidatePath(`${locBase}/${cat.slug}/${service.slug}`, 'page');
      }
      revalidatePath(`${locBase}/${service.slug}`, 'page');
    }
    for (const area of serviceAreas || []) {
      revalidatePath(`${locBase}/areas/${area.slug}`, 'page');
    }
    for (const n of neighborhoods || []) {
      revalidatePath(`${locBase}/neighborhoods/${n.slug}`, 'page');
    }
    for (const w of workItems || []) {
      revalidatePath(`${locBase}/work/${w.slug}`, 'page');
    }
  }

  console.log('[revalidateSite] done', {
    siteId,
    slug: site.slug,
    ms: Date.now() - startedAt,
    counts: {
      services: services?.length || 0,
      categories: categories?.length || 0,
      areas: serviceAreas?.length || 0,
      neighborhoods: neighborhoods?.length || 0,
      brands: brands?.length || 0,
      locations: locations?.length || 0,
      workItems: workItems?.length || 0,
    },
  });
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
      // Reviews affect home page (trust bar), about page, and reviews page
      revalidatePath(base, 'page');
      revalidatePath(`${base}/about`, 'page');
      revalidatePath(`${base}/reviews`, 'page');
      break;
  }
}
