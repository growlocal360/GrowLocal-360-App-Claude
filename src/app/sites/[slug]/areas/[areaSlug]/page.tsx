import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getServiceAreaBySlug, getAllServiceAreaSlugs } from '@/lib/sites/get-service-areas';
import { getGoogleReviewsForSite } from '@/lib/sites/get-reviews';
import { ServiceAreaPage } from '@/components/templates/local-service-pro/service-area-page';
import {
  toPublicSite, toPublicLocation, toPublicAreaDetail, toPublicAreaListing,
  toPublicServiceListing, toPublicCategory, toPublicReview, toPublicWorkItem,
} from '@/lib/sites/public-render-model';
import { getPublishedWorkItems } from '@/lib/sites/get-work-items';

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

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = site.custom_domain || `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/areas/${areaSlug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function ServiceAreaPageRoute({ params }: ServiceAreaPageProps) {
  const { slug, areaSlug } = await params;
  const data = await getServiceAreaBySlug(slug, areaSlug);

  if (!data) {
    notFound();
  }

  const [googleReviews, workItems] = await Promise.all([
    getGoogleReviewsForSite(data.site.id),
    getPublishedWorkItems(data.site.id, { city: data.serviceArea.name, limit: 6 }),
  ]);

  return (
    <ServiceAreaPage
      data={{
        site: toPublicSite(data.site),
        location: toPublicLocation(data.location),
        serviceArea: toPublicAreaDetail(data.serviceArea),
        allServiceAreas: data.allServiceAreas.map(toPublicAreaListing),
        services: data.services.map(toPublicServiceListing),
        categories: data.categories.map(toPublicCategory),
      }}
      siteSlug={slug}
      googleReviews={googleReviews.map(toPublicReview)}
      recentWorkItems={workItems.map(toPublicWorkItem)}
    />
  );
}
