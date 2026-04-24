import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { getPublishedWorkItems } from '@/lib/sites/get-work-items';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { withOpenGraph, getSiteOgImage } from '@/lib/sites/og-metadata';
import { AboutPage } from '@/components/templates/local-service-pro/about-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import { toPublicSite, toPublicLocation, toPublicPageContent, toPublicAreaListing, toPublicTeamMember, toPublicServiceListing, toPublicWorkItem, toPublicReview, toPublicCategory } from '@/lib/sites/public-render-model';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTeamMembersForSite } from '@/lib/sites/get-team';

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface AboutPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const aboutPage = data.sitePages?.find(p => p.page_type === 'about');

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = (data.site.custom_domain_verified && data.site.custom_domain) ? data.site.custom_domain : `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/about`;

  const ogImage = getSiteOgImage(data.site.settings);

  return withOpenGraph({
    title: aboutPage?.meta_title || `About ${data.site.name}`,
    description: aboutPage?.meta_description || `Learn more about ${data.site.name} and our commitment to quality service.`,
    alternates: {
      canonical: canonicalUrl,
    },
  }, { url: canonicalUrl, siteName: data.site.name, logoUrl: ogImage });
}

export default async function AboutPageRoute({ params }: AboutPageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    notFound();
  }

  const supabase = createAdminClient();
  const [{ categories, services }, teamProfiles, workItems, { data: schedulingConfig }] = await Promise.all([
    getCategoriesWithServices(data.site.id),
    getTeamMembersForSite(data.site.id, data.site.organization_id),
    getPublishedWorkItems(data.site.id, { limit: 3 }),
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

  const aboutContent = data.sitePages?.find(p => p.page_type === 'about') || null;
  const teamMembers = teamProfiles.map(toPublicTeamMember);
  const reviews = (data.googleReviews || []).map(toPublicReview);

  return (
    <AboutPage
      site={toPublicSite(data.site)}
      primaryLocation={data.primaryLocation ? toPublicLocation(data.primaryLocation) : null}
      pageContent={aboutContent ? toPublicPageContent(aboutContent) : null}
      serviceAreas={data.serviceAreas.map(toPublicAreaListing)}
      teamMembers={teamMembers}
      categories={navCategories}
      services={services.map(toPublicServiceListing)}
      workItems={workItems.map(toPublicWorkItem)}
      reviews={reviews}
      formCategories={categories.map(toPublicCategory)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
      siteSlug={slug}
    />
  );
}
