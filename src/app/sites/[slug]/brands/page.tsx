import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { BrandsListingPage } from '@/components/templates/local-service-pro/brands-listing-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface BrandsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BrandsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const { site, primaryLocation } = data;
  const city = primaryLocation?.city;
  const industry = (site.settings?.core_industry as string) || '';

  return {
    title: `${industry ? `${industry} ` : ''}Brands We Service${city ? ` in ${city}` : ''} | ${site.name}`,
    description: `${site.name} services all major${industry ? ` ${industry.toLowerCase()}` : ''} brands${city ? ` in ${city} and surrounding areas` : ''}. See the full list of brands we work with.`,
  };
}

export default async function BrandsPageRoute({ params }: BrandsPageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    notFound();
  }

  const { categories } = await getCategoriesWithServices(data.site.id);

  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  return (
    <BrandsListingPage
      site={data.site}
      primaryLocation={data.primaryLocation}
      brands={data.brands}
      serviceAreas={data.serviceAreas}
      categories={navCategories}
      siteSlug={slug}
    />
  );
}
