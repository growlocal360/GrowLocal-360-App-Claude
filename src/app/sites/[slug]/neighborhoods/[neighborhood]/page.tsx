import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getNeighborhoodBySlugSingleLocation } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { getTemplate } from '@/lib/templates/registry';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import { toPublicSite, toPublicLocation, toPublicNeighborhoodDetail, toPublicNeighborhoodListing, toPublicWorkItem, toPublicCategory } from '@/lib/sites/public-render-model';
import { getWorkItemsForPlace } from '@/lib/sites/get-work-items';
import { siteHasActiveBrands } from '@/lib/sites/has-active-brands';
import { createAdminClient } from '@/lib/supabase/admin';

export const revalidate = 60;

interface NeighborhoodPageProps {
  params: Promise<{
    slug: string;
    neighborhood: string;
  }>;
}

export async function generateMetadata({ params }: NeighborhoodPageProps): Promise<Metadata> {
  const { slug, neighborhood: neighborhoodSlug } = await params;
  const data = await getNeighborhoodBySlugSingleLocation(slug, neighborhoodSlug);

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

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = (site.custom_domain_verified && site.custom_domain) ? site.custom_domain : `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/neighborhoods/${neighborhoodSlug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function NeighborhoodRoute({ params }: NeighborhoodPageProps) {
  const { slug, neighborhood } = await params;
  const data = await getNeighborhoodBySlugSingleLocation(slug, neighborhood);

  if (!data) {
    notFound();
  }

  const admin = createAdminClient();
  const [{ categories }, workItems, hasBrands, { data: schedulingConfig }] = await Promise.all([
    getCategoriesWithServices(data.site.id),
    // Jobs tagged with this neighborhood lead; jobs elsewhere in the city fill in.
    getWorkItemsForPlace(data.site.id, { neighborhood: data.neighborhood.name, city: data.location.city, limit: 6 }).then((r) => r.items),
    siteHasActiveBrands(data.site.id),
    admin
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

  const TemplateComp = getTemplate(data.site.template_id).NeighborhoodSingle;
  return (
    <TemplateComp
      data={{
        site: toPublicSite(data.site, { hasBrands }),
        location: toPublicLocation(data.location),
        neighborhood: toPublicNeighborhoodDetail(data.neighborhood),
        allNeighborhoods: data.allNeighborhoods.map(toPublicNeighborhoodListing),
      }}
      siteSlug={slug}
      categories={navCategories}
      recentWorkItems={workItems.map(toPublicWorkItem)}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
    />
  );
}
