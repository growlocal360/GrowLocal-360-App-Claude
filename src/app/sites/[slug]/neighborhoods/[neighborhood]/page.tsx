import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getNeighborhoodBySlugSingleLocation } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { NeighborhoodPageSingleLocation } from '@/components/templates/local-service-pro/neighborhood-page-single';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import { toPublicSite, toPublicLocation, toPublicNeighborhoodDetail, toPublicNeighborhoodListing } from '@/lib/sites/public-render-model';

export const revalidate = 3600;

interface NeighborhoodPageProps {
  params: Promise<{
    slug: string;
    neighborhood: string;
  }>;
}

export async function generateMetadata({ params }: NeighborhoodPageProps): Promise<Metadata> {
  const { slug, neighborhood: neighborhoodSlug } = await params;
  const data = await getNeighborhoodBySlugSingleLocation(slug, neighborhoodSlug);

  if (!data) {
    return { title: 'Neighborhood Not Found' };
  }

  const { site, neighborhood: neighborhoodData, location: locationData } = data;
  const industry = site.settings?.core_industry || 'Professional Services';

  // SEO-optimized title: "[Primary Category] in [Neighborhood] | [Business Name]"
  const title = neighborhoodData.meta_title ||
    `${industry} in ${neighborhoodData.name}, ${locationData.city} | ${site.name}`;

  // SEO-optimized description
  const description = neighborhoodData.meta_description ||
    `Looking for ${industry.toLowerCase()} in ${neighborhoodData.name}? ${site.name} proudly serves ${neighborhoodData.name} and the greater ${locationData.city}, ${locationData.state} area. Call today for a free quote.`;

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = site.custom_domain || `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/neighborhoods/${neighborhoodSlug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function NeighborhoodRoute({ params }: NeighborhoodPageProps) {
  const { slug, neighborhood } = await params;
  const data = await getNeighborhoodBySlugSingleLocation(slug, neighborhood);

  if (!data) {
    notFound();
  }

  const { categories } = await getCategoriesWithServices(data.site.id);
  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  return (
    <NeighborhoodPageSingleLocation
      data={{
        site: toPublicSite(data.site),
        location: toPublicLocation(data.location),
        neighborhood: toPublicNeighborhoodDetail(data.neighborhood),
        allNeighborhoods: data.allNeighborhoods.map(toPublicNeighborhoodListing),
      }}
      siteSlug={slug}
      categories={navCategories}
    />
  );
}
