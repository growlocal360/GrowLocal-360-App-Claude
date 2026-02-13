import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getLocationBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices, categorySlugFromName } from '@/lib/sites/get-services';
import { createAdminClient } from '@/lib/supabase/admin';
import { AboutPage } from '@/components/templates/local-service-pro/about-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

export const revalidate = 3600;

interface MultiLocationAboutPageProps {
  params: Promise<{ slug: string; location: string }>;
}

export async function generateMetadata({ params }: MultiLocationAboutPageProps): Promise<Metadata> {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  // Fetch about page content
  const supabase = createAdminClient();
  const { data: aboutPage } = await supabase
    .from('site_pages')
    .select('meta_title, meta_description')
    .eq('site_id', data.site.id)
    .eq('page_type', 'about')
    .single();

  return {
    title: aboutPage?.meta_title || `About ${data.site.name}`,
    description: aboutPage?.meta_description || `Learn more about ${data.site.name} and our commitment to quality service.`,
  };
}

export default async function MultiLocationAboutPageRoute({ params }: MultiLocationAboutPageProps) {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    notFound();
  }

  const [{ categories }, { data: aboutContent }] = await Promise.all([
    getCategoriesWithServices(data.site.id),
    createAdminClient()
      .from('site_pages')
      .select('*')
      .eq('site_id', data.site.id)
      .eq('page_type', 'about')
      .single(),
  ]);

  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: categorySlugFromName(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  return (
    <AboutPage
      site={data.site}
      primaryLocation={data.location}
      pageContent={aboutContent}
      serviceAreas={data.serviceAreas}
      categories={navCategories}
      siteSlug={slug}
      locationSlug={location}
    />
  );
}
