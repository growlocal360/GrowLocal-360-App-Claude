import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getCategoriesWithServices, categorySlugFromName } from '@/lib/sites/get-services';
import { ContactPage } from '@/components/templates/local-service-pro/contact-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface ContactPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const contactPage = data.sitePages?.find(p => p.page_type === 'contact');

  return {
    title: contactPage?.meta_title || `Contact ${data.site.name}`,
    description: contactPage?.meta_description || `Get in touch with ${data.site.name}. Call us or fill out our form for a free estimate.`,
  };
}

export default async function ContactPageRoute({ params }: ContactPageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    notFound();
  }

  const { categories, services } = await getCategoriesWithServices(data.site.id);

  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: categorySlugFromName(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  const contactContent = data.sitePages?.find(p => p.page_type === 'contact') || null;

  return (
    <ContactPage
      site={data.site}
      primaryLocation={data.primaryLocation}
      pageContent={contactContent}
      services={services}
      serviceAreas={data.serviceAreas}
      categories={navCategories}
      siteSlug={slug}
    />
  );
}
