import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { ServiceAreasListingPage } from '@/components/templates/local-service-pro/service-areas-listing-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import {
  toPublicSite,
  toPublicLocation,
  toPublicAreaListing,
  toPublicNeighborhoodListing,
  toPublicCategory,
} from '@/lib/sites/public-render-model';

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface AreasPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: AreasPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const { site, primaryLocation } = data;
  const city = primaryLocation?.city;

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = (site.custom_domain_verified && site.custom_domain) ? site.custom_domain : `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/areas`;

  return {
    title: `Areas We Serve${city ? ` in ${city}` : ''} | ${site.name}`,
    description: `${site.name} proudly serves${city ? ` ${city} and` : ''} surrounding communities. See all the areas we cover and contact us for service.`,
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function AreasPageRoute({ params }: AreasPageProps) {
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
    <ServiceAreasListingPage
      site={toPublicSite(data.site)}
      primaryLocation={data.primaryLocation ? toPublicLocation(data.primaryLocation) : null}
      serviceAreas={data.serviceAreas.map(toPublicAreaListing)}
      neighborhoods={data.neighborhoods.map(toPublicNeighborhoodListing)}
      categories={navCategories}
      siteSlug={slug}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
    />
  );
}
