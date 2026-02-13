import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices, categorySlugFromName } from '@/lib/sites/get-services';
import { ServiceAreasListingPage } from '@/components/templates/local-service-pro/service-areas-listing-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface AreasPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: AreasPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const { site, primaryLocation } = data;
  const city = primaryLocation?.city;

  return {
    title: `Areas We Serve${city ? ` in ${city}` : ''} | ${site.name}`,
    description: `${site.name} proudly serves${city ? ` ${city} and` : ''} surrounding communities. See all the areas we cover and contact us for service.`,
  };
}

export default async function AreasPageRoute({ params }: AreasPageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

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
      primaryLocation={data.primaryLocation}
      serviceAreas={data.serviceAreas}
      neighborhoods={data.neighborhoods}
      categories={navCategories}
      siteSlug={slug}
    />
  );
}
