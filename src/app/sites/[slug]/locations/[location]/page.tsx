import { notFound } from 'next/navigation';
import { getLocationBySlug } from '@/lib/sites/get-site';
import { LocationPage } from '@/components/templates/local-service-pro/location-page';

interface LocationPageProps {
  params: Promise<{
    slug: string;
    location: string;
  }>;
}

export async function generateMetadata({ params }: LocationPageProps) {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    return { title: 'Location Not Found' };
  }

  const { site, location: locationData } = data;
  const industry = site.settings?.core_industry || 'Professional Services';

  // SEO-optimized title: "[Primary Category] in [City], [State] | [Business Name]"
  // This is the GBP landing page structure
  const title = `${industry} in ${locationData.city}, ${locationData.state} | ${site.name}`;

  // SEO-optimized description
  const description = `Looking for ${industry.toLowerCase()} in ${locationData.city}, ${locationData.state}? ${site.name} offers professional services with fast response times. Call today for a free quote!`;

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

export default async function LocationRoute({ params }: LocationPageProps) {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    notFound();
  }

  return <LocationPage data={data} siteSlug={slug} />;
}
