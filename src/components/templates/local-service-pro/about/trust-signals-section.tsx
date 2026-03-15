'use client';

import type { AboutPageSections } from '@/types/database';
import type { PublicRenderReview } from '@/lib/sites/public-render-model';

interface TrustSignalsSectionProps {
  sections: AboutPageSections | null;
  reviews: PublicRenderReview[];
  brandColor: string;
  averageRating?: number | null;
  totalReviews?: number | null;
}

export function TrustSignalsSection({
  sections,
  reviews,
  brandColor,
  averageRating,
  totalReviews,
}: TrustSignalsSectionProps) {
  const trustPoints = sections?.trust_points;
  if (!trustPoints && reviews.length === 0) return null;

  return (
    <section className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-4">
        {trustPoints && (
          <>
            <h2 className="mb-8 text-3xl font-bold text-gray-900">{trustPoints.heading}</h2>
            <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {trustPoints.points.map((point, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm"
                >
                  <div
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: brandColor }}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="mb-1 font-semibold text-gray-900">{point.title}</h3>
                  <p className="text-sm text-gray-600">{point.description}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Google review highlights */}
        {reviews.length > 0 && (
          <div>
            <div className="mb-6 flex items-center gap-3">
              <h3 className="text-2xl font-bold text-gray-900">What Our Customers Say</h3>
              {averageRating && totalReviews && (
                <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 shadow-sm">
                  <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <span className="font-semibold text-gray-900">{averageRating.toFixed(1)}</span>
                  <span className="text-sm text-gray-500">({totalReviews} reviews)</span>
                </div>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.slice(0, 3).map((review, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm"
                >
                  <div className="mb-2 flex items-center gap-1">
                    {Array.from({ length: review.rating || 5 }).map((_, j) => (
                      <svg key={j} className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                  {review.comment && (
                    <p className="mb-3 text-sm text-gray-600 line-clamp-4">
                      &ldquo;{review.comment}&rdquo;
                    </p>
                  )}
                  <p className="text-sm font-medium text-gray-900">{review.author_name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
