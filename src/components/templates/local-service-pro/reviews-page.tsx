'use client';

import { Star, MessageCircle, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PublicRenderSite, PublicRenderLocation, PublicRenderReview, PublicRenderAreaListing, PublicRenderCategory } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';
import {
  JsonLd,
  buildLocalBusinessSchema,
  getSiteUrl,
  toBusinessInput,
  toLocationInput,
} from '@/lib/schema';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { UnifiedLeadForm } from './unified-lead-form';

interface ReviewsPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  reviews: PublicRenderReview[];
  averageRating: number | null;
  totalReviewCount: number | null;
  serviceAreas: PublicRenderAreaListing[];
  categories: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function ReviewsPage({
  site,
  primaryLocation,
  reviews,
  averageRating,
  totalReviewCount,
  serviceAreas,
  categories,
  siteSlug,
  locationSlug,
  formCategories,
  schedulingActive = false,
  ctaStyle = 'booking',
}: ReviewsPageProps) {
  const brandColor = site.settings?.brand_color || '#00ef99';
  const city = primaryLocation?.city || '';
  const phone = site.settings?.phone || primaryLocation?.phone;

  // Schema.org — LocalBusiness with reviews
  const businessInput = primaryLocation ? toBusinessInput(site, primaryLocation) : null;
  const locationInput = primaryLocation ? toLocationInput(primaryLocation) : null;
  const schemaReviews = reviews
    .filter(r => r.comment)
    .map(r => ({ authorName: r.author_name, text: r.comment, rating: r.rating }));
  const localBusinessSchema = businessInput && locationInput
    ? buildLocalBusinessSchema(businessInput, locationInput, {
        reviews: schemaReviews.length > 0 ? schemaReviews : undefined,
      })
    : null;

  // Rating distribution (5-star to 1-star)
  const ratingCounts = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
  }));
  const maxCount = Math.max(...ratingCounts.map(r => r.count), 1);

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[localBusinessSchema]} />
      <SiteHeader site={site} primaryLocation={primaryLocation} categories={categories} siteSlug={siteSlug} locationSlug={locationSlug} />
      <main>
        {/* Hero */}
        <section className="py-16 text-white" style={{ backgroundColor: brandColor }}>
          <div className="mx-auto max-w-7xl px-4">
            <h1 className="text-3xl font-bold md:text-4xl lg:text-5xl">
              Customer Reviews{city ? ` — ${city}` : ''}
            </h1>
            {averageRating && totalReviewCount ? (
              <div className="mt-4 flex items-center gap-3">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-7 w-7 ${
                        i < Math.round(averageRating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'fill-white/30 text-white/30'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xl font-semibold">
                  {averageRating.toFixed(1)} out of 5
                </span>
                <span className="text-lg text-white/80">
                  based on {totalReviewCount} review{totalReviewCount !== 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <p className="mt-4 text-lg text-white/90">
                See what our customers have to say about {site.name}.
              </p>
            )}
          </div>
        </section>

        {reviews.length > 0 ? (
          <>
            {/* Rating Distribution */}
            <section className="border-b bg-gray-50 py-8">
              <div className="mx-auto max-w-2xl px-4">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Rating Breakdown</h2>
                <div className="space-y-2">
                  {ratingCounts.map(({ star, count }) => (
                    <div key={star} className="flex items-center gap-3">
                      <span className="w-12 text-sm font-medium text-gray-700">
                        {star} star{star !== 1 ? 's' : ''}
                      </span>
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(count / maxCount) * 100}%`,
                            backgroundColor: brandColor,
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-sm text-gray-500">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Reviews List */}
            <section className="py-16">
              <div className="mx-auto max-w-4xl px-4">
                <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                  All Reviews ({reviews.length})
                </h2>
                <div className="mt-8 space-y-6">
                  {reviews.map((review, index) => (
                    <Card key={index} className="border-0 shadow-md">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {review.author_photo_url ? (
                              <img
                                src={review.author_photo_url}
                                alt={review.author_name || 'Reviewer'}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div
                                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                                style={{ backgroundColor: brandColor }}
                              >
                                {(review.author_name || 'C')[0].toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-gray-900">
                                {review.author_name || 'Customer'}
                              </p>
                              {review.review_date && (
                                <p className="text-xs text-gray-500">
                                  {formatReviewDate(review.review_date)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex">
                            {Array.from({ length: review.rating }).map((_, i) => (
                              <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            ))}
                          </div>
                        </div>

                        {review.comment && (
                          <p className="mt-4 text-gray-700 leading-relaxed">{review.comment}</p>
                        )}

                        {review.review_reply && (
                          <div className="mt-4 rounded-lg bg-gray-50 p-4">
                            <div className="flex items-center gap-2">
                              <MessageCircle className="h-4 w-4 text-gray-400" />
                              <p className="text-xs font-semibold text-gray-500">
                                Response from {site.name}
                                {review.reply_date && ` — ${formatReviewDate(review.reply_date)}`}
                              </p>
                            </div>
                            <p className="mt-2 text-sm text-gray-600">{review.review_reply}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <p className="mt-8 text-center text-xs text-gray-400">
                  Reviews from Google Business Profile
                </p>
              </div>
            </section>
          </>
        ) : (
          <section className="py-16">
            <div className="mx-auto max-w-4xl px-4 text-center">
              <p className="text-gray-500">No reviews yet. Be the first to leave us a review on Google!</p>
            </div>
          </section>
        )}

        {/* CTA */}
        {phone && (
          <section className="py-12" style={{ backgroundColor: `${brandColor}08` }}>
            <div className="mx-auto max-w-7xl px-4 text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Ready to Become Our Next Happy Customer?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-gray-600">
                Contact us today for fast, professional service{city ? ` in ${city}` : ''}.
              </p>
              <Button
                asChild
                size="lg"
                className="mt-6 text-lg hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                <a href={`tel:${phone.replace(/\D/g, '')}`}>
                  <Phone className="mr-2 h-5 w-5" />
                  Call {phone}
                </a>
              </Button>
            </div>
          </section>
        )}

        <UnifiedLeadForm
          siteId={site.id}
          brandColor={brandColor}
          categories={formCategories}
          schedulingActive={schedulingActive}
          ctaStyle={ctaStyle}
          variant="section"
        />
      </main>
      <SiteFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} />
    </div>
  );
}

function formatReviewDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}
