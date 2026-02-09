'use client';

import { Star, Shield, Award } from 'lucide-react';

interface TrustBarProps {
  brandColor?: string;
  averageRating?: number;
  totalReviewCount?: number;
}

export function TrustBar({ brandColor = '#00d9c0', averageRating, totalReviewCount }: TrustBarProps) {
  const displayRating = averageRating || 5.0;
  const ratingLabel = averageRating
    ? `${averageRating.toFixed(1)} Rating (${totalReviewCount || 0} Reviews)`
    : '5.0 Rating';

  return (
    <section className="border-b bg-gray-50 py-4">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-8 px-4">
        {/* Star rating */}
        <div className="flex items-center gap-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i <= Math.round(displayRating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-gray-200 text-gray-200'
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-medium text-gray-700">{ratingLabel}</span>
        </div>

        {/* Licensed badge */}
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" style={{ color: brandColor }} />
          <span className="text-sm font-medium text-gray-700">Licensed & Insured</span>
        </div>

        {/* Certified badge */}
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5" style={{ color: brandColor }} />
          <span className="text-sm font-medium text-gray-700">Certified Professionals</span>
        </div>
      </div>
    </section>
  );
}
