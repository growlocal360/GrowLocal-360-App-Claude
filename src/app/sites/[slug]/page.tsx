import { notFound } from 'next/navigation';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { LocalServiceProTemplate } from '@/components/templates/local-service-pro';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

interface SitePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: SitePageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const { site, primaryLocation, sitePages } = data;

  // Use generated home page metadata if available
  const homePage = sitePages?.find(p => p.page_type === 'home');

  if (homePage?.meta_title) {
    return {
      title: homePage.meta_title,
      description: homePage.meta_description || `${site.name} - Professional services. Contact us today for a free quote.`,
    };
  }

  const locationText = primaryLocation
    ? `${primaryLocation.city}, ${primaryLocation.state}`
    : '';

  return {
    title: `${site.name}${locationText ? ` | ${locationText}` : ''}`,
    description: `${site.name} - Professional services${locationText ? ` in ${locationText}` : ''}. Contact us today for a free quote.`,
  };
}

export default async function SitePage({ params }: SitePageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    notFound();
  }

  // Fetch services for the template
  const { categories, services } = await getCategoriesWithServices(data.site.id);
  const primaryCategory = categories.find(c => c.is_primary) || categories[0];
  const primaryCategorySlug = primaryCategory?.gbp_category?.name;

  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: c.gbp_category.name,
    isPrimary: c.is_primary,
  }));

  // Route to appropriate template based on template_id
  const { site } = data;

  switch (site.template_id) {
    case 'local-service-pro':
    default:
      return (
        <LocalServiceProTemplate
          data={data}
          services={services}
          primaryCategorySlug={primaryCategorySlug}
          categories={navCategories}
        />
      );
  }
}
