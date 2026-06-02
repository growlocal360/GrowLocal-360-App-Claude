import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getLocationBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTemplate } from '@/lib/templates/registry';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import {
  toPublicSite,
  toPublicLocation,
  toPublicAreaListing,
  toPublicNeighborhoodListing,
  toPublicCategory,
} from '@/lib/sites/public-render-model';
import { siteHasActiveBrands } from '@/lib/sites/has-active-brands';

export const revalidate = 60;

interface MultiLocationAreasPageProps {
  params: Promise<{ slug: string; location: string }>;
}

export async function generateMetadata({ params }: MultiLocationAreasPageProps): Promise<Metadata> {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const { site, location: loc } = data;

  return {
    title: `Areas We Serve in ${loc.city}, ${loc.state} | ${site.name}`,
    description: `${site.name} proudly serves ${loc.city} and surrounding communities. See all the areas we cover and contact us for service.`,
  };
}

export default async function MultiLocationAreasPageRoute({ params }: MultiLocationAreasPageProps) {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    notFound();
  }

  const supabase = createAdminClient();
  const [{ categories }, { data: schedulingConfig }, hasBrands] = await Promise.all([
    getCategoriesWithServices(data.site.id),
    supabase
      .from('scheduling_configs')
      .select('is_active, cta_style')
      .eq('site_id', data.site.id)
      .single(),
    siteHasActiveBrands(data.site.id),
  ]);

  const navCategories: NavCategory[] = categories.map(c => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  const TemplateComp = getTemplate(data.site.template_id).AreasListing;
  return (
    <TemplateComp
      site={toPublicSite(data.site, { hasBrands })}
      primaryLocation={toPublicLocation(data.location)}
      serviceAreas={data.serviceAreas.map(toPublicAreaListing)}
      neighborhoods={data.neighborhoods.map(toPublicNeighborhoodListing)}
      categories={navCategories}
      siteSlug={slug}
      locationSlug={location}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
    />
  );
}
