'use client';

import Link from 'next/link';
import { Phone, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PublicRenderSite, PublicRenderLocation, PublicRenderBrandListing, PublicRenderAreaListing, PublicRenderCategory } from '@/lib/sites/public-render-model';
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

interface BrandsListingPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  brands: PublicRenderBrandListing[];
  serviceAreas: PublicRenderAreaListing[];
  categories: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function BrandsListingPage({ site, primaryLocation, brands, serviceAreas, categories, siteSlug, locationSlug, formCategories, schedulingActive = false, ctaStyle = 'booking' }: BrandsListingPageProps) {
  const brandColor = site.settings?.brand_color || '#00ef99';
  const ctaColor = site.settings?.cta_color || brandColor;
  const accentColor = site.settings?.secondary_color || brandColor;  const city = primaryLocation?.city || '';
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
        <section className="py-20 text-white" style={{ backgroundColor: brandColor }}>
          <div className="mx-auto max-w-7xl px-4">
            <h1 className="text-3xl font-bold tracking-tight leading-[1.1] md:text-4xl lg:text-5xl">
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
                      className="group h-full cursor-pointer rounded-2xl border-gray-200 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
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
                          <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
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
          <section className="bg-black py-16">
            <div className="mx-auto max-w-7xl px-4 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Don&apos;t See Your Brand?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-gray-300">
                We service many more brands than listed here. Give us a call and we&apos;ll let you know how we can help.
              </p>
              <Button
                asChild
                size="lg"
                className="mt-6 rounded-full text-lg shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
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
