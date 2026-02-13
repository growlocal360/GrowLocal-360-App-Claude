import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServiceAreaBySlug, getAllServiceAreaSlugs } from '@/lib/sites/get-service-areas';
import { getGoogleReviewsForSite } from '@/lib/sites/get-reviews';
import { ServiceAreaPage } from '@/components/templates/local-service-pro/service-area-page';

export const revalidate = 3600;

interface ServiceAreaPageProps {
  params: Promise<{ slug: string; areaSlug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllServiceAreaSlugs();
  return slugs.map(({ siteSlug, areaSlug }) => ({
    slug: siteSlug,
    areaSlug,
  }));
}

export async function generateMetadata({ params }: ServiceAreaPageProps): Promise<Metadata> {
  const { slug, areaSlug } = await params;
  const data = await getServiceAreaBySlug(slug, areaSlug);

  if (!data) {
    return { title: 'Service Area Not Found' };
  }

  const { site, serviceArea, location } = data;

  // Use generated SEO content if available
  const title = serviceArea.meta_title ||
    `${site.name} in ${serviceArea.name}, ${serviceArea.state || location.state}`;
  const description = serviceArea.meta_description ||
    `${site.name} proudly serves ${serviceArea.name}. Contact us for professional services in your area.`;

  return {
    title,
    description,
  };
}

export default async function ServiceAreaPageRoute({ params }: ServiceAreaPageProps) {
  const { slug, areaSlug } = await params;
  const data = await getServiceAreaBySlug(slug, areaSlug);

  if (!data) {
    notFound();
  }

  const admin = createAdminClient();
  const [googleReviews, { data: neighborhoods }] = await Promise.all([
    getGoogleReviewsForSite(data.site.id),
    admin.from('neighborhoods').select('*').eq('site_id', data.site.id).eq('is_active', true).order('sort_order'),
  ]);

  return (
    <ServiceAreaPage
      data={data}
      siteSlug={slug}
      googleReviews={googleReviews}
      neighborhoods={neighborhoods || []}
    />
  );
}
