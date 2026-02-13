import { notFound } from 'next/navigation';
import { getNeighborhoodBySlug } from '@/lib/sites/get-site';
import { NeighborhoodPage } from '@/components/templates/local-service-pro/neighborhood-page';

export const revalidate = 3600;

interface NeighborhoodPageProps {
  params: Promise<{
    slug: string;
    location: string;
    neighborhood: string;
  }>;
}

export async function generateMetadata({ params }: NeighborhoodPageProps) {
  const { slug, location, neighborhood } = await params;
  const data = await getNeighborhoodBySlug(slug, location, neighborhood);

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
  const { slug, location, neighborhood } = await params;
  const data = await getNeighborhoodBySlug(slug, location, neighborhood);

  if (!data) {
    notFound();
  }

  return <NeighborhoodPage data={data} siteSlug={slug} locationSlug={location} />;
}
