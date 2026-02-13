import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getLocationBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices, categorySlugFromName } from '@/lib/sites/get-services';
import { ServiceAreasListingPage } from '@/components/templates/local-service-pro/service-areas-listing-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

export const revalidate = 3600;

interface MultiLocationAreasPageProps {
  params: Promise<{ slug: string; location: string }>;
}

export async function generateMetadata({ params }: MultiLocationAreasPageProps): Promise<Metadata> {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const { site, location: loc } = data;

  return {
    title: `Areas We Serve in ${loc.city}, ${loc.state} | ${site.name}`,
    description: `${site.name} proudly serves ${loc.city} and surrounding communities. See all the areas we cover and contact us for service.`,
  };
}

export default async function MultiLocationAreasPageRoute({ params }: MultiLocationAreasPageProps) {
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
    <ServiceAreasListingPage
      site={data.site}
      primaryLocation={data.location}
      serviceAreas={data.serviceAreas}
      neighborhoods={data.neighborhoods}
      categories={navCategories}
      siteSlug={slug}
      locationSlug={location}
    />
  );
}
