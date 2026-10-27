import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { withOpenGraph, getSiteOgImage } from '@/lib/sites/og-metadata';
import { getTemplate } from '@/lib/templates/registry';
import { bookPageCopy } from '@/lib/sites/book-page-copy';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import { toPublicSite, toPublicLocation, toPublicAreaListing, toPublicCategory } from '@/lib/sites/public-render-model';
import { createAdminClient } from '@/lib/supabase/admin';

export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface BookRouteProps {
  params: Promise<{ slug: string }>;
}

async function loadBookPage(slug: string) {
  const data = await getSiteBySlug(slug);
  if (!data) return null;
  const supabase = createAdminClient();
  const [{ categories }, { data: schedulingConfig }] = await Promise.all([
    getCategoriesWithServices(data.site.id),
    supabase
      .from('scheduling_configs')
      .select('is_active, cta_style, show_availability_badge')
      .eq('site_id', data.site.id)
      .maybeSingle(),
  ]);
  const primary = categories.find((c) => c.is_primary) || categories[0];
  const serviceName =
    (data.site.settings as { core_industry?: string } | null)?.core_industry ||
    primary?.gbp_category?.display_name ||
    'Service';
  const site = toPublicSite(data.site, { hasBrands: (data.brands || []).length > 0 });
  const primaryLocation = data.primaryLocation ? toPublicLocation(data.primaryLocation) : null;
  const ctaStyle = (schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking';
  return { data, categories, schedulingConfig, serviceName, site, primaryLocation, ctaStyle };
}

export async function generateMetadata({ params }: BookRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadBookPage(slug);
  if (!loaded) return { title: 'Site Not Found' };
  const { data, site, primaryLocation, ctaStyle, serviceName } = loaded;
  const copy = bookPageCopy({ site, primaryLocation, ctaStyle, serviceName });
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'growlocal360.com';
  const domain = data.site.custom_domain_verified && data.site.custom_domain ? data.site.custom_domain : `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/book`;
  return withOpenGraph(
    { title: copy.metaTitle, description: copy.metaDescription, alternates: { canonical: canonicalUrl } },
    { url: canonicalUrl, siteName: data.site.name, logoUrl: getSiteOgImage(data.site.settings) }
  );
}

export default async function BookRoute({ params }: BookRouteProps) {
  const { slug } = await params;
  const loaded = await loadBookPage(slug);
  if (!loaded) notFound();
  const { data, categories, schedulingConfig, serviceName, site, primaryLocation, ctaStyle } = loaded;

  const navCategories: NavCategory[] = categories.map((c) => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  const Book = getTemplate(data.site.template_id).Book;
  return (
    <Book
      site={site}
      primaryLocation={primaryLocation}
      serviceAreas={data.serviceAreas.map(toPublicAreaListing)}
      categories={navCategories}
      formCategories={categories.map(toPublicCategory)}
      siteSlug={slug}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={ctaStyle}
      showAvailabilityBadge={schedulingConfig?.show_availability_badge ?? true}
      serviceName={serviceName}
    />
  );
}
