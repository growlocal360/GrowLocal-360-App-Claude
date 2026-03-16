import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { ContactPage } from '@/components/templates/local-service-pro/contact-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import { toPublicSite, toPublicLocation, toPublicPageContent, toPublicServiceListing, toPublicAreaListing, toPublicTeamMember } from '@/lib/sites/public-render-model';
import { getTeamMembersForSite } from '@/lib/sites/get-team';

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
  const domain = data.site.custom_domain || `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/contact`;

  return {
    title: contactPage?.meta_title || `Contact ${data.site.name}`,
    description: contactPage?.meta_description || `Get in touch with ${data.site.name}. Call us or fill out our form for a free estimate.`,
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function ContactPageRoute({ params }: ContactPageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    notFound();
  }

  const { categories, services } = await getCategoriesWithServices(data.site.id);

  const navCategories: NavCategory[] = categories.map(c => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  const contactContent = data.sitePages?.find(p => p.page_type === 'contact') || null;

  const teamProfiles = await getTeamMembersForSite(data.site.id, data.site.organization_id);
  const teamMembers = teamProfiles.map(toPublicTeamMember);

  return (
    <ContactPage
      site={toPublicSite(data.site)}
      primaryLocation={data.primaryLocation ? toPublicLocation(data.primaryLocation) : null}
      pageContent={contactContent ? toPublicPageContent(contactContent) : null}
      services={services.map(toPublicServiceListing)}
      serviceAreas={data.serviceAreas.map(toPublicAreaListing)}
      teamMembers={teamMembers}
      categories={navCategories}
      siteSlug={slug}
    />
  );
}
