import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug, getAllSiteSlugs } from '@/lib/sites/get-site';
import { getAllGoogleReviewsForSite } from '@/lib/sites/get-reviews';
import { getCategoriesWithServices } from '@/lib/sites/get-services';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { withOpenGraph, getSiteOgImage } from '@/lib/sites/og-metadata';
import { ReviewsPage } from '@/components/templates/local-service-pro/reviews-page';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import { toPublicSite, toPublicLocation, toPublicReview, toPublicAreaListing } from '@/lib/sites/public-render-model';

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

interface ReviewsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ReviewsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    return { title: 'Site Not Found' };
  }

  const { site, primaryLocation } = data;
  const city = primaryLocation?.city || '';
  const averageRating = site.settings?.google_average_rating as number | undefined;
  const totalReviews = site.settings?.google_total_reviews as number | undefined;

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'goleadflow.com';
  const domain = site.custom_domain || `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/reviews`;

  const ratingText = averageRating ? ` Rated ${averageRating.toFixed(1)}/5` : '';
  const countText = totalReviews ? ` from ${totalReviews} reviews` : '';

  const title = `Customer Reviews | ${site.name}${city ? ` — ${city}` : ''}`;
  const description = `Read customer reviews for ${site.name}${city ? ` in ${city}` : ''}.${ratingText}${countText}. See what our customers say about our service.`;
  const ogImage = getSiteOgImage(site.settings);

  return withOpenGraph({
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
  }, { url: canonicalUrl, siteName: site.name, logoUrl: ogImage });
}

export default async function ReviewsPageRoute({ params }: ReviewsPageProps) {
  const { slug } = await params;
  const data = await getSiteBySlug(slug);

  if (!data) {
    notFound();
  }

  const [allReviews, { categories }] = await Promise.all([
    getAllGoogleReviewsForSite(data.site.id),
    getCategoriesWithServices(data.site.id),
  ]);

  const navCategories: NavCategory[] = categories.map(c => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  const averageRating = data.site.settings?.google_average_rating as number | null;
  const totalReviewCount = data.site.settings?.google_total_reviews as number | null;

  return (
    <ReviewsPage
      site={toPublicSite(data.site)}
      primaryLocation={data.primaryLocation ? toPublicLocation(data.primaryLocation) : null}
      reviews={allReviews.map(toPublicReview)}
      averageRating={averageRating}
      totalReviewCount={totalReviewCount}
      serviceAreas={data.serviceAreas.map(toPublicAreaListing)}
      categories={navCategories}
      siteSlug={slug}
    />
  );
}
