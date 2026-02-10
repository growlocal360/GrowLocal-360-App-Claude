import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getLocationBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { ServicesPage } from '@/components/templates/local-service-pro/services-page';
import type { Service } from '@/types/database';

interface MultiLocationServicesPageProps {
  params: Promise<{ slug: string; location: string }>;
}

export async function generateMetadata({ params }: MultiLocationServicesPageProps): Promise<Metadata> {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const { site, location: loc } = data;

  return {
    title: `Our Services in ${loc.city}, ${loc.state} | ${site.name}`,
    description: `${site.name} offers professional services in ${loc.city}, ${loc.state}. Browse our full range of services and request a free estimate today.`,
  };
}

export default async function MultiLocationServicesPageRoute({ params }: MultiLocationServicesPageProps) {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    notFound();
  }

  const { categories, services } = await getCategoriesWithServices(data.site.id);

  // Group services by category ID
  const servicesByCategory: Record<string, Service[]> = {};
  for (const cat of categories) {
    servicesByCategory[cat.id] = services.filter(s => s.site_category_id === cat.id);
  }

  return (
    <ServicesPage
      site={data.site}
      primaryLocation={data.location}
      categories={categories}
      servicesByCategory={servicesByCategory}
      serviceAreas={data.serviceAreas}
      siteSlug={slug}
      locationSlug={location}
    />
  );
}
