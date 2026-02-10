import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { ServicesPage } from '@/components/templates/local-service-pro/services-page';
import type { Service } from '@/types/database';

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface ServicesPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ServicesPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const { site, primaryLocation } = data;
  const city = primaryLocation?.city;

  return {
    title: `Our Services${city ? ` in ${city}` : ''} | ${site.name}`,
    description: `${site.name} offers professional services${city ? ` in ${city}` : ''}. Browse our full range of services and request a free estimate today.`,
  };
}

export default async function ServicesPageRoute({ params }: ServicesPageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

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
      primaryLocation={data.primaryLocation}
      categories={categories}
      servicesByCategory={servicesByCategory}
      serviceAreas={data.serviceAreas}
      siteSlug={slug}
    />
  );
}
