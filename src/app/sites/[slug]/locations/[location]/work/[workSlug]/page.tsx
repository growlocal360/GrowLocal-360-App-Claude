import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getWorkItemBySlug, getRelatedWorkItems } from '@/lib/sites/get-work-items';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { createAdminClient } from '@/lib/supabase/admin';
import { WorkDetailPage } from '@/components/templates/local-service-pro/work-detail-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import {
  toPublicSite,
  toPublicLocation,
  toPublicWorkItem,
  toPublicAreaListing,
  toPublicCategory,
} from '@/lib/sites/public-render-model';
import { toPublicJobOutput } from '@/lib/job-snaps/public-transform';

export const revalidate = 3600;

interface MultiLocationWorkDetailProps {
  params: Promise<{ slug: string; location: string; workSlug: string }>;
}

export async function generateMetadata({ params }: MultiLocationWorkDetailProps): Promise<Metadata> {
  const { slug, location, workSlug } = await params;
  const data = await getWorkItemBySlug(slug, workSlug);

  if (!data) {
    return { title: 'Work Not Found' };
  }

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = data.site.custom_domain || `${slug}.${appDomain}`;

  const output = toPublicJobOutput(data.workItem, {
    siteName: data.site.name,
    domain,
    locationSlug: location,
  });

  return {
    title: output.metaTitle,
    description: output.metaDescription,
    openGraph: {
      title: output.ogTitle,
      description: output.ogDescription,
      images: output.featuredImage
        ? [{ url: output.featuredImage.url, alt: output.featuredImage.alt }]
        : [],
    },
    alternates: { canonical: output.canonicalUrl },
  };
}

export default async function MultiLocationWorkDetailRoute({ params }: MultiLocationWorkDetailProps) {
  const { slug, location, workSlug } = await params;
  const data = await getWorkItemBySlug(slug, workSlug);

  if (!data) {
    notFound();
  }

  const supabase = createAdminClient();
  const [relatedItems, { categories }, { data: serviceAreas }, { data: schedulingConfig }] = await Promise.all([
    getRelatedWorkItems({
      siteId: data.site.id,
      serviceId: data.workItem.service_id,
      locationId: data.workItem.location_id,
      excludeId: data.workItem.id,
    }),
    getCategoriesWithServices(data.site.id),
    supabase
      .from('service_areas')
      .select('*')
      .eq('site_id', data.site.id)
      .order('sort_order'),
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

  const workItemWithRelations = {
    ...data.workItem,
    service: data.service || null,
    location: data.itemLocation || null,
  };

  return (
    <WorkDetailPage
      site={toPublicSite(data.site)}
      primaryLocation={toPublicLocation(data.primaryLocation)}
      workItem={toPublicWorkItem(workItemWithRelations)}
      service={data.service}
      itemLocation={data.itemLocation}
      relatedItems={relatedItems.map(toPublicWorkItem)}
      serviceAreas={(serviceAreas || []).map(toPublicAreaListing)}
      categories={navCategories}
      siteSlug={slug}
      locationSlug={location}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
    />
  );
}
