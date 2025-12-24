import { notFound } from 'next/navigation';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { LocalServiceProTemplate } from '@/components/templates/local-service-pro';

interface SitePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: SitePageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const { site, primaryLocation } = data;
  const locationText = primaryLocation
    ? `${primaryLocation.city}, ${primaryLocation.state}`
    : '';

  return {
    title: `${site.name}${locationText ? ` | ${locationText}` : ''}`,
    description: `${site.name} - Professional services${locationText ? ` in ${locationText}` : ''}. Contact us today for a free quote.`,
  };
}

export default async function SitePage({ params }: SitePageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    notFound();
  }

  // Route to appropriate template based on template_id
  const { site } = data;

  switch (site.template_id) {
    case 'local-service-pro':
    default:
      return <LocalServiceProTemplate data={data} />;
  }
}
