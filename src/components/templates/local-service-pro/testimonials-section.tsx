'use client';

import { Star, Quote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { GoogleReview } from '@/types/database';

interface TestimonialsSectionProps {
  city: string;
  count?: number;
  reviews?: GoogleReview[];
  averageRating?: number;
  totalReviewCount?: number;
}

// Placeholder testimonials — used when no Google Reviews are available
const defaultTestimonials = [
  {
    text: 'Excellent service from start to finish. Professional, on time, and fair pricing. Highly recommend!',
    name: 'Sarah M.',
    rating: 5,
  },
  {
    text: 'They went above and beyond to solve our issue. Will definitely use again for future work.',
    name: 'James R.',
    rating: 5,
  },
  {
    text: 'Fast response time and quality workmanship. The team was courteous and cleaned up after the job.',
    name: 'Michelle K.',
    rating: 5,
  },
];

export function TestimonialsSection({
  city,
  count = 3,
  reviews,
  averageRating,
  totalReviewCount,
}: TestimonialsSectionProps) {
  const hasRealReviews = reviews && reviews.length > 0;

  // Convert Google Reviews to display format
  const testimonials = hasRealReviews
    ? reviews.slice(0, count).map((review) => ({
        text: review.comment || 'Great service!',
        name: review.author_name || 'Customer',
        rating: review.rating,
        photoUrl: review.author_photo_url,
      }))
    : defaultTestimonials.slice(0, count).map((t) => ({
        ...t,
        photoUrl: undefined as string | undefined | null,
      }));

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
            What {city} Customers Say
          </h2>
          {hasRealReviews && averageRating ? (
            <div className="mt-2 flex items-center justify-center gap-2">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < Math.round(averageRating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'fill-gray-200 text-gray-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-medium text-gray-700">
                {averageRating.toFixed(1)} from {totalReviewCount} Google Review{totalReviewCount !== 1 ? 's' : ''}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-gray-600">
              Don&apos;t just take our word for it
            </p>
          )}
        </div>

        <div className={`mt-10 grid gap-6 ${count >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-0 shadow-md">
              <CardContent className="p-6">
                <Quote className="mb-3 h-8 w-8 text-gray-200" />
                <p className="text-gray-600 line-clamp-4">{testimonial.text}</p>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {testimonial.name}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {hasRealReviews && (
          <p className="mt-6 text-center text-xs text-gray-400">
            Reviews from Google Business Profile
          </p>
        )}
      </div>
    </section>
  );
}
