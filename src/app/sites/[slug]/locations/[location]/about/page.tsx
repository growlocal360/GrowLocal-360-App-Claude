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
  toPublicPageContent,
  toPublicCategory,
} from '@/lib/sites/public-render-model';
import { siteHasActiveBrands } from '@/lib/sites/has-active-brands';

export const revalidate = 60;

interface MultiLocationAboutPageProps {
  params: Promise<{ slug: string; location: string }>;
}

export async function generateMetadata({ params }: MultiLocationAboutPageProps): Promise<Metadata> {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  // Fetch about page content
  const supabase = createAdminClient();
  const { data: aboutPage } = await supabase
    .from('site_pages')
    .select('meta_title, meta_description')
    .eq('site_id', data.site.id)
    .eq('page_type', 'about')
    .single();

  return {
    title: aboutPage?.meta_title || `About ${data.site.name}`,
    description: aboutPage?.meta_description || `Learn more about ${data.site.name} and our commitment to quality service.`,
  };
}

export default async function MultiLocationAboutPageRoute({ params }: MultiLocationAboutPageProps) {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    notFound();
  }

  const supabase = createAdminClient();
  const [{ categories }, { data: aboutContent }, { data: schedulingConfig }, hasBrands] = await Promise.all([
    getCategoriesWithServices(data.site.id),
    supabase
      .from('site_pages')
      .select('*')
      .eq('site_id', data.site.id)
      .eq('page_type', 'about')
      .single(),
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

  const TemplateComp = getTemplate(data.site.template_id).About;
  return (
    <TemplateComp
      site={toPublicSite(data.site, { hasBrands })}
      primaryLocation={toPublicLocation(data.location)}
      pageContent={aboutContent ? toPublicPageContent(aboutContent) : null}
      serviceAreas={data.serviceAreas.map(toPublicAreaListing)}
      categories={navCategories}
      siteSlug={slug}
      locationSlug={location}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
    />
  );
}
