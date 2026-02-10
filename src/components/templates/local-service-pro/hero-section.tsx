'use client';

import { Star, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const phone = site.settings?.phone || primaryLocation?.phone;

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

            {/* Phone CTA + Book Online */}
            {phone && (
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a href={`tel:${phone.replace(/\D/g, '')}`} className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: brandColor }}
                  >
                    <Phone className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm" style={{ color: brandColor }}>Call for Immediate Service</div>
                    <div className="text-lg font-bold">{phone}</div>
                  </div>
                </a>
                <Button
                  asChild
                  size="lg"
                  className="text-lg hover:opacity-90"
                  style={{ backgroundColor: brandColor }}
                >
                  <a href="#hero-form">Book Online</a>
                </Button>
              </div>
            )}
          </div>

          {/* Right side: Multi-step form */}
          <div id="hero-form" className="flex items-center justify-center lg:justify-end">
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
