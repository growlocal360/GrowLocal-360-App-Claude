import { MetadataRoute } from 'next';
import { getSiteBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { getPublishedWorkItems } from '@/lib/sites/get-work-items';

export default async function sitemap({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<MetadataRoute.Sitemap> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) return [];

  const { site, serviceAreas, neighborhoods, brands } = data;
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = site.custom_domain || `${slug}.${appDomain}`;
  const baseUrl = `https://${domain}`;

  const entries: MetadataRoute.Sitemap = [];

  // Core pages
  entries.push(
    { url: baseUrl, lastModified: site.updated_at, priority: 1.0, changeFrequency: 'weekly' },
    { url: `${baseUrl}/about`, lastModified: site.updated_at, priority: 0.7, changeFrequency: 'monthly' },
    { url: `${baseUrl}/contact`, lastModified: site.updated_at, priority: 0.7, changeFrequency: 'monthly' },
    { url: `${baseUrl}/faq`, lastModified: site.updated_at, priority: 0.5, changeFrequency: 'monthly' },
    { url: `${baseUrl}/services`, lastModified: site.updated_at, priority: 0.8, changeFrequency: 'weekly' },
    { url: `${baseUrl}/work`, lastModified: site.updated_at, priority: 0.8, changeFrequency: 'weekly' },
  );

  // Categories and services
  const { categories, services } = await getCategoriesWithServices(site.id);

  const catSlugMap = new Map<string, { slug: string; isPrimary: boolean }>();
  for (const cat of categories) {
    const catSlug = normalizeCategorySlug(cat.gbp_category.display_name);
    catSlugMap.set(cat.id, { slug: catSlug, isPrimary: cat.is_primary });

    // Non-primary categories get their own page
    if (!cat.is_primary) {
      entries.push({
        url: `${baseUrl}/${catSlug}`,
        lastModified: site.updated_at,
        priority: 0.8,
        changeFrequency: 'weekly',
      });
    }
  }

  // Services
  for (const service of services) {
    const cat = service.site_category_id ? catSlugMap.get(service.site_category_id) : null;
    if (cat?.isPrimary) {
      entries.push({
        url: `${baseUrl}/${service.slug}`,
        lastModified: site.updated_at,
        priority: 0.8,
        changeFrequency: 'monthly',
      });
    } else if (cat) {
      entries.push({
        url: `${baseUrl}/${cat.slug}/${service.slug}`,
        lastModified: site.updated_at,
        priority: 0.8,
        changeFrequency: 'monthly',
      });
    }
  }

  // Service areas
  for (const area of serviceAreas || []) {
    entries.push({
      url: `${baseUrl}/areas/${area.slug}`,
      lastModified: site.updated_at,
      priority: 0.6,
      changeFrequency: 'monthly',
    });
  }

  // Neighborhoods
  for (const n of neighborhoods || []) {
    if (n.is_active) {
      entries.push({
        url: `${baseUrl}/neighborhoods/${n.slug}`,
        lastModified: site.updated_at,
        priority: 0.5,
        changeFrequency: 'monthly',
      });
    }
  }

  // Brands
  if (brands && brands.length > 0) {
    entries.push({
      url: `${baseUrl}/brands`,
      lastModified: site.updated_at,
      priority: 0.5,
      changeFrequency: 'monthly',
    });

    for (const brand of brands) {
      entries.push({
        url: `${baseUrl}/brands/${brand.slug}`,
        lastModified: site.updated_at,
        priority: 0.5,
        changeFrequency: 'monthly',
      });
    }
  }

  // Published work items
  const workItems = await getPublishedWorkItems(site.id, { limit: 100 });
  for (const item of workItems) {
    entries.push({
      url: `${baseUrl}/work/${item.slug}`,
      lastModified: item.updated_at || item.created_at,
      priority: 0.7,
      changeFrequency: 'monthly',
    });
  }

  return entries;
}
