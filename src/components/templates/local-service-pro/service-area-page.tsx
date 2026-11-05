'use client';

import Link from 'next/link';
import { Wrench, Layers, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type {
  PublicRenderSite,
  PublicRenderLocation,
  PublicRenderAreaDetail,
  PublicRenderAreaListing,
  PublicRenderServiceListing,
  PublicRenderCategory,
  PublicRenderReview,
  PublicRenderPageContent,
  PublicRenderWorkItem,
} from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';
import type { MainServiceEntry } from '@/lib/sites/main-service-list';
import { townServiceHref } from '@/lib/sites/main-service-list';
import {
  JsonLd,
  buildLocalBusinessSchema,
  buildBreadcrumbSchema,
  getSiteUrl,
  toBusinessInput,
  toLocationInput,
} from '@/lib/schema';
import { SiteHeader, NavCategory } from './site-header';
import { HeroSection } from './hero-section';
import { TrustBar } from './trust-bar';
import { LocalizedContentSection } from './localized-content-section';
import { UnifiedLeadForm } from './unified-lead-form';
import { TestimonialsSection } from './testimonials-section';
import { ServiceAreasSection } from './service-areas-section';
import { EmbeddedMapSection } from './embedded-map-section';
import { SiteFooter } from './site-footer';
import { RecentWorkSection } from './about/recent-work-section';

/**
 * v6 TOWN PAGE — /service-areas/{city}/
 * One page per served town. Lists the FULL main service list in home-page
 * order. Plain town: cards link to the root service pages. Promoted town (has
 * its own GBP): cards link into the town's silo (/service-areas/{city}/{slug}/).
 */
export interface ServiceAreaPageProps {
  data: {
    site: PublicRenderSite;
    location: PublicRenderLocation;
    serviceArea: PublicRenderAreaDetail;
    allServiceAreas: PublicRenderAreaListing[];
    services: PublicRenderServiceListing[];
    categories: PublicRenderCategory[];
    /** The main service list (home order). Same on every town page. */
    mainServices: MainServiceEntry[];
    /** Town has its own GBP → cards link into the silo. */
    promoted: boolean;
    primaryCategoryName: string;
  };
  siteSlug: string;
  googleReviews?: PublicRenderReview[];
  recentWorkItems?: PublicRenderWorkItem[];
  recentWorkTitle?: string;
  /** Anti-doorway, page-specific lede. */
  intro?: string | null;
  workItemsCount?: number;
  locationSlug?: string;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function ServiceAreaPage({ data, siteSlug, googleReviews, recentWorkItems, intro, locationSlug, formCategories, schedulingActive = false, ctaStyle = 'booking' }: ServiceAreaPageProps) {
  const { site, location, serviceArea, allServiceAreas, services, categories, mainServices, promoted, primaryCategoryName } = data;
  const brandColor = site.settings?.brand_color || '#00ef99';
  const ctaColor = site.settings?.cta_color || brandColor;
  const accentColor = site.settings?.secondary_color || brandColor;
  const averageRating = site.settings?.google_average_rating as number | undefined;
  const totalReviewCount = site.settings?.google_total_reviews as number | undefined;

  const navCategories: NavCategory[] = categories.map(c => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: c.gbp_category.display_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    isPrimary: c.is_primary,
  }));

  const areaState = serviceArea.state || location.state;
  const areaName = areaState ? `${serviceArea.name}, ${areaState}` : serviceArea.name;

  // Page content for HeroSection & LocalizedContentSection, framed on THIS town.
  const pageContent: PublicRenderPageContent = {
    h1: serviceArea.h1 || `${primaryCategoryName} in ${areaName}`,
    hero_description: intro || `${site.name} provides ${primaryCategoryName.toLowerCase()} in ${areaName} and the surrounding area.`,
    h2: promoted ? `Our ${serviceArea.name} location` : `Serving ${serviceArea.name}`,
    body_copy: serviceArea.body_copy,
    body_copy_2: null,
    faqs: null,
    sections: null,
    generated_images: null,
    hero_image_url: null,
  };

  // Schema.org structured data
  const businessInput = toBusinessInput(site, location);
  const locationInput = toLocationInput(location);
  const siteUrl = getSiteUrl(businessInput);

  const localBusinessSchema = buildLocalBusinessSchema(businessInput, locationInput, {
    areaServed: {
      '@type': 'City',
      name: serviceArea.name,
      ...(serviceArea.state && {
        containedInPlace: { '@type': 'State', name: serviceArea.state },
      }),
    },
  });

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: siteUrl + paths.locationHome(locationSlug) },
    { name: 'Service Areas', url: siteUrl + paths.areasIndex(locationSlug) },
    { name: serviceArea.name, url: siteUrl + paths.townPage(serviceArea.slug, locationSlug) },
  ]);

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[localBusinessSchema, breadcrumbSchema]} />

      <SiteHeader site={site} primaryLocation={location} categories={navCategories} siteSlug={siteSlug} locationSlug={locationSlug} />

      <main>
        <HeroSection
          site={site}
          primaryLocation={location}
          pageContent={pageContent}
          services={services}
          formCategories={formCategories}
          schedulingActive={schedulingActive}
          ctaStyle={ctaStyle}
          ctaColor={ctaColor}
          secondaryColor={accentColor}
          primaryCategoryName={primaryCategoryName}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />
        <TrustBar
          brandColor={accentColor}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />
        {/* The full main service list — identical on every town page */}
        {mainServices.length > 0 && (
          <section className="py-16">
            <div className="mx-auto max-w-7xl px-4">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900">
                  {primaryCategoryName} services in {areaName}
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-gray-600">
                  Everything we do, available in {serviceArea.name}.
                </p>
              </div>
              <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mainServices.map((m) => (
                  <Link key={m.id} href={townServiceHref(m, serviceArea.slug, promoted)}>
                    <Card className="group h-full cursor-pointer border-gray-200 transition-all hover:border-gray-300 hover:shadow-lg">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${brandColor}15` }}>
                            {m.kind === 'category' ? <Layers className="h-5 w-5" style={{ color: brandColor }} /> : <Wrench className="h-5 w-5" style={{ color: brandColor }} />}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 group-hover:underline">{m.name}</h3>
                            {m.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{m.description}</p>}
                            <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium" style={{ color: brandColor }}>
                              {m.kind === 'category' ? 'View services' : 'Learn more'}
                              <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
        <LocalizedContentSection
          pageContent={pageContent}
          businessName={site.name}
          city={serviceArea.name}
        />
        <RecentWorkSection workItems={recentWorkItems ?? []} brandColor={accentColor} siteSlug={siteSlug} locationSlug={locationSlug} />
        <UnifiedLeadForm
          siteId={site.id}
          accentColor={ctaColor}
          categories={formCategories}
          schedulingActive={schedulingActive}
          ctaStyle={ctaStyle}
          variant="section"
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
        <EmbeddedMapSection primaryLocation={location} mapQuery={`${serviceArea.name}${areaState ? `, ${areaState}` : ''}`} />
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
