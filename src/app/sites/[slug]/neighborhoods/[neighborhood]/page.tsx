import { notFound } from 'next/navigation';
import { getNeighborhoodBySlugSingleLocation } from '@/lib/sites/get-site';
import { getCategoriesWithServices, categorySlugFromName } from '@/lib/sites/get-services';
import { NeighborhoodPageSingleLocation } from '@/components/templates/local-service-pro/neighborhood-page-single';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

export const revalidate = 3600;

interface NeighborhoodPageProps {
  params: Promise<{
    slug: string;
    neighborhood: string;
  }>;
}

export async function generateMetadata({ params }: NeighborhoodPageProps) {
  const { slug, neighborhood } = await params;
  const data = await getNeighborhoodBySlugSingleLocation(slug, neighborhood);

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

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
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
    slug: categorySlugFromName(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  return <NeighborhoodPageSingleLocation data={data} siteSlug={slug} categories={navCategories} />;
}
