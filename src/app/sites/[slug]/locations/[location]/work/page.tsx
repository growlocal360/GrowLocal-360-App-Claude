import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getLocationBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices, categorySlugFromName } from '@/lib/sites/get-services';
import { getPublishedWorkItems } from '@/lib/sites/get-work-items';
import { WorkHubPage } from '@/components/templates/local-service-pro/work-hub-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

export const revalidate = 3600;

interface MultiLocationWorkHubProps {
  params: Promise<{ slug: string; location: string }>;
}

export async function generateMetadata({ params }: MultiLocationWorkHubProps): Promise<Metadata> {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  return {
    title: `Recent Work in ${data.location.city}, ${data.location.state} | ${data.site.name}`,
    description: `See examples of recent projects completed by ${data.site.name} in ${data.location.city}, ${data.location.state}.`,
  };
}

export default async function MultiLocationWorkHubRoute({ params }: MultiLocationWorkHubProps) {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

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
      primaryLocation={data.location}
      workItems={workItems}
      serviceAreas={data.serviceAreas}
      categories={navCategories}
      siteSlug={slug}
      locationSlug={location}
    />
  );
}
