import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { getStoredSitePlan, cityTreatmentByName, isV6Plan } from '@/lib/sites/site-plan-store';
import { getTemplate } from '@/lib/templates/registry';
import * as paths from '@/lib/routing/paths';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import {
  toPublicSite,
  toPublicLocation,
  toPublicAreaListing,
  toPublicNeighborhoodListing,
  toPublicCategory,
} from '@/lib/sites/public-render-model';

// v6: the locations hub. Lists every served town — linked to its town page
// (/service-areas/{city}/) when the Site Plan gave it one, plain text otherwise.
// See docs/architecture/growlocal360_master_prompt_v6.md.

export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface ServiceAreasPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ServiceAreasPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);
  if (!data) return { title: 'Site Not Found' };

  const { site, primaryLocation } = data;
  const city = primaryLocation?.city;
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'growlocal360.com';
  const domain = (site.custom_domain_verified && site.custom_domain) ? site.custom_domain : `${slug}.${appDomain}`;

  return {
    title: `Service Areas${city ? ` in ${city}` : ''} | ${site.name}`,
    description: `${site.name} serves${city ? ` ${city} and` : ''} surrounding communities. See every area we cover and contact us for service.`,
    alternates: { canonical: `https://${domain}/service-areas` },
  };
}

export default async function ServiceAreasPageRoute({ params }: ServiceAreasPageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);
  if (!data) notFound();

  const supabase = createAdminClient();
  const [{ categories }, { data: schedulingConfig }, sitePlan] = await Promise.all([
    getCategoriesWithServices(data.site.id),
    supabase
      .from('scheduling_configs')
      .select('is_active, cta_style')
      .eq('site_id', data.site.id)
      .single(),
    getStoredSitePlan(data.site.id),
  ]);

  const navCategories: NavCategory[] = categories.map((c) => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  // v6: a town links to its town page when the Site Plan gave it one; otherwise
  // it's a text-only mention. A site without a v6 plan yet (not regenerated since
  // v6) links every town — the town route renders permissively for it too.
  const treatment = isV6Plan(sitePlan) && sitePlan ? cityTreatmentByName(sitePlan) : null;
  const serviceAreas = data.serviceAreas.map((area) => {
    const base = toPublicAreaListing(area);
    if (!treatment) return { ...base, pageUrl: paths.townPage(area.slug) };
    const c = treatment.get(area.name.trim().toLowerCase());
    return { ...base, pageUrl: c?.has_page && c.page_url && c.page_url !== '/' ? c.page_url.replace(/\/$/, '') : null };
  });

  const TemplateComp = getTemplate(data.site.template_id).AreasListing;
  return (
    <TemplateComp
      site={toPublicSite(data.site, { hasBrands: (data.brands || []).length > 0 })}
      primaryLocation={data.primaryLocation ? toPublicLocation(data.primaryLocation) : null}
      serviceAreas={serviceAreas}
      neighborhoods={data.neighborhoods.map(toPublicNeighborhoodListing)}
      categories={navCategories}
      siteSlug={slug}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
    />
  );
}
