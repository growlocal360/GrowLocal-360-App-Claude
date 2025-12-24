'use client';

import Link from 'next/link';
import { Phone, MapPin, Clock, ChevronRight, Building2, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SiteWithRelations, Location, Neighborhood, ServiceAreaDB } from '@/types/database';
import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';

interface LocationPageProps {
  data: {
    site: SiteWithRelations;
    location: Location;
    allLocations: Location[];
    neighborhoods: Neighborhood[];
    serviceAreas: ServiceAreaDB[];
  };
  siteSlug: string;
}

export function LocationPage({ data, siteSlug }: LocationPageProps) {
  const { site, location, allLocations, neighborhoods, serviceAreas } = data;
  const brandColor = site.settings?.brand_color || '#10b981';
  const industry = site.settings?.core_industry || 'Professional Services';
  const phone = site.settings?.phone || location.phone;

  // Other locations in this site (for internal linking)
  const otherLocations = allLocations.filter(l => l.id !== location.id);

  // Generate LocalBusiness schema for this location (GBP landing page)
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `https://${site.domain || `${siteSlug}.growlocal360.com`}/locations/${location.slug}#business`,
    name: site.name,
    description: `${industry} services in ${location.city}, ${location.state}`,
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
    // Area served includes the city and all neighborhoods
    areaServed: [
      {
        '@type': 'City',
        name: `${location.city}, ${location.state}`,
      },
      ...neighborhoods.map(n => ({
        '@type': 'Place',
        name: `${n.name}, ${location.city}, ${location.state}`,
      })),
    ],
    url: `https://${site.domain || `${siteSlug}.growlocal360.com`}/locations/${location.slug}`,
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
              <span className="font-medium text-gray-900">{location.city}</span>
            </nav>
          </div>
        </div>

        {/* Hero Section - GBP Landing Page */}
        <section className="bg-gradient-to-br from-gray-900 to-gray-800 py-20 text-white">
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid gap-12 lg:grid-cols-2">
              <div>
                {/* Location badge */}
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur">
                  <MapPin className="h-4 w-4" />
                  <span>{location.city}, {location.state}</span>
                </div>

                {/* H1 - SEO optimized: "[Industry] in [City]" */}
                <h1 className="text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
                  {industry} in {location.city}
                </h1>

                <p className="mt-6 text-xl text-gray-300">
                  {site.name} is your trusted {industry.toLowerCase()} provider in {location.city}, {location.state}.
                  We deliver quality workmanship and exceptional service to every customer.
                </p>

                {/* CTA Buttons */}
                <div className="mt-8 flex flex-wrap gap-4">
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
                    className="border-white text-lg text-white hover:bg-white/10"
                  >
                    <a href="#contact">Get a Free Quote</a>
                  </Button>
                </div>
              </div>

              {/* Location Info Card */}
              <div className="flex items-center justify-center lg:justify-end">
                <Card className="w-full max-w-md bg-white text-gray-900">
                  <CardContent className="p-6">
                    <h2 className="text-xl font-bold">{location.city} Location</h2>

                    <div className="mt-4 space-y-4">
                      <div className="flex items-start gap-3">
                        <MapPin className="mt-1 h-5 w-5 flex-shrink-0 text-gray-400" />
                        <div>
                          <p className="font-medium">Address</p>
                          <p className="text-gray-600">{location.address_line1}</p>
                          {location.address_line2 && (
                            <p className="text-gray-600">{location.address_line2}</p>
                          )}
                          <p className="text-gray-600">
                            {location.city}, {location.state} {location.zip_code}
                          </p>
                        </div>
                      </div>

                      {phone && (
                        <div className="flex items-start gap-3">
                          <Phone className="mt-1 h-5 w-5 flex-shrink-0 text-gray-400" />
                          <div>
                            <p className="font-medium">Phone</p>
                            <a
                              href={`tel:${phone.replace(/\D/g, '')}`}
                              className="text-gray-600 hover:underline"
                              style={{ color: brandColor }}
                            >
                              {phone}
                            </a>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <Clock className="mt-1 h-5 w-5 flex-shrink-0 text-gray-400" />
                        <div>
                          <p className="font-medium">Hours</p>
                          <p className="text-gray-600">Mon-Fri: 8am - 6pm</p>
                          <p className="text-gray-600">Sat: 9am - 4pm</p>
                          <p className="text-gray-600">Sun: Closed</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* About This Location */}
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid gap-12 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <h2 className="text-3xl font-bold text-gray-900">
                  About {site.name} in {location.city}
                </h2>
                <div className="mt-6 space-y-4 text-gray-600">
                  <p>
                    {site.name} has been proudly serving {location.city} and the surrounding {location.state} area
                    with professional {industry.toLowerCase()} services. Our experienced team understands the unique
                    needs of local homes and businesses.
                  </p>
                  <p>
                    Whether you need routine maintenance, emergency repairs, or complete installations,
                    we&apos;re here to help. We take pride in delivering quality workmanship, honest pricing,
                    and exceptional customer service on every job.
                  </p>
                  <p>
                    As a locally-owned business, we&apos;re committed to building lasting relationships with our
                    customers in {location.city}. Contact us today to see why so many residents trust us for
                    their {industry.toLowerCase()} needs.
                  </p>
                </div>

                {/* Why Choose Us */}
                <div className="mt-12">
                  <h3 className="text-2xl font-bold text-gray-900">
                    Why {location.city} Chooses {site.name}
                  </h3>
                  <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                    {[
                      'Licensed & Insured',
                      'Free Estimates',
                      'Same-Day Service Available',
                      'Upfront, Honest Pricing',
                      'Satisfaction Guaranteed',
                      '24/7 Emergency Service',
                    ].map((item, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-white text-sm"
                          style={{ backgroundColor: brandColor }}
                        >
                          ✓
                        </span>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Quick Contact */}
                <Card className="border-2" style={{ borderColor: brandColor }}>
                  <CardContent className="p-6">
                    <h3 className="font-bold text-gray-900">
                      Get a Free Quote in {location.city}
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

                {/* Other Locations */}
                {otherLocations.length > 0 && (
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="flex items-center gap-2 font-bold text-gray-900">
                        <Building2 className="h-4 w-4" />
                        Other Locations
                      </h3>
                      <div className="mt-4 space-y-2">
                        {otherLocations.map((loc) => (
                          <Link
                            key={loc.id}
                            href={`/sites/${siteSlug}/locations/${loc.slug}`}
                            className="flex items-center gap-2 text-sm hover:underline"
                            style={{ color: brandColor }}
                          >
                            <MapPin className="h-3 w-3" />
                            {loc.city}, {loc.state}
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

        {/* Neighborhoods Section - Internal Linking for SEO */}
        {neighborhoods.length > 0 && (
          <section className="bg-gray-50 py-16">
            <div className="mx-auto max-w-7xl px-4">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900">
                  Neighborhoods We Serve in {location.city}
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-gray-600">
                  {site.name} proudly serves all neighborhoods in {location.city}.
                  Click on any area below to learn more about our services in your neighborhood.
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {neighborhoods.map((neighborhood) => (
                  <Link
                    key={neighborhood.id}
                    href={`/sites/${siteSlug}/locations/${location.slug}/neighborhoods/${neighborhood.slug}`}
                  >
                    <Card className="h-full cursor-pointer transition-all hover:border-gray-300 hover:shadow-md">
                      <CardContent className="flex items-center gap-3 p-4">
                        <Map className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{neighborhood.name}</p>
                          <p className="text-xs text-gray-500">
                            {industry} in {neighborhood.name}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Service Areas Section */}
        {serviceAreas.length > 0 && (
          <section className="py-16">
            <div className="mx-auto max-w-7xl px-4">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900">
                  Service Areas Near {location.city}
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-gray-600">
                  In addition to {location.city}, we also provide {industry.toLowerCase()} services
                  to these nearby communities.
                </p>
              </div>

              <div className="mt-10 flex flex-wrap justify-center gap-3">
                {serviceAreas.map((area) => (
                  <Link
                    key={area.id}
                    href={`/sites/${siteSlug}/service-areas/${area.slug}`}
                  >
                    <Badge
                      variant="outline"
                      className="cursor-pointer px-4 py-2 text-sm hover:bg-gray-100"
                    >
                      {area.name}, {area.state}
                      {area.distance_miles && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({Math.round(area.distance_miles)} mi)
                        </span>
                      )}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section
          id="contact"
          className="py-16"
          style={{ backgroundColor: brandColor }}
        >
          <div className="mx-auto max-w-7xl px-4 text-center text-white">
            <h2 className="text-3xl font-bold md:text-4xl">
              Ready to Get Started in {location.city}?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg opacity-90">
              Contact {site.name} today for professional {industry.toLowerCase()} services.
              We offer free estimates and same-day service availability.
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
