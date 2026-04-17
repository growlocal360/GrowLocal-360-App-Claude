'use client';

import Link from 'next/link';
import { MapPin, Phone, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PublicRenderSite, PublicRenderLocation, PublicRenderAreaListing, PublicRenderNeighborhoodListing, PublicRenderCategory } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';
import {
  JsonLd,
  buildCollectionPageSchema,
  getSiteUrl,
  toBusinessInput,
} from '@/lib/schema';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { UnifiedLeadForm } from './unified-lead-form';

interface ServiceAreasListingPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  serviceAreas: PublicRenderAreaListing[];
  neighborhoods: PublicRenderNeighborhoodListing[];
  categories: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function ServiceAreasListingPage({ site, primaryLocation, serviceAreas, neighborhoods, categories, siteSlug, locationSlug, formCategories, schedulingActive = false, ctaStyle = 'booking' }: ServiceAreasListingPageProps) {
  const brandColor = site.settings?.brand_color || '#00ef99';
  const ctaColor = site.settings?.cta_color || brandColor;
  const accentColor = site.settings?.secondary_color || brandColor;  const city = primaryLocation?.city || '';
  const phone = site.settings?.phone || primaryLocation?.phone;

  // Schema.org structured data
  const businessInput = toBusinessInput(site, primaryLocation);
  const siteUrl = getSiteUrl(businessInput);
  const collectionSchema = buildCollectionPageSchema(
    `Areas We Serve${city ? ` in ${city}` : ''}`,
    `${site.name} proudly serves these communities and surrounding areas${city ? ` throughout the ${city} region` : ''}.`,
    siteUrl + paths.areasIndex(locationSlug),
    businessInput
  );

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[collectionSchema]} />
      <SiteHeader site={site} primaryLocation={primaryLocation} categories={categories} siteSlug={siteSlug} locationSlug={locationSlug} />
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
                  <Link key={area.id} href={paths.areaPage(area.slug, locationSlug)}>
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
                  <Link key={neighborhood.id} href={paths.neighborhoodPage(neighborhood.slug, locationSlug)}>
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
                style={{ backgroundColor: ctaColor }}
              >
                <a href={`tel:${phone.replace(/\D/g, '')}`}>
                  <Phone className="mr-2 h-5 w-5" />
                  Call {phone}
                </a>
              </Button>
            </div>
          </section>
        )}

        <UnifiedLeadForm
          siteId={site.id}
          brandColor={ctaColor}
          categories={formCategories}
          schedulingActive={schedulingActive}
          ctaStyle={ctaStyle}
          variant="section"
        />
      </main>
      <SiteFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} />
    </div>
  );
}
