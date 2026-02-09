import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug } from '@/lib/sites/get-site';
import { createAdminClient } from '@/lib/supabase/admin';
import { ServicesPage } from '@/components/templates/local-service-pro/services-page';
import type { Service, SiteCategory, GBPCategory } from '@/types/database';

export const dynamic = 'force-dynamic';

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

  // Use admin client to bypass RLS for reliable data access
  const admin = createAdminClient();

  const { data: categories } = await admin
    .from('site_categories')
    .select('*, gbp_category:gbp_categories(*)')
    .eq('site_id', data.site.id)
    .order('is_primary', { ascending: false })
    .order('sort_order');

  const { data: services } = await admin
    .from('services')
    .select('*')
    .eq('site_id', data.site.id)
    .eq('is_active', true)
    .order('sort_order');

  const typedCategories = (categories || []) as (SiteCategory & { gbp_category: GBPCategory })[];
  const typedServices = (services || []) as Service[];

  // Group services by category ID
  const servicesByCategory: Record<string, Service[]> = {};
  for (const cat of typedCategories) {
    servicesByCategory[cat.id] = typedServices.filter(s => s.site_category_id === cat.id);
  }

  return (
    <ServicesPage
      site={data.site}
      primaryLocation={data.primaryLocation}
      categories={typedCategories}
      servicesByCategory={servicesByCategory}
      serviceAreas={data.serviceAreas}
      siteSlug={slug}
    />
  );
}
