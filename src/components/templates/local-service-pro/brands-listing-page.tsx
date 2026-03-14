'use client';

import Link from 'next/link';
import { Phone, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PublicRenderSite, PublicRenderLocation, PublicRenderBrandListing, PublicRenderAreaListing } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';
import {
  JsonLd,
  buildCollectionPageSchema,
  getSiteUrl,
  toBusinessInput,
} from '@/lib/schema';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { LeadCaptureSection } from './lead-capture-section';

interface BrandsListingPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  brands: PublicRenderBrandListing[];
  serviceAreas: PublicRenderAreaListing[];
  categories: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
}

export function BrandsListingPage({ site, primaryLocation, brands, serviceAreas, categories, siteSlug, locationSlug }: BrandsListingPageProps) {
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const city = primaryLocation?.city || '';
  const industry = (site.settings?.core_industry as string) || '';
  const phone = site.settings?.phone || primaryLocation?.phone;

  // Schema.org structured data
  const businessInput = toBusinessInput(site, primaryLocation);
  const siteUrl = getSiteUrl(businessInput);
  const collectionSchema = buildCollectionPageSchema(
    `${industry ? `${industry} Brands` : 'Brands'} We Service${city ? ` in ${city}` : ''}`,
    `${site.name} services, repairs, and installs all major${industry ? ` ${industry.toLowerCase()}` : ''} brands${city ? ` in ${city} and nearby communities` : ''}.`,
    siteUrl + paths.brandsIndex(locationSlug),
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
              {industry ? `${industry} Brands` : 'Brands'} We Service
              {city ? ` in ${city} & Surrounding Areas` : ''}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-white/90">
              {site.name} is proud to service, repair, and install all major
              {industry ? ` ${industry.toLowerCase()}` : ''} brands.
              {city ? ` Serving ${city} and nearby communities.` : ''}
            </p>
          </div>
        </section>

        {/* Brands Grid */}
        {brands.length > 0 ? (
          <section className="py-16">
            <div className="mx-auto max-w-7xl px-4">
              <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                All Brands ({brands.length})
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {brands.map((brand) => (
                  <Link key={brand.id} href={paths.brandPage(brand.slug, locationSlug)}>
                    <Card
                      className="h-full cursor-pointer transition-all hover:shadow-lg"
                      style={{ borderTop: `3px solid ${brandColor}` }}
                    >
                      <CardContent className="p-5">
                        <h3 className="text-lg font-bold text-gray-900">{brand.name}</h3>
                        {brand.hero_description && (
                          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                            {brand.hero_description}
                          </p>
                        )}
                        <span
                          className="mt-2 inline-flex items-center gap-1 text-sm font-medium"
                          style={{ color: brandColor }}
                        >
                          View Services
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="py-16">
            <div className="mx-auto max-w-7xl px-4 text-center">
              <p className="text-gray-500">No brands listed yet.</p>
            </div>
          </section>
        )}

        {/* CTA Section */}
        {phone && (
          <section className="py-12" style={{ backgroundColor: `${brandColor}08` }}>
            <div className="mx-auto max-w-7xl px-4 text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Don&apos;t See Your Brand?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-gray-600">
                We service many more brands than listed here. Give us a call and we&apos;ll let you know how we can help.
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
      <SiteFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} />
    </div>
  );
}
