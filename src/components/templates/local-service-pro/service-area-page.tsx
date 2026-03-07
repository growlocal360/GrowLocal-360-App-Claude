'use client';

import Link from 'next/link';
import { Wrench, ArrowRight, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { GoogleReview, SitePage, Service, SiteCategory, GBPCategory } from '@/types/database';
import type { ServiceAreaPageData } from '@/lib/sites/get-service-areas';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import * as paths from '@/lib/routing/paths';
import { SiteHeader, NavCategory } from './site-header';
import { HeroSection } from './hero-section';
import { TrustBar } from './trust-bar';
import { LocalizedContentSection } from './localized-content-section';
import { LeadCaptureSection } from './lead-capture-section';
import { TestimonialsSection } from './testimonials-section';
import { ServiceAreasSection } from './service-areas-section';
import { EmbeddedMapSection } from './embedded-map-section';
import { SiteFooter } from './site-footer';

interface ServiceAreaPageProps {
  data: ServiceAreaPageData;
  siteSlug: string;
  googleReviews?: GoogleReview[];
  locationSlug?: string;
}

export function ServiceAreaPage({ data, siteSlug, googleReviews, locationSlug }: ServiceAreaPageProps) {
  const { site, location, serviceArea, allServiceAreas, services, categories } = data;
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const averageRating = site.settings?.google_average_rating as number | undefined;
  const totalReviewCount = site.settings?.google_total_reviews as number | undefined;
  const industry = site.settings?.core_industry || 'Professional Services';

  // Get primary category slug for service links
  const primaryCategory = categories.find(c => c.is_primary) || categories[0];
  const primaryCategorySlug = primaryCategory ? normalizeCategorySlug(primaryCategory.gbp_category.display_name) : undefined;
  const primaryCategoryName = primaryCategory?.gbp_category.display_name || industry;

  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  // Group services by category for the category-grouped layout
  const servicesByCategory: Record<string, Service[]> = {};
  for (const service of services) {
    const catId = service.site_category_id || 'uncategorized';
    if (!servicesByCategory[catId]) servicesByCategory[catId] = [];
    servicesByCategory[catId].push(service);
  }

  const getCategoryUrl = (cat: SiteCategory & { gbp_category: GBPCategory }) => {
    const catSlug = normalizeCategorySlug(cat.gbp_category.display_name);
    return paths.categoryPage(catSlug, cat.is_primary, locationSlug);
  };

  const getServiceUrl = (cat: SiteCategory & { gbp_category: GBPCategory }, serviceSlug: string) => {
    const catSlug = normalizeCategorySlug(cat.gbp_category.display_name);
    return paths.servicePage(serviceSlug, catSlug, cat.is_primary, locationSlug);
  };

  const areaState = serviceArea.state || location.state;

  // Construct SitePage-like object from serviceArea's SEO content for HeroSection & LocalizedContentSection
  const pageContent = {
    h1: serviceArea.h1 || `Your Trusted ${primaryCategoryName} Provider in ${serviceArea.name}`,
    hero_description: null,
    h2: `Serving ${serviceArea.name}`,
    body_copy: serviceArea.body_copy,
  } as SitePage;

  // Schema.org
  const phone = site.settings?.phone || location.phone;
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `https://${site.domain || `${siteSlug}.growlocal360.com`}#business`,
    name: site.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: location.address_line1,
      addressLocality: location.city,
      addressRegion: location.state,
      postalCode: location.zip_code,
      addressCountry: location.country || 'US',
    },
    telephone: phone,
    areaServed: {
      '@type': 'City',
      name: serviceArea.name,
      ...(serviceArea.state && {
        containedInPlace: {
          '@type': 'State',
          name: serviceArea.state,
        },
      }),
    },
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      <SiteHeader site={site} primaryLocation={location} categories={navCategories} siteSlug={siteSlug} locationSlug={locationSlug} />

      <main>
        <HeroSection
          site={site}
          primaryLocation={location}
          pageContent={pageContent}
          services={services}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />
        <TrustBar
          brandColor={brandColor}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />
        {/* Category-grouped services */}
        {services.length > 0 && (
          <section className="py-16">
            <div className="mx-auto max-w-7xl px-4">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900">
                  Services Offered in {serviceArea.name}{areaState ? `, ${areaState}` : ''}
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-gray-600">
                  Browse our full range of professional services available in {serviceArea.name}.
                </p>
              </div>

              <div className="mt-12 space-y-16">
                {categories.map((cat, index) => {
                  const catServices = servicesByCategory[cat.id] || [];
                  if (catServices.length === 0) return null;
                  const categoryName = cat.gbp_category.display_name;

                  return (
                    <div key={cat.id}>
                      {/* Category Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-12 w-12 items-center justify-center rounded-xl"
                            style={{ backgroundColor: `${brandColor}15` }}
                          >
                            <Wrench className="h-6 w-6" style={{ color: brandColor }} />
                          </div>
                          <div>
                            <Link href={getCategoryUrl(cat)} className="hover:underline">
                              <h3 className="text-2xl font-bold text-gray-900">
                                {categoryName}
                              </h3>
                            </Link>
                            <p className="mt-1 text-sm text-gray-500">
                              Professional {categoryName.toLowerCase()} services in {serviceArea.name}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={getCategoryUrl(cat)}
                          className="hidden items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:flex"
                          style={{ backgroundColor: brandColor }}
                        >
                          View All {categoryName}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>

                      {/* Services Grid */}
                      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {catServices.map((service) => (
                          <Link key={service.id} href={getServiceUrl(cat, service.slug)}>
                            <Card className="group h-full cursor-pointer border-gray-200 transition-all hover:border-gray-300 hover:shadow-lg">
                              <CardContent className="p-5">
                                <div className="flex items-start gap-3">
                                  <CheckCircle
                                    className="mt-0.5 h-5 w-5 shrink-0"
                                    style={{ color: brandColor }}
                                  />
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900 group-hover:underline">
                                      {service.name}
                                    </h4>
                                    {service.description && (
                                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                                        {service.description}
                                      </p>
                                    )}
                                    <span
                                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium"
                                      style={{ color: brandColor }}
                                    >
                                      Learn More
                                      <ArrowRight className="h-3 w-3" />
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        ))}
                      </div>

                      {/* Divider between categories */}
                      {index < categories.length - 1 && (
                        <div className="mt-12 border-b" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
        <LocalizedContentSection
          pageContent={pageContent}
          businessName={site.name}
          city={serviceArea.name}
        />
        <LeadCaptureSection
          siteId={site.id}
          brandColor={brandColor}
          services={services}
        />
        <TestimonialsSection
          city={serviceArea.name}
          reviews={googleReviews}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />
        {allServiceAreas.length > 0 && (
          <ServiceAreasSection
            site={site}
            serviceAreas={allServiceAreas}
            siteSlug={siteSlug}
            locationSlug={locationSlug}
          />
        )}
        <EmbeddedMapSection primaryLocation={location} />
      </main>

      <SiteFooter
        site={site}
        primaryLocation={location}
        serviceAreas={allServiceAreas}
        siteSlug={siteSlug}
        locationSlug={locationSlug}
      />
    </div>
  );
}
