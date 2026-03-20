import { NextResponse } from 'next/server';
import { getSiteBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { getPublishedWorkItems } from '@/lib/sites/get-work-items';

interface SitemapImage {
  url: string;
  title?: string;
}

interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
  images?: SitemapImage[];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
      headers: { 'Content-Type': 'application/xml' },
    });
  }

  const { site, serviceAreas, neighborhoods, brands } = data;
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = site.custom_domain || `${slug}.${appDomain}`;
  const baseUrl = `https://${domain}`;
  const lastmod = new Date(site.updated_at).toISOString().split('T')[0];

  const entries: SitemapEntry[] = [];

  // Core pages
  entries.push(
    { url: baseUrl, lastmod, changefreq: 'weekly', priority: 1.0 },
    { url: `${baseUrl}/about`, lastmod, changefreq: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/contact`, lastmod, changefreq: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/faq`, lastmod, changefreq: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/reviews`, lastmod, changefreq: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/services`, lastmod, changefreq: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/work`, lastmod, changefreq: 'weekly', priority: 0.8 },
  );

  // Categories and services
  const { categories, services } = await getCategoriesWithServices(site.id);

  const catSlugMap = new Map<string, { slug: string; isPrimary: boolean }>();
  for (const cat of categories) {
    const catSlug = normalizeCategorySlug(cat.gbp_category.display_name);
    catSlugMap.set(cat.id, { slug: catSlug, isPrimary: cat.is_primary });

    if (!cat.is_primary) {
      entries.push({ url: `${baseUrl}/${catSlug}`, lastmod, changefreq: 'weekly', priority: 0.8 });
    }
  }

  for (const service of services) {
    const cat = service.site_category_id ? catSlugMap.get(service.site_category_id) : null;
    if (cat?.isPrimary) {
      entries.push({ url: `${baseUrl}/${service.slug}`, lastmod, changefreq: 'monthly', priority: 0.8 });
    } else if (cat) {
      entries.push({ url: `${baseUrl}/${cat.slug}/${service.slug}`, lastmod, changefreq: 'monthly', priority: 0.8 });
    }
  }

  // Service areas
  for (const area of serviceAreas || []) {
    entries.push({ url: `${baseUrl}/areas/${area.slug}`, lastmod, changefreq: 'monthly', priority: 0.6 });
  }

  // Neighborhoods
  for (const n of neighborhoods || []) {
    if (n.is_active) {
      entries.push({ url: `${baseUrl}/neighborhoods/${n.slug}`, lastmod, changefreq: 'monthly', priority: 0.5 });
    }
  }

  // Brands
  if (brands && brands.length > 0) {
    entries.push({ url: `${baseUrl}/brands`, lastmod, changefreq: 'monthly', priority: 0.5 });
    for (const brand of brands) {
      entries.push({ url: `${baseUrl}/brands/${brand.slug}`, lastmod, changefreq: 'monthly', priority: 0.5 });
    }
  }

  // Published work items (with image sitemap entries)
  const workItems = await getPublishedWorkItems(site.id, { limit: 100 });
  for (const item of workItems) {
    const itemDate = new Date(item.updated_at || item.created_at).toISOString().split('T')[0];
    const images: SitemapImage[] = (item.images || [])
      .filter((img: { url: string; alt?: string }) => img.url)
      .map((img: { url: string; alt?: string }) => ({
        url: img.url,
        title: img.alt || item.title,
      }));
    entries.push({
      url: `${baseUrl}/work/${item.slug}`,
      lastmod: itemDate,
      changefreq: 'monthly',
      priority: 0.7,
      images: images.length > 0 ? images : undefined,
    });
  }

  // Build XML
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries.map(e => [
      '  <url>',
      `    <loc>${escapeXml(e.url)}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : '',
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : '',
      e.priority !== undefined ? `    <priority>${e.priority}</priority>` : '',
      ...(e.images || []).map(img => [
        '    <image:image>',
        `      <image:loc>${escapeXml(img.url)}</image:loc>`,
        img.title ? `      <image:title>${escapeXml(img.title)}</image:title>` : '',
        '    </image:image>',
      ].filter(Boolean).join('\n')),
      '  </url>',
    ].filter(Boolean).join('\n')),
    '</urlset>',
  ].join('\n');

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
