import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { withOpenGraph, getSiteOgImage } from '@/lib/sites/og-metadata';
import { ContactPage } from '@/components/templates/local-service-pro/contact-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import { toPublicSite, toPublicLocation, toPublicPageContent, toPublicServiceListing, toPublicAreaListing, toPublicTeamMember, toPublicWorkItem, toPublicCategory } from '@/lib/sites/public-render-model';
import { getTeamMembersForSite } from '@/lib/sites/get-team';
import { getPublishedWorkItems } from '@/lib/sites/get-work-items';
import { createAdminClient } from '@/lib/supabase/admin';

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface ContactPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const contactPage = data.sitePages?.find(p => p.page_type === 'contact');

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = (data.site.custom_domain_verified && data.site.custom_domain) ? data.site.custom_domain : `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/contact`;

  const ogImage = getSiteOgImage(data.site.settings);

  return withOpenGraph({
    title: contactPage?.meta_title || `Contact ${data.site.name}`,
    description: contactPage?.meta_description || `Get in touch with ${data.site.name}. Call us or fill out our form for a free estimate.`,
    alternates: {
      canonical: canonicalUrl,
    },
  }, { url: canonicalUrl, siteName: data.site.name, logoUrl: ogImage });
}

export default async function ContactPageRoute({ params }: ContactPageProps) {
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
      .select('is_active, cta_style, show_availability_badge')
      .eq('site_id', data.site.id)
      .single(),
  ]);

  const navCategories: NavCategory[] = categories.map(c => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  const contactContent = data.sitePages?.find(p => p.page_type === 'contact') || null;

  return (
    <ContactPage
      site={toPublicSite(data.site)}
      primaryLocation={data.primaryLocation ? toPublicLocation(data.primaryLocation) : null}
      pageContent={contactContent ? toPublicPageContent(contactContent) : null}
      services={services.map(toPublicServiceListing)}
      formCategories={categories.map(toPublicCategory)}
      serviceAreas={data.serviceAreas.map(toPublicAreaListing)}
      teamMembers={teamProfiles.map(toPublicTeamMember)}
      categories={navCategories}
      siteSlug={slug}
      recentWorkItems={workItems.map(toPublicWorkItem)}
      schedulingActive={schedulingConfig?.is_active || false}
      ctaStyle={(schedulingConfig?.cta_style as 'booking' | 'estimate') || 'booking'}
    />
  );
}
