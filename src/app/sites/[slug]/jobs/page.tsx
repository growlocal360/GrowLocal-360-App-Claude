import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { JobsPage } from '@/components/templates/local-service-pro/jobs-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

interface JobsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: JobsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  return {
    title: `Careers at ${data.site.name} | Job Opportunities`,
    description: `Looking for a career in ${data.site.settings?.core_industry?.toLowerCase() || 'professional services'}? Join the ${data.site.name} team.`,
  };
}

export default async function JobsPageRoute({ params }: JobsPageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    notFound();
  }

  const { categories } = await getCategoriesWithServices(data.site.id);

  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: c.gbp_category.name,
    isPrimary: c.is_primary,
  }));

  return (
    <JobsPage
      site={data.site}
      primaryLocation={data.primaryLocation}
      serviceAreas={data.serviceAreas}
      categories={navCategories}
      siteSlug={slug}
    />
  );
}
