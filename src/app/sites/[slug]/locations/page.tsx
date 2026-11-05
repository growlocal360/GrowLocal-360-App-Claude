import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSiteBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { getStoredSitePlan, cityTreatmentByName, isV6Plan } from '@/lib/sites/site-plan-store';
import { getTemplate } from '@/lib/templates/registry';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import { toPublicSite, toPublicLocation, toPublicAreaListing, toPublicCategory } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';

/**
 * v6.1 LOCATIONS HUB — /locations/
 * Every page that has its own Google Business Profile: the branches / listings
 * beyond the first one. Towns without a GBP are on /service-areas/ instead.
 * Rendered with the areas-listing template in "locations" mode.
 */

export const revalidate = 60;

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);
  if (!data) return { title: 'Site Not Found' };
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'growlocal360.com';
  const domain = (data.site.custom_domain_verified && data.site.custom_domain) ? data.site.custom_domain : `${slug}.${appDomain}`;
  return {
    title: `Locations | ${data.site.name}`,
    description: `${data.site.name} locations. Find the branch nearest you, see the services it offers and contact it directly.`,
    alternates: { canonical: `https://${domain}/locations` },
  };
}

export default async function LocationsHubRoute({ params }: Props) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);
  if (!data) notFound();

  const supabase = createAdminClient();
  const [{ categories }, { data: schedulingConfig }, sitePlan] = await Promise.all([
    getCategoriesWithServices(data.site.id),
    supabase.from('scheduling_configs').select('is_active, cta_style').eq('site_id', data.site.id).single(),
    getStoredSitePlan(data.site.id),
  ]);

  // Only towns the plan PROMOTED (own GBP). Sites without a v6 plan fall back to is_anchor.
  const treatment = isV6Plan(sitePlan) && sitePlan ? cityTreatmentByName(sitePlan) : null;
  const locations = data.serviceAreas
    .filter((a) => treatment ? treatment.get(a.name.trim().toLowerCase())?.treatment === 'promoted' : !!a.is_anchor)
    .map((a) => ({ ...toPublicAreaListing(a), pageUrl: paths.locationPage(a.slug) }));
  if (locations.length === 0) notFound();

  const navCategories: NavCategory[] = categories.map((c) => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  const TemplateComp = getTemplate(data.site.template_id).AreasListing;
  return (
    <TemplateComp
      mode="locations"
      site={toPublicSite(data.site, { hasBrands: (data.brands || []).length > 0 })}
      primaryLocation={data.primaryLocation ? toPublicLocation(data.primaryLocation) : null}
      serviceAreas={locations}
      neighborhoods={[]}
      categories={navCategories}
      siteSlug={slug}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
    />
  );
}
