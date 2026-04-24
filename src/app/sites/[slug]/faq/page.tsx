import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { getFAQHubData } from '@/lib/sites/get-faq-hub';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { FAQHubPage } from '@/components/templates/local-service-pro/faq-hub-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import { toPublicSite, toPublicLocation, toPublicPageContent, toPublicAreaListing, toPublicCategory } from '@/lib/sites/public-render-model';
import { createAdminClient } from '@/lib/supabase/admin';

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface FAQPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: FAQPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const faqPage = data.sitePages?.find(p => p.page_type === 'faq');
  const city = data.primaryLocation?.city || '';

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = (data.site.custom_domain_verified && data.site.custom_domain) ? data.site.custom_domain : `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/faq`;

  return {
    title: faqPage?.meta_title || `FAQ | ${data.site.name}${city ? ` — ${city}` : ''}`,
    description: faqPage?.meta_description || `Find answers to frequently asked questions about ${data.site.name}'s services${city ? ` in ${city}` : ''}.`,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large' as const,
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  };
}

export default async function FAQPageRoute({ params }: FAQPageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    notFound();
  }

  const supabase = createAdminClient();
  const [{ categories }, faqHub, { data: schedulingConfig }] = await Promise.all([
    getCategoriesWithServices(data.site.id),
    getFAQHubData(data.site.id),
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

  const faqContent = data.sitePages?.find(p => p.page_type === 'faq') || null;

  return (
    <FAQHubPage
      site={toPublicSite(data.site)}
      primaryLocation={data.primaryLocation ? toPublicLocation(data.primaryLocation) : null}
      pageContent={faqContent ? toPublicPageContent(faqContent) : null}
      faqItems={faqHub.items}
      topicGroups={faqHub.topicGroups}
      serviceAreas={data.serviceAreas.map(toPublicAreaListing)}
      categories={navCategories}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
      siteSlug={slug}
    />
  );
}
