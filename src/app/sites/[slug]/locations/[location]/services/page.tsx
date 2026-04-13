import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getLocationBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { ServicesPage } from '@/components/templates/local-service-pro/services-page';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Service } from '@/types/database';
import {
  toPublicSite,
  toPublicLocation,
  toPublicCategory,
  toPublicServiceListing,
  toPublicAreaListing,
} from '@/lib/sites/public-render-model';

export const revalidate = 3600;

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

  const supabase = createAdminClient();
  const [{ categories, services }, { data: schedulingConfig }] = await Promise.all([
    getCategoriesWithServices(data.site.id),
    supabase
      .from('scheduling_configs')
      .select('is_active, cta_style')
      .eq('site_id', data.site.id)
      .single(),
  ]);

  // Group services by category ID
  const servicesByCategory: Record<string, Service[]> = {};
  for (const cat of categories) {
    servicesByCategory[cat.id] = services.filter(s => s.site_category_id === cat.id);
  }

  // Map servicesByCategory values to render model
  const mappedServicesByCategory: Record<string, ReturnType<typeof toPublicServiceListing>[]> = {};
  for (const [catId, svcs] of Object.entries(servicesByCategory)) {
    mappedServicesByCategory[catId] = svcs.map(toPublicServiceListing);
  }

  return (
    <ServicesPage
      site={toPublicSite(data.site)}
      primaryLocation={toPublicLocation(data.location)}
      categories={categories.map(toPublicCategory)}
      servicesByCategory={mappedServicesByCategory}
      serviceAreas={data.serviceAreas.map(toPublicAreaListing)}
      siteSlug={slug}
      locationSlug={location}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
    />
  );
}
