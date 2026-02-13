import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getWorkItemBySlug, getRelatedWorkItems } from '@/lib/sites/get-work-items';
import { getCategoriesWithServices, categorySlugFromName } from '@/lib/sites/get-services';
import { createAdminClient } from '@/lib/supabase/admin';
import { WorkDetailPage } from '@/components/templates/local-service-pro/work-detail-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

export const revalidate = 3600;

interface MultiLocationWorkDetailProps {
  params: Promise<{ slug: string; location: string; workSlug: string }>;
}

export async function generateMetadata({ params }: MultiLocationWorkDetailProps): Promise<Metadata> {
  const { slug, workSlug } = await params;
  const data = await getWorkItemBySlug(slug, workSlug);

  if (!data) {
    return { title: 'Work Not Found' };
  }

  const { site, workItem, service, itemLocation, primaryLocation } = data;
  const city = workItem.address_city || itemLocation?.city || primaryLocation.city;
  const state = workItem.address_state || itemLocation?.state || primaryLocation.state;

  const title = workItem.meta_title || [
    workItem.brand_name,
    service?.name,
    city && state ? `– ${city}, ${state}` : '',
    `| ${site.name}`,
  ].filter(Boolean).join(' ');

  const description = workItem.meta_description ||
    `${workItem.title} by ${site.name}${city ? ` in ${city}, ${state}` : ''}. View project details and photos.`;

  const domain = site.domain || site.custom_domain || `${slug}.growlocal360.com`;
  const canonicalUrl = `https://${domain}/work/${workSlug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function MultiLocationWorkDetailRoute({ params }: MultiLocationWorkDetailProps) {
  const { slug, location, workSlug } = await params;
  const data = await getWorkItemBySlug(slug, workSlug);

  if (!data) {
    notFound();
  }

  const [relatedItems, { categories }, { data: serviceAreas }] = await Promise.all([
    getRelatedWorkItems({
      siteId: data.site.id,
      serviceId: data.workItem.service_id,
      locationId: data.workItem.location_id,
      excludeId: data.workItem.id,
    }),
    getCategoriesWithServices(data.site.id),
    createAdminClient()
      .from('service_areas')
      .select('*')
      .eq('site_id', data.site.id)
      .order('sort_order'),
  ]);

  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: categorySlugFromName(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  return (
    <WorkDetailPage
      site={data.site}
      primaryLocation={data.primaryLocation}
      workItem={data.workItem}
      service={data.service}
      itemLocation={data.itemLocation}
      relatedItems={relatedItems}
      serviceAreas={serviceAreas || []}
      categories={navCategories}
      siteSlug={slug}
      locationSlug={location}
    />
  );
}
