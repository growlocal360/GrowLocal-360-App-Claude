import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getLocationBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { JobSnapsPage } from '@/components/templates/local-service-pro/job-snaps-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import {
  toPublicSite,
  toPublicLocation,
  toPublicAreaListing,
} from '@/lib/sites/public-render-model';

export const revalidate = 3600;

interface MultiLocationJobSnapsPageProps {
  params: Promise<{ slug: string; location: string }>;
}

export async function generateMetadata({ params }: MultiLocationJobSnapsPageProps): Promise<Metadata> {
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

export default async function MultiLocationJobSnapsPageRoute({ params }: MultiLocationJobSnapsPageProps) {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    notFound();
  }

  const { categories } = await getCategoriesWithServices(data.site.id);

  const navCategories: NavCategory[] = categories.map(c => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  return (
    <JobSnapsPage
      site={toPublicSite(data.site)}
      primaryLocation={toPublicLocation(data.location)}
      serviceAreas={data.serviceAreas.map(toPublicAreaListing)}
      categories={navCategories}
      siteSlug={slug}
      locationSlug={location}
    />
  );
}
