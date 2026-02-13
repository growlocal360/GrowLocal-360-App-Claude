import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getLocationBySlug } from '@/lib/sites/get-site';
import { getCategoriesWithServices, categorySlugFromName } from '@/lib/sites/get-services';
import { createAdminClient } from '@/lib/supabase/admin';
import { ContactPage } from '@/components/templates/local-service-pro/contact-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

export const revalidate = 3600;

interface MultiLocationContactPageProps {
  params: Promise<{ slug: string; location: string }>;
}

export async function generateMetadata({ params }: MultiLocationContactPageProps): Promise<Metadata> {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const supabase = createAdminClient();
  const { data: contactPage } = await supabase
    .from('site_pages')
    .select('meta_title, meta_description')
    .eq('site_id', data.site.id)
    .eq('page_type', 'contact')
    .single();

  return {
    title: contactPage?.meta_title || `Contact ${data.site.name}`,
    description: contactPage?.meta_description || `Get in touch with ${data.site.name}. Call us or fill out our form for a free estimate.`,
  };
}

export default async function MultiLocationContactPageRoute({ params }: MultiLocationContactPageProps) {
  const { slug, location } = await params;
  const data = await getLocationBySlug(slug, location);

  if (!data) {
    notFound();
  }

  const [{ categories, services }, { data: contactContent }] = await Promise.all([
    getCategoriesWithServices(data.site.id),
    createAdminClient()
      .from('site_pages')
      .select('*')
      .eq('site_id', data.site.id)
      .eq('page_type', 'contact')
      .single(),
  ]);

  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: categorySlugFromName(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  return (
    <ContactPage
      site={data.site}
      primaryLocation={data.location}
      pageContent={contactContent}
      services={services}
      serviceAreas={data.serviceAreas}
      categories={navCategories}
      siteSlug={slug}
      locationSlug={location}
    />
  );
}
