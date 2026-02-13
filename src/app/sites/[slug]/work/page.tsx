import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices, categorySlugFromName } from '@/lib/sites/get-services';
import { getPublishedWorkItems } from '@/lib/sites/get-work-items';
import { WorkHubPage } from '@/components/templates/local-service-pro/work-hub-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

export const revalidate = 3600;

interface WorkHubProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: WorkHubProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  return {
    title: `Recent Work | ${data.site.name}`,
    description: `See examples of recent projects completed by ${data.site.name}. Browse our work and request a free estimate.`,
  };
}

export default async function WorkHubRoute({ params }: WorkHubProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    notFound();
  }

  const [workItems, { categories }] = await Promise.all([
    getPublishedWorkItems(data.site.id),
    getCategoriesWithServices(data.site.id),
  ]);

  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: categorySlugFromName(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  return (
    <WorkHubPage
      site={data.site}
      primaryLocation={data.primaryLocation}
      workItems={workItems}
      serviceAreas={data.serviceAreas}
      categories={navCategories}
      siteSlug={slug}
    />
  );
}
