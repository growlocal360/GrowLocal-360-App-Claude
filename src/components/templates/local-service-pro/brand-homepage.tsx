'use client';

import Link from 'next/link';
import { MapPin, Phone, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Site, Location } from '@/types/database';

interface BrandHomepageProps {
  site: Site;
  locations: Location[];
}

export function BrandHomepage({ site, locations }: BrandHomepageProps) {
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const industry = site.settings?.core_industry || 'Professional Services';
  const phone = site.settings?.phone;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          {site.settings?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={site.settings.logo_url}
              alt={site.name}
              className="h-10 w-auto"
            />
          ) : (
            <span className="text-xl font-bold text-gray-900">{site.name}</span>
          )}
          {phone && (
            <a
              href={`tel:${phone.replace(/\D/g, '')}`}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
            >
              <Phone className="h-4 w-4" />
              {phone}
            </a>
          )}
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="py-20 text-white" style={{ backgroundColor: brandColor }}>
          <div className="mx-auto max-w-7xl px-4 text-center">
            <h1 className="text-4xl font-bold md:text-5xl lg:text-6xl">
              {site.name}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-white/90">
              Professional {industry.toLowerCase()} services across multiple locations.
              Find a location near you.
            </p>
          </div>
        </section>

        {/* Locations Grid */}
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="text-center text-3xl font-bold text-gray-900">
              Our Locations
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
              Select your nearest location to view services and get a free estimate.
            </p>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {locations.map((loc) => (
                <Link key={loc.id} href={`/${loc.slug}`}>
                  <Card className="h-full cursor-pointer transition-all hover:shadow-lg" style={{ borderTop: `3px solid ${brandColor}` }}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${brandColor}20` }}
                        >
                          <MapPin className="h-6 w-6" style={{ color: brandColor }} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900">
                            {loc.city}, {loc.state}
                          </h3>
                          <p className="mt-1 text-sm text-gray-600">
                            {loc.address_line1}
                          </p>
                          <p className="text-sm text-gray-600">
                            {loc.city}, {loc.state} {loc.zip_code}
                          </p>
                          {loc.phone && (
                            <p className="mt-2 text-sm font-medium" style={{ color: brandColor }}>
                              {loc.phone}
                            </p>
                          )}
                          <div
                            className="mt-3 flex items-center gap-1 text-sm font-medium"
                            style={{ color: brandColor }}
                          >
                            View Services
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        {phone && (
          <section className="bg-gray-50 py-12">
            <div className="mx-auto max-w-7xl px-4 text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Not Sure Which Location?
              </h2>
              <p className="mt-2 text-gray-600">
                Give us a call and we&apos;ll help you find the right location.
              </p>
              <Button
                asChild
                size="lg"
                className="mt-6 hover:opacity-90"
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
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} {site.name}. All rights reserved.</p>
          <p className="mt-1 text-xs text-gray-500">
            Powered by{' '}
            <a href="/" className="hover:text-white" style={{ color: brandColor }}>
              GrowLocal 360
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
