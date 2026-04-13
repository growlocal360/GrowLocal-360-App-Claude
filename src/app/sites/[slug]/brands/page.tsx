import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { withOpenGraph, getSiteOgImage } from '@/lib/sites/og-metadata';
import { BrandsListingPage } from '@/components/templates/local-service-pro/brands-listing-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import { toPublicSite, toPublicLocation, toPublicBrandListing, toPublicAreaListing, toPublicCategory } from '@/lib/sites/public-render-model';
import { createAdminClient } from '@/lib/supabase/admin';

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface BrandsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BrandsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const { site, primaryLocation } = data;
  const city = primaryLocation?.city;
  const industry = (site.settings?.core_industry as string) || '';

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = site.custom_domain || `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/brands`;

  const title = `${industry ? `${industry} ` : ''}Brands We Service${city ? ` in ${city}` : ''} | ${site.name}`;
  const description = `${site.name} services all major${industry ? ` ${industry.toLowerCase()}` : ''} brands${city ? ` in ${city} and surrounding areas` : ''}. See the full list of brands we work with.`;
  const ogImage = getSiteOgImage(site.settings);

  return withOpenGraph({
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
  }, { url: canonicalUrl, siteName: site.name, logoUrl: ogImage });
}

export default async function BrandsPageRoute({ params }: BrandsPageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    notFound();
  }

  const supabase = createAdminClient();
  const [{ categories }, { data: schedulingConfig }] = await Promise.all([
    getCategoriesWithServices(data.site.id),
    supabase
      .from('scheduling_configs')
      .select('is_active, cta_style')
      .eq('site_id', data.site.id)
      .single(),
  ]);

  const navCategories: NavCategory[] = categories.map(c => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  return (
    <BrandsListingPage
      site={toPublicSite(data.site)}
      primaryLocation={data.primaryLocation ? toPublicLocation(data.primaryLocation) : null}
      brands={data.brands.map(toPublicBrandListing)}
      serviceAreas={data.serviceAreas.map(toPublicAreaListing)}
      categories={navCategories}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
      siteSlug={slug}
    />
  );
}
