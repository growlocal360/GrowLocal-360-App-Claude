'use client';

import { Star, Shield, Award, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Site, Location, SitePage, Service } from '@/types/database';
import { MultiStepForm } from './multi-step-form';

interface HeroSectionProps {
  site: Site;
  primaryLocation: Location | null;
  pageContent?: SitePage | null;
  services?: Service[];
  averageRating?: number;
  totalReviewCount?: number;
}

export function HeroSection({ site, primaryLocation, pageContent, services, averageRating, totalReviewCount }: HeroSectionProps) {
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const industry = site.settings?.core_industry || 'Professional Services';

  const h1 = pageContent?.h1 || site.name;
  const heroDescription = pageContent?.hero_description ||
    `Professional ${industry.toLowerCase()} services${primaryLocation ? ` in ${primaryLocation.city}, ${primaryLocation.state} and surrounding areas` : ''}.`;

  return (
    <section className="relative bg-gradient-to-br from-gray-900 to-gray-800 py-16 text-white lg:py-20">
      <div className="relative mx-auto max-w-7xl px-4">
        <div className="grid gap-10 lg:grid-cols-2">
          {/* Left side: Content */}
          <div className="flex flex-col justify-center">
            {/* Star rating badge */}
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i <= Math.round(averageRating || 5)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'fill-gray-500 text-gray-500'
                    }`}
                  />
                ))}
              </div>
              <span>
                {averageRating
                  ? `${averageRating.toFixed(1)}-Star Rated · ${totalReviewCount || 0} Google Reviews`
                  : '5-Star Rated Service'}
              </span>
            </div>

            {/* H1 */}
            <h1 className="text-3xl font-bold leading-tight md:text-4xl lg:text-5xl">
              {h1}
            </h1>

            {/* Hero description */}
            <p className="mt-4 text-lg text-gray-300">
              {heroDescription}
            </p>

            {/* Trust badges */}
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { icon: Shield, label: 'Licensed & Insured' },
                { icon: Award, label: 'Locally Owned' },
                { icon: Clock, label: 'Same-Day Service' },
              ].map((badge) => (
                <div key={badge.label} className="flex items-center gap-2 text-sm text-gray-300">
                  <badge.icon className="h-5 w-5 shrink-0" style={{ color: brandColor }} />
                  <span>{badge.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right side: Multi-step form */}
          <div className="flex items-center justify-center lg:justify-end">
            <Card className="w-full max-w-md bg-white text-gray-900">
              <CardContent className="p-6">
                <MultiStepForm
                  siteId={site.id}
                  brandColor={brandColor}
                  services={services}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
