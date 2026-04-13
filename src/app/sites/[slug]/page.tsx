import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { LocalServiceProTemplate } from '@/components/templates/local-service-pro';
import { BrandHomepage } from '@/components/templates/local-service-pro/brand-homepage';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import { toPublicRenderData, toPublicSite, toPublicLocation, toPublicServiceListing, toPublicWorkItem, toPublicCategory } from '@/lib/sites/public-render-model';
import { getPublishedWorkItems } from '@/lib/sites/get-work-items';
import { withOpenGraph, getSiteOgImage } from '@/lib/sites/og-metadata';
import { createAdminClient } from '@/lib/supabase/admin';

export const revalidate = 3600;

interface SitePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: SitePageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const { site, primaryLocation, sitePages } = data;
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = site.custom_domain || `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}`;

  // Use generated home page metadata if available
  const homePage = sitePages?.find(p => p.page_type === 'home');

  const ogImage = getSiteOgImage(site.settings);
  const ogOptions = { url: canonicalUrl, siteName: site.name, logoUrl: ogImage };

  if (homePage?.meta_title) {
    return withOpenGraph({
      title: homePage.meta_title,
      description: homePage.meta_description || `${site.name} - Professional services. Contact us today for a free quote.`,
      alternates: { canonical: canonicalUrl },
    }, ogOptions);
  }

  // Fallback: use primary category from DB for better SEO
  const { categories } = await getCategoriesWithServices(site.id);
  const primaryCategory = categories.find(c => c.is_primary) || categories[0];
  const categoryName = primaryCategory?.gbp_category?.display_name;
  const locationText = primaryLocation
    ? `${primaryLocation.city}, ${primaryLocation.state}`
    : '';

  return withOpenGraph({
    title: categoryName && locationText
      ? `${categoryName} in ${locationText} | ${site.name}`
      : `${site.name}${locationText ? ` | ${locationText}` : ''}`,
    description: categoryName
      ? `${site.name} - ${categoryName}${locationText ? ` in ${locationText}` : ''}. Contact us today for a free quote.`
      : `${site.name} - Professional services${locationText ? ` in ${locationText}` : ''}. Contact us today for a free quote.`,
    alternates: { canonical: canonicalUrl },
  }, ogOptions);
}

export default async function SitePage({ params }: SitePageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    notFound();
  }

  const { site } = data;

  // Multi-location sites show a brand homepage with location links
  if (site.website_type === 'multi_location') {
    return (
      <BrandHomepage
        site={toPublicSite(site)}
        locations={data.locations.map(toPublicLocation)}
      />
    );
  }

  // Single-location / microsite: render the full template
  const supabase = createAdminClient();
  const [{ categories, services }, recentWorkItems, { data: schedulingConfig }] = await Promise.all([
    getCategoriesWithServices(data.site.id),
    getPublishedWorkItems(data.site.id, { limit: 3 }),
    supabase
      .from('scheduling_configs')
      .select('is_active, cta_style, show_availability_badge')
      .eq('site_id', data.site.id)
      .single(),
  ]);
  const primaryCategory = categories.find(c => c.is_primary) || categories[0];
  const primaryCategorySlug = primaryCategory ? normalizeCategorySlug(primaryCategory.gbp_category.display_name) : undefined;

  // Show primary-category services + orphaned services (null category) on the home page
  const primaryCategoryServices = primaryCategory
    ? services.filter(s => s.site_category_id === primaryCategory.id || !s.site_category_id)
    : services;

  // Non-primary categories to show as cards on the home page
  const secondaryCategories: NavCategory[] = categories
    .filter(c => !c.is_primary)
    .map(c => ({
      id: c.id,
    name: c.gbp_category.display_name,
      slug: normalizeCategorySlug(c.gbp_category.display_name),
      isPrimary: false,
    }));

  const navCategories: NavCategory[] = categories.map(c => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  switch (site.template_id) {
    case 'local-service-pro':
    default:
      return (
        <LocalServiceProTemplate
          data={toPublicRenderData(data)}
          services={primaryCategoryServices.map(toPublicServiceListing)}
          primaryCategorySlug={primaryCategorySlug}
          primaryCategoryName={primaryCategory?.gbp_category?.display_name}
          categories={navCategories}
          secondaryCategories={secondaryCategories}
          recentWorkItems={recentWorkItems.map(toPublicWorkItem)}
          formCategories={categories.map(toPublicCategory)}
          schedulingActive={schedulingConfig?.is_active || false}
          showAvailabilityBadge={schedulingConfig?.show_availability_badge ?? true}
          ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
        />
      );
  }
}
