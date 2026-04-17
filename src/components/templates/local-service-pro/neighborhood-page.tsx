'use client';

import Link from 'next/link';
import { Phone, MapPin, ArrowLeft, Home, ChevronRight, Landmark, GraduationCap, HomeIcon, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type {
  PublicRenderSite,
  PublicRenderLocation,
  PublicRenderNeighborhoodDetail,
  PublicRenderNeighborhoodListing,
} from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';
import {
  JsonLd,
  buildLocalBusinessSchema,
  buildBreadcrumbSchema,
  getSiteUrl,
  toBusinessInput,
  toLocationInput,
} from '@/lib/schema';
import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';

interface NeighborhoodPageProps {
  data: {
    site: PublicRenderSite;
    location: PublicRenderLocation;
    neighborhood: PublicRenderNeighborhoodDetail;
    allNeighborhoods: PublicRenderNeighborhoodListing[];
  };
  siteSlug: string;
  locationSlug?: string;
}

export function NeighborhoodPage({ data, siteSlug, locationSlug }: NeighborhoodPageProps) {
  const { site, location, neighborhood, allNeighborhoods } = data;
  const brandColor = site.settings?.brand_color || '#10b981';
  const ctaColor = site.settings?.cta_color || brandColor;
  const accentColor = site.settings?.secondary_color || brandColor;
  const industry = site.settings?.core_industry || 'Professional Services';
  const phone = site.settings?.phone || location.phone;
  const localFeatures = neighborhood.local_features;

  // Other neighborhoods in this location (for internal linking)
  const otherNeighborhoods = allNeighborhoods.filter(n => n.id !== neighborhood.id);

  // Why Choose Us items — use AI-generated if available, else fallback
  const whyChooseUs = localFeatures?.why_choose_us?.length
    ? localFeatures.why_choose_us
    : [
        'Local experts who know the area',
        'Fast response times',
        'Upfront, honest pricing',
        'Licensed and insured',
        'Satisfaction guaranteed',
        'Emergency services available',
      ];

  // Schema.org structured data
  const businessInput = toBusinessInput(site, location);
  const locationInput = toLocationInput(location);
  const siteUrl = getSiteUrl(businessInput);

  const areaServed: Record<string, unknown> = {
    '@type': 'Place',
    name: `${neighborhood.name}, ${location.city}, ${location.state}`,
  };
  if (neighborhood.latitude && neighborhood.longitude) {
    areaServed.geo = {
      '@type': 'GeoCoordinates',
      latitude: neighborhood.latitude,
      longitude: neighborhood.longitude,
    };
  }

  const localBusinessSchema = buildLocalBusinessSchema(businessInput, locationInput, { areaServed });

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: siteUrl + '/' },
    { name: location.city, url: siteUrl + `/locations/${location.slug}` },
    { name: neighborhood.name, url: siteUrl + `/locations/${location.slug}/neighborhoods/${neighborhood.slug}` },
  ]);

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[localBusinessSchema, breadcrumbSchema]} />

      <SiteHeader site={site} primaryLocation={location} locationSlug={locationSlug} />

      <main>
        {/* Breadcrumb */}
        <div className="border-b bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 py-3">
            <nav className="flex items-center gap-2 text-sm text-gray-600">
              <Link
                href={paths.locationHome(locationSlug)}
                className="hover:text-gray-900"
              >
                Home
              </Link>
              <ChevronRight className="h-4 w-4" />
              <Link
                href={paths.locationHome(locationSlug)}
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
        <section className="py-16 text-white" style={{ backgroundColor: brandColor }}>
          <div className="mx-auto max-w-7xl px-4">
            <div className="max-w-3xl">
              {/* Location badge */}
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur">
                <MapPin className="h-4 w-4" />
                <span>Serving {neighborhood.name}, {location.city}</span>
              </div>

              {/* H1 - SEO optimized */}
              <h1 className="text-3xl font-bold leading-tight md:text-4xl lg:text-5xl">
                {neighborhood.h1 || `${industry} in ${neighborhood.name}`}
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
                    style={{ backgroundColor: ctaColor }}
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

                {/* Content: user HTML > AI body_copy > generic fallback */}
                {neighborhood.description ? (
                  <div
                    className="mt-4 prose prose-gray max-w-none"
                    dangerouslySetInnerHTML={{ __html: neighborhood.description }}
                  />
                ) : neighborhood.body_copy ? (
                  <div className="mt-4 space-y-4 text-gray-600">
                    {neighborhood.body_copy.split('\n\n').map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
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

                {/* Local Features: Landmarks */}
                {localFeatures?.landmarks && localFeatures.landmarks.length > 0 && (
                  <div className="mt-12">
                    <h3 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                      <Landmark className="h-5 w-5" style={{ color: brandColor }} />
                      Notable Landmarks & Parks
                    </h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {localFeatures.landmarks.map((landmark, i) => (
                        <div key={i} className="rounded-lg border p-4">
                          <h4 className="font-semibold text-gray-900">{landmark.name}</h4>
                          <p className="mt-1 text-sm text-gray-600">{landmark.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Local Features: Schools */}
                {localFeatures?.schools && localFeatures.schools.length > 0 && (
                  <div className="mt-10">
                    <h3 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                      <GraduationCap className="h-5 w-5" style={{ color: brandColor }} />
                      Nearby Schools
                    </h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {localFeatures.schools.map((school, i) => (
                        <div key={i} className="rounded-lg border p-4">
                          <h4 className="font-semibold text-gray-900">{school.name}</h4>
                          <p className="mt-1 text-sm text-gray-600">{school.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Local Features: Housing */}
                {localFeatures?.housing && (
                  <div className="mt-10">
                    <h3 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                      <HomeIcon className="h-5 w-5" style={{ color: brandColor }} />
                      Housing & Architecture
                    </h3>
                    <p className="mt-4 text-gray-600">{localFeatures.housing}</p>
                  </div>
                )}

                {/* Local Features: Community */}
                {localFeatures?.community && (
                  <div className="mt-10">
                    <h3 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                      <Users className="h-5 w-5" style={{ color: brandColor }} />
                      Community & Local Character
                    </h3>
                    <p className="mt-4 text-gray-600">{localFeatures.community}</p>
                  </div>
                )}

                {/* Why Choose Us */}
                <div className="mt-12">
                  <h3 className="text-xl font-bold text-gray-900">
                    Why {neighborhood.name} Residents Choose {site.name}
                  </h3>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                    {whyChooseUs.map((item, index) => (
                      <li key={index} className="flex items-center gap-2 text-gray-600">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full text-white text-xs shrink-0"
                          style={{ backgroundColor: brandColor }}
                        >
                          ✓
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* FAQs */}
                {neighborhood.faqs && neighborhood.faqs.length > 0 && (
                  <div className="mt-12">
                    <h3 className="text-xl font-bold text-gray-900">
                      Frequently Asked Questions — {neighborhood.name}
                    </h3>
                    <div className="mt-4 space-y-6">
                      {neighborhood.faqs.map((faq, i) => (
                        <div key={i}>
                          <h4 className="font-semibold text-gray-900">{faq.question}</h4>
                          <p className="mt-2 text-gray-600">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                        style={{ backgroundColor: ctaColor }}
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
                      href={paths.locationHome(locationSlug)}
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
                            href={paths.neighborhoodPage(n.slug, locationSlug)}
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

      <SiteFooter site={site} primaryLocation={location} locationSlug={locationSlug} />
    </div>
  );
}
