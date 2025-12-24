'use client';

import { Phone, MapPin, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Site, Location } from '@/types/database';

interface HeroSectionProps {
  site: Site;
  primaryLocation: Location | null;
}

export function HeroSection({ site, primaryLocation }: HeroSectionProps) {
  const phone = site.settings?.phone || primaryLocation?.phone;
  const brandColor = site.settings?.brand_color || '#10b981';
  const industry = site.settings?.core_industry || 'Professional Services';

  return (
    <section className="relative bg-gradient-to-br from-gray-900 to-gray-800 py-20 text-white">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4">
        <div className="max-w-3xl">
          {/* Trust badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className="h-4 w-4 fill-yellow-400 text-yellow-400"
                />
              ))}
            </div>
            <span>Trusted Local {industry} Provider</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
            {site.name}
          </h1>

          {/* Subheadline */}
          <p className="mt-4 text-xl text-gray-300 md:text-2xl">
            Professional {industry.toLowerCase()} services
            {primaryLocation && (
              <>
                {' '}
                in {primaryLocation.city}, {primaryLocation.state} and
                surrounding areas
              </>
            )}
            .
          </p>

          {/* Location badge */}
          {primaryLocation && (
            <div className="mt-6 flex items-center gap-2 text-gray-300">
              <MapPin className="h-5 w-5" />
              <span>
                {primaryLocation.address_line1}, {primaryLocation.city},{' '}
                {primaryLocation.state} {primaryLocation.zip_code}
              </span>
            </div>
          )}

          {/* CTA buttons */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            {phone && (
              <Button
                asChild
                size="lg"
                style={{ backgroundColor: brandColor }}
                className="text-lg hover:opacity-90"
              >
                <a href={`tel:${phone.replace(/\D/g, '')}`}>
                  <Phone className="mr-2 h-5 w-5" />
                  Call {phone}
                </a>
              </Button>
            )}
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white text-lg text-white hover:bg-white hover:text-gray-900"
            >
              <a href="#contact">Get Free Quote</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
