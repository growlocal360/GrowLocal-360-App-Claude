'use client';

import Link from 'next/link';
import { Phone, MapPin, ArrowLeft, Home, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SiteWithRelations, Location, Neighborhood } from '@/types/database';
import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';

interface NeighborhoodPageProps {
  data: {
    site: SiteWithRelations;
    location: Location;
    neighborhood: Neighborhood;
    allNeighborhoods: Neighborhood[];
  };
  siteSlug: string;
}

export function NeighborhoodPage({ data, siteSlug }: NeighborhoodPageProps) {
  const { site, location, neighborhood, allNeighborhoods } = data;
  const brandColor = site.settings?.brand_color || '#10b981';
  const industry = site.settings?.core_industry || 'Professional Services';
  const phone = site.settings?.phone || location.phone;

  // Other neighborhoods in this location (for internal linking)
  const otherNeighborhoods = allNeighborhoods.filter(n => n.id !== neighborhood.id);

  // Generate LocalBusiness + Service schema
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: site.name,
    description: `${industry} services in ${neighborhood.name}, ${location.city}, ${location.state}`,
    telephone: phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: location.address_line1,
      addressLocality: location.city,
      addressRegion: location.state,
      postalCode: location.zip_code,
      addressCountry: location.country || 'US',
    },
    geo: location.latitude && location.longitude ? {
      '@type': 'GeoCoordinates',
      latitude: location.latitude,
      longitude: location.longitude,
    } : undefined,
    areaServed: {
      '@type': 'Place',
      name: `${neighborhood.name}, ${location.city}, ${location.state}`,
      geo: neighborhood.latitude && neighborhood.longitude ? {
        '@type': 'GeoCoordinates',
        latitude: neighborhood.latitude,
        longitude: neighborhood.longitude,
      } : undefined,
    },
    url: `https://${site.domain || `${siteSlug}.growlocal360.com`}/locations/${location.slug}/neighborhoods/${neighborhood.slug}`,
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      <SiteHeader site={site} primaryLocation={location} />

      <main>
        {/* Breadcrumb */}
        <div className="border-b bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 py-3">
            <nav className="flex items-center gap-2 text-sm text-gray-600">
              <Link
                href={`/sites/${siteSlug}`}
                className="hover:text-gray-900"
              >
                Home
              </Link>
              <ChevronRight className="h-4 w-4" />
              <Link
                href={`/sites/${siteSlug}/locations/${location.slug}`}
                className="hover:text-gray-900"
              >
                {location.city}
              </Link>
              <ChevronRight className="h-4 w-4" />
              <span className="font-medium text-gray-900">{neighborhood.name}</span>
            </nav>
          </div>
        </div>

        {/* Hero Section */}
        <section className="bg-gradient-to-br from-gray-900 to-gray-800 py-16 text-white">
          <div className="mx-auto max-w-7xl px-4">
            <div className="max-w-3xl">
              {/* Location badge */}
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur">
                <MapPin className="h-4 w-4" />
                <span>Serving {neighborhood.name}, {location.city}</span>
              </div>

              {/* H1 - SEO optimized */}
              <h1 className="text-3xl font-bold leading-tight md:text-4xl lg:text-5xl">
                {industry} in {neighborhood.name}
              </h1>

              <p className="mt-4 text-lg text-gray-300 md:text-xl">
                {site.name} proudly serves {neighborhood.name} and the surrounding {location.city}, {location.state} area.
                Contact us today for professional {industry.toLowerCase()} services.
              </p>

              {/* CTA */}
              {phone && (
                <div className="mt-8">
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
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid gap-12 lg:grid-cols-3">
              {/* Main Content */}
              <div className="lg:col-span-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  About Our Services in {neighborhood.name}
                </h2>

                {neighborhood.description ? (
                  <div
                    className="mt-4 prose prose-gray max-w-none"
                    dangerouslySetInnerHTML={{ __html: neighborhood.description }}
                  />
                ) : (
                  <div className="mt-4 space-y-4 text-gray-600">
                    <p>
                      {site.name} is your trusted {industry.toLowerCase()} provider in {neighborhood.name}.
                      As a locally-owned business serving the {location.city} area, we understand the unique needs
                      of {neighborhood.name} residents and businesses.
                    </p>
                    <p>
                      Whether you need routine maintenance, emergency repairs, or complete installations,
                      our experienced team is ready to help. We take pride in delivering quality workmanship
                      and exceptional customer service to every client in {neighborhood.name}.
                    </p>
                    <p>
                      Contact us today to schedule a free consultation or get a quote for your project.
                      We look forward to serving you!
                    </p>
                  </div>
                )}

                {/* Why Choose Us */}
                <div className="mt-12">
                  <h3 className="text-xl font-bold text-gray-900">
                    Why {neighborhood.name} Residents Choose {site.name}
                  </h3>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                    {[
                      'Local experts who know the area',
                      'Fast response times',
                      'Upfront, honest pricing',
                      'Licensed and insured',
                      'Satisfaction guaranteed',
                      'Emergency services available',
                    ].map((item, index) => (
                      <li key={index} className="flex items-center gap-2 text-gray-600">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full text-white text-xs"
                          style={{ backgroundColor: brandColor }}
                        >
                          ✓
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Contact Card */}
                <Card className="border-2" style={{ borderColor: brandColor }}>
                  <CardContent className="p-6">
                    <h3 className="font-bold text-gray-900">
                      Get a Free Quote in {neighborhood.name}
                    </h3>
                    <p className="mt-2 text-sm text-gray-600">
                      Call us now for fast, friendly service.
                    </p>
                    {phone && (
                      <Button
                        asChild
                        className="mt-4 w-full"
                        style={{ backgroundColor: brandColor }}
                      >
                        <a href={`tel:${phone.replace(/\D/g, '')}`}>
                          <Phone className="mr-2 h-4 w-4" />
                          {phone}
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Service Area Card */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-bold text-gray-900">Service Location</h3>
                    <div className="mt-4 flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div>
                        <p>{location.address_line1}</p>
                        <p>{location.city}, {location.state} {location.zip_code}</p>
                      </div>
                    </div>
                    <Link
                      href={`/sites/${siteSlug}/locations/${location.slug}`}
                      className="mt-4 inline-flex items-center text-sm font-medium"
                      style={{ color: brandColor }}
                    >
                      <ArrowLeft className="mr-1 h-4 w-4" />
                      View {location.city} Location
                    </Link>
                  </CardContent>
                </Card>

                {/* Other Neighborhoods */}
                {otherNeighborhoods.length > 0 && (
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="flex items-center gap-2 font-bold text-gray-900">
                        <Home className="h-4 w-4" />
                        More {location.city} Neighborhoods
                      </h3>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {otherNeighborhoods.map((n) => (
                          <Link
                            key={n.id}
                            href={`/sites/${siteSlug}/locations/${location.slug}/neighborhoods/${n.slug}`}
                          >
                            <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                              {n.name}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          className="py-16"
          style={{ backgroundColor: brandColor }}
        >
          <div className="mx-auto max-w-7xl px-4 text-center text-white">
            <h2 className="text-2xl font-bold md:text-3xl">
              Ready to Get Started in {neighborhood.name}?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg opacity-90">
              Contact {site.name} today for professional {industry.toLowerCase()} services
              in {neighborhood.name} and the greater {location.city} area.
            </p>
            {phone && (
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="mt-8 text-lg"
              >
                <a href={`tel:${phone.replace(/\D/g, '')}`}>
                  <Phone className="mr-2 h-5 w-5" />
                  Call {phone}
                </a>
              </Button>
            )}
          </div>
        </section>
      </main>

      <SiteFooter site={site} primaryLocation={location} />
    </div>
  );
}
