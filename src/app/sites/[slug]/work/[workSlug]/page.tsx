import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getWorkItemBySlug, getRelatedWorkItems, getAllPublishedWorkSlugs } from '@/lib/sites/get-work-items';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { WorkDetailPage } from '@/components/templates/local-service-pro/work-detail-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import { createAdminClient } from '@/lib/supabase/admin';
import { toPublicSite, toPublicLocation, toPublicWorkItem, toPublicAreaListing, toPublicCategory } from '@/lib/sites/public-render-model';
import { toPublicJobOutput } from '@/lib/job-snaps/public-transform';
import { withOpenGraph, getSiteOgImage } from '@/lib/sites/og-metadata';

export const revalidate = 3600;

interface WorkDetailProps {
  params: Promise<{ slug: string; workSlug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllPublishedWorkSlugs();
  return slugs.map(({ siteSlug, workSlug }) => ({
    slug: siteSlug,
    workSlug,
  }));
}

export async function generateMetadata({ params }: WorkDetailProps): Promise<Metadata> {
  const { slug, workSlug } = await params;
  const data = await getWorkItemBySlug(slug, workSlug);

  if (!data) {
    return { title: 'Work Not Found' };
  }

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = data.site.custom_domain || `${slug}.${appDomain}`;

  const output = toPublicJobOutput(data.workItem, { siteName: data.site.name, domain });
  const ogImage = getSiteOgImage(data.site.settings, output.featuredImage?.url);

  return withOpenGraph({
    title: output.metaTitle,
    description: output.metaDescription,
    alternates: { canonical: output.canonicalUrl },
  }, { url: output.canonicalUrl, siteName: data.site.name, imageUrl: output.featuredImage?.url, logoUrl: ogImage });
}

export default async function WorkDetailRoute({ params }: WorkDetailProps) {
  const { slug, workSlug } = await params;
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

  return (
    <WorkDetailPage
      site={toPublicSite(data.site)}
      primaryLocation={toPublicLocation(data.primaryLocation)}
      workItem={toPublicWorkItem(data.workItem)}
      service={data.service}
      itemLocation={data.itemLocation}
      relatedItems={relatedItems.map(toPublicWorkItem)}
      serviceAreas={(serviceAreas || []).map(toPublicAreaListing)}
      categories={navCategories}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
      siteSlug={slug}
    />
  );
}
