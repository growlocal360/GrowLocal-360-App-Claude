import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSiteBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { getGoogleReviewsForSite } from '@/lib/sites/get-reviews';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { BrandDetailPage } from '@/components/templates/local-service-pro/brand-detail-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import {
  toPublicSite, toPublicLocation, toPublicBrandDetail, toPublicBrandListing,
  toPublicAreaListing, toPublicReview, toPublicWorkItem,
} from '@/lib/sites/public-render-model';
import { getPublishedWorkItems } from '@/lib/sites/get-work-items';

export const revalidate = 3600;

interface BrandDetailPageProps {
  params: Promise<{ slug: string; brandSlug: string }>;
}

async function getBrandBySlug(siteSlug: string, brandSlug: string) {
  const data = await getSiteBySlug(siteSlug);
  if (!data) return null;

  const brand = data.brands.find(b => b.slug === brandSlug);
  if (!brand) return null;

  return { ...data, brand };
}

export async function generateStaticParams() {
  const supabase = createAdminClient();

  const { data: brands } = await supabase
    .from('site_brands')
    .select('slug, site_id, sites!inner(slug, is_active)')
    .eq('is_active', true);

  if (!brands) return [];

  return brands
    .filter((b: Record<string, unknown>) => {
      const sites = b.sites as { is_active: boolean } | null;
      return sites?.is_active;
    })
    .map((b: Record<string, unknown>) => ({
      slug: (b.sites as { slug: string }).slug,
      brandSlug: b.slug as string,
    }));
}

export async function generateMetadata({ params }: BrandDetailPageProps): Promise<Metadata> {
  const { slug, brandSlug } = await params;
  const data = await getBrandBySlug(slug, brandSlug);

  if (!data) {
    return { title: 'Brand Not Found' };
  }

  const { site, brand, primaryLocation } = data;
  const city = primaryLocation?.city || '';
  const state = primaryLocation?.state || '';
  const industry = (site.settings?.core_industry as string) || '';

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = site.custom_domain || `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/brands/${brandSlug}`;

  return {
    title: brand.meta_title || `${brand.name} ${industry} ${city} ${state} | ${site.name}`.trim(),
    description: brand.meta_description || `Professional ${brand.name} ${industry.toLowerCase()} services in ${city}, ${state} and surrounding areas. ${site.name} is your trusted local ${brand.name} service provider.`,
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function BrandDetailPageRoute({ params }: BrandDetailPageProps) {
  const { slug, brandSlug } = await params;
  const data = await getBrandBySlug(slug, brandSlug);

  if (!data) {
    notFound();
  }

  const { site, brand, primaryLocation, serviceAreas, brands } = data;

  const [{ categories, services }, googleReviews, workItems] = await Promise.all([
    getCategoriesWithServices(site.id),
    getGoogleReviewsForSite(site.id),
    getPublishedWorkItems(site.id, { brandName: brand.name, limit: 6 }),
  ]);

  const navCategories: NavCategory[] = categories.map(c => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  // Build category lookup by site_category_id
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  // Map services to include their category info
  const allServices = services.map(s => {
    const cat = categoryMap.get(s.site_category_id);
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      categoryName: cat?.gbp_category.display_name || '',
      categorySlug: cat ? normalizeCategorySlug(cat.gbp_category.display_name) : '',
      isPrimaryCategory: cat?.is_primary ?? false,
    };
  });

  return (
    <BrandDetailPage
      site={toPublicSite(site)}
      brand={toPublicBrandDetail(brand)}
      primaryLocation={primaryLocation ? toPublicLocation(primaryLocation) : null}
      services={allServices}
      serviceAreas={serviceAreas.map(toPublicAreaListing)}
      brands={brands.map(toPublicBrandListing)}
      categories={navCategories}
      googleReviews={googleReviews.map(toPublicReview)}
      siteSlug={slug}
      recentWorkItems={workItems.map(toPublicWorkItem)}
    />
  );
}
