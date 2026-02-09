import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { AboutPage } from '@/components/templates/local-service-pro/about-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

interface AboutPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const aboutPage = data.sitePages?.find(p => p.page_type === 'about');

  return {
    title: aboutPage?.meta_title || `About ${data.site.name}`,
    description: aboutPage?.meta_description || `Learn more about ${data.site.name} and our commitment to quality service.`,
  };
}

export default async function AboutPageRoute({ params }: AboutPageProps) {
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

  const aboutContent = data.sitePages?.find(p => p.page_type === 'about') || null;

  return (
    <AboutPage
      site={data.site}
      primaryLocation={data.primaryLocation}
      pageContent={aboutContent}
      serviceAreas={data.serviceAreas}
      categories={navCategories}
      siteSlug={slug}
    />
  );
}
