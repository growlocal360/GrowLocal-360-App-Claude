import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getLocationBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices, categorySlugFromName } from '@/lib/sites/get-services';
import { JobsPage } from '@/components/templates/local-service-pro/jobs-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

export const revalidate = 3600;

interface MultiLocationJobsPageProps {
  params: Promise<{ slug: string; location: string }>;
}

export async function generateMetadata({ params }: MultiLocationJobsPageProps): Promise<Metadata> {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  return {
    title: `Careers at ${data.site.name} | Job Opportunities`,
    description: `Looking for a career in ${data.site.settings?.core_industry?.toLowerCase() || 'professional services'}? Join the ${data.site.name} team.`,
  };
}

export default async function MultiLocationJobsPageRoute({ params }: MultiLocationJobsPageProps) {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    notFound();
  }

  const { categories } = await getCategoriesWithServices(data.site.id);

  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: categorySlugFromName(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  return (
    <JobsPage
      site={data.site}
      primaryLocation={data.location}
      serviceAreas={data.serviceAreas}
      categories={navCategories}
      siteSlug={slug}
      locationSlug={location}
    />
  );
}
