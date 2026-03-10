import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { getFAQHubData } from '@/lib/sites/get-faq-hub';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { FAQHubPage } from '@/components/templates/local-service-pro/faq-hub-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

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

  return {
    title: faqPage?.meta_title || `FAQ | ${data.site.name}${city ? ` — ${city}` : ''}`,
    description: faqPage?.meta_description || `Find answers to frequently asked questions about ${data.site.name}'s services${city ? ` in ${city}` : ''}.`,
  };
}

export default async function FAQPageRoute({ params }: FAQPageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    notFound();
  }

  const [{ categories }, faqHub] = await Promise.all([
    getCategoriesWithServices(data.site.id),
    getFAQHubData(data.site.id),
  ]);

  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  const faqContent = data.sitePages?.find(p => p.page_type === 'faq') || null;

  return (
    <FAQHubPage
      site={data.site}
      primaryLocation={data.primaryLocation}
      pageContent={faqContent}
      faqItems={faqHub.items}
      topicGroups={faqHub.topicGroups}
      serviceAreas={data.serviceAreas}
      categories={navCategories}
      siteSlug={slug}
    />
  );
}
