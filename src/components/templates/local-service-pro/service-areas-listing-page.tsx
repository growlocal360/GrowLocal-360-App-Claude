'use client';

import Link from 'next/link';
import { MapPin, Phone, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Site, Location, ServiceAreaDB, Neighborhood } from '@/types/database';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { LeadCaptureSection } from './lead-capture-section';

interface ServiceAreasListingPageProps {
  site: Site;
  primaryLocation: Location | null;
  serviceAreas: ServiceAreaDB[];
  neighborhoods: Neighborhood[];
  categories: NavCategory[];
  siteSlug: string;
}

export function ServiceAreasListingPage({ site, primaryLocation, serviceAreas, neighborhoods, categories, siteSlug }: ServiceAreasListingPageProps) {
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const city = primaryLocation?.city || '';
  const phone = site.settings?.phone || primaryLocation?.phone;

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader site={site} primaryLocation={primaryLocation} categories={categories} siteSlug={siteSlug} />
      <main>
        {/* Hero */}
        <section className="py-16 text-white" style={{ backgroundColor: brandColor }}>
          <div className="mx-auto max-w-7xl px-4">
            <h1 className="text-3xl font-bold md:text-4xl lg:text-5xl">
              Areas We Serve{city ? ` in ${city}` : ''}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-white/90">
              {site.name} proudly serves these communities and surrounding areas
              {city ? ` throughout the ${city} region` : ''}.
            </p>
          </div>
        </section>

        {/* Service Areas Grid */}
        {serviceAreas.length > 0 && (
          <section className="py-16">
            <div className="mx-auto max-w-7xl px-4">
              <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                Cities We Serve
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {serviceAreas.map((area) => (
                  <Link key={area.id} href={`/areas/${area.slug}`}>
                    <Card className="h-full cursor-pointer transition-all hover:shadow-lg" style={{ borderTop: `3px solid ${brandColor}` }}>
                      <CardContent className="p-5">
                        <div
                          className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${brandColor}15` }}
                        >
                          <MapPin className="h-5 w-5" style={{ color: brandColor }} />
                        </div>
                        <h3 className="font-bold text-gray-900">
                          {area.name}{area.state ? `, ${area.state}` : ''}
                        </h3>
                        <span
                          className="mt-2 inline-flex items-center gap-1 text-sm font-medium"
                          style={{ color: brandColor }}
                        >
                          Learn More
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Neighborhoods Grid */}
        {neighborhoods.length > 0 && (
          <section className={serviceAreas.length > 0 ? 'bg-gray-50 py-16' : 'py-16'}>
            <div className="mx-auto max-w-7xl px-4">
              <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                Neighborhoods We Serve
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {neighborhoods.map((neighborhood) => (
                  <Link key={neighborhood.id} href={`/neighborhoods/${neighborhood.slug}`}>
                    <Card className="h-full cursor-pointer transition-all hover:shadow-lg" style={{ borderTop: `3px solid ${brandColor}` }}>
                      <CardContent className="p-5">
                        <div
                          className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${brandColor}15` }}
                        >
                          <MapPin className="h-5 w-5" style={{ color: brandColor }} />
                        </div>
                        <h3 className="font-bold text-gray-900">{neighborhood.name}</h3>
                        <span
                          className="mt-2 inline-flex items-center gap-1 text-sm font-medium"
                          style={{ color: brandColor }}
                        >
                          Learn More
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        {phone && (
          <section className="py-12" style={{ backgroundColor: `${brandColor}08` }}>
            <div className="mx-auto max-w-7xl px-4 text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Not Sure If We Serve Your Area?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-gray-600">
                Give us a call and we&apos;ll let you know if we can help. We&apos;re always expanding our service area.
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

        <LeadCaptureSection siteId={site.id} brandColor={brandColor} />
      </main>
      <SiteFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} />
    </div>
  );
}
