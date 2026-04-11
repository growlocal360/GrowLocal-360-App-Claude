'use client';

import { useState, useEffect } from 'react';
import { Star, Shield, Award, CalendarCheck, TrendingUp, Clock } from 'lucide-react';

interface SchedulingStats {
  sameDayRate: number;
  totalBookings: number;
  avgDailySpots: number;
}

interface TrustBarProps {
  siteId?: string;
  brandColor?: string;
  averageRating?: number;
  totalReviewCount?: number;
  schedulingActive?: boolean;
}

export function TrustBar({ siteId, brandColor = '#00ef99', averageRating, totalReviewCount, schedulingActive = false }: TrustBarProps) {
  const [stats, setStats] = useState<SchedulingStats | null>(null);

  useEffect(() => {
    if (!schedulingActive || !siteId) return;

    async function loadStats() {
      try {
        const res = await fetch(`/api/public/scheduling-stats?siteId=${siteId}`);
        const data = await res.json();
        // Only set if there's meaningful data
        if (data.sameDayRate > 0 || data.totalBookings > 0) {
          setStats(data);
        }
      } catch {
        // Silently fail — static badges still show
      }
    }

    loadStats();
  }, [siteId, schedulingActive]);

  const displayRating = averageRating || 5.0;
  const ratingLabel = averageRating
    ? `${averageRating.toFixed(1)} Rating (${totalReviewCount || 0} Reviews)`
    : '5.0 Rating';

  return (
    <section className="border-b bg-gray-50 py-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-10 px-4">
        {/* Star rating */}
        <div className="flex items-center gap-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`h-5 w-5 ${
                  i <= Math.round(displayRating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-gray-200 text-gray-200'
                }`}
              />
            ))}
          </div>
          <span className="text-base font-medium text-gray-700">{ratingLabel}</span>
        </div>

        {/* Same-day availability rate */}
        {stats && stats.sameDayRate >= 50 && (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${brandColor}15` }}>
              <CalendarCheck className="h-5 w-5" style={{ color: brandColor }} />
            </div>
            <span className="text-base font-medium text-gray-700">
              Same-Day Service {stats.sameDayRate}% of Days
            </span>
          </div>
        )}

        {/* Total bookings completed */}
        {stats && stats.totalBookings >= 10 && (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${brandColor}15` }}>
              <TrendingUp className="h-5 w-5" style={{ color: brandColor }} />
            </div>
            <span className="text-base font-medium text-gray-700">
              {stats.totalBookings.toLocaleString()}+ Jobs Completed
            </span>
          </div>
        )}

        {/* Average daily spots */}
        {stats && stats.avgDailySpots >= 2 && !stats.sameDayRate && (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${brandColor}15` }}>
              <Clock className="h-5 w-5" style={{ color: brandColor }} />
            </div>
            <span className="text-base font-medium text-gray-700">
              ~{stats.avgDailySpots} Openings Daily
            </span>
          </div>
        )}

        {/* Licensed badge */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${brandColor}15` }}>
            <Shield className="h-5 w-5" style={{ color: brandColor }} />
          </div>
          <span className="text-base font-medium text-gray-700">Licensed & Insured</span>
        </div>

        {/* Certified badge */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${brandColor}15` }}>
            <Award className="h-5 w-5" style={{ color: brandColor }} />
          </div>
          <span className="text-base font-medium text-gray-700">Certified Professionals</span>
        </div>
      </div>
    </section>
  );
}
