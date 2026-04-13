import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getLocationBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublishedWorkItems, getPublishedWorkItemsCount } from '@/lib/sites/get-work-items';
import { WorkHubPage } from '@/components/templates/local-service-pro/work-hub-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import {
  toPublicSite,
  toPublicLocation,
  toPublicWorkItem,
  toPublicAreaListing,
  toPublicCategory,
} from '@/lib/sites/public-render-model';

export const revalidate = 3600;

interface MultiLocationWorkHubProps {
  params: Promise<{ slug: string; location: string }>;
}

export async function generateMetadata({ params }: MultiLocationWorkHubProps): Promise<Metadata> {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  return {
    title: `Recent Work in ${data.location.city}, ${data.location.state} | ${data.site.name}`,
    description: `See examples of recent projects completed by ${data.site.name} in ${data.location.city}, ${data.location.state}.`,
  };
}

export default async function MultiLocationWorkHubRoute({ params }: MultiLocationWorkHubProps) {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    notFound();
  }

  const supabase = createAdminClient();
  const [workItems, total, { categories }, { data: schedulingConfig }] = await Promise.all([
    getPublishedWorkItems(data.site.id),
    getPublishedWorkItemsCount(data.site.id),
    getCategoriesWithServices(data.site.id),
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

  return (
    <WorkHubPage
      site={toPublicSite(data.site)}
      primaryLocation={toPublicLocation(data.location)}
      workItems={workItems.map(toPublicWorkItem)}
      serviceAreas={data.serviceAreas.map(toPublicAreaListing)}
      categories={navCategories}
      siteSlug={slug}
      locationSlug={location}
      siteId={data.site.id}
      hasMore={workItems.length < total}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
    />
  );
}
