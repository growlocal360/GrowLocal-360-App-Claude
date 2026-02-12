'use client';

import type { SiteWithRelations, Location, Service, SiteCategory, GBPCategory, GoogleReview, ServiceAreaDB, Neighborhood, SitePage } from '@/types/database';
import { categorySlugFromName } from '@/lib/sites/get-services';
import * as paths from '@/lib/routing/paths';
import { SiteHeader, NavCategory } from './site-header';
import { HeroSection } from './hero-section';
import { TrustBar } from './trust-bar';
import { ServicesPreview } from './services-preview';
import { LocalizedContentSection } from './localized-content-section';
import { LeadCaptureSection } from './lead-capture-section';
import { TestimonialsSection } from './testimonials-section';
import { ServiceAreasSection } from './service-areas-section';
import { EmbeddedMapSection } from './embedded-map-section';
import { SiteFooter } from './site-footer';

interface CategoryPageProps {
  data: {
    site: SiteWithRelations;
    location: Location;
    category: SiteCategory & { gbp_category: GBPCategory };
    services: Service[];
    allCategories: (SiteCategory & { gbp_category: GBPCategory })[];
    pageContent?: {
      meta_title?: string | null;
      meta_description?: string | null;
      h1?: string | null;
      h2?: string | null;
      hero_description?: string | null;
      body_copy?: string | null;
      body_copy_2?: string | null;
    } | null;
  };
  siteSlug: string;
  googleReviews?: GoogleReview[];
  serviceAreas?: ServiceAreaDB[];
  neighborhoods?: Neighborhood[];
  locationSlug?: string;
}

export function CategoryPage({ data, siteSlug, googleReviews, serviceAreas, neighborhoods, locationSlug }: CategoryPageProps) {
  const { site, location, category, services, allCategories, pageContent } = data;
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const averageRating = site.settings?.google_average_rating as number | undefined;
  const totalReviewCount = site.settings?.google_total_reviews as number | undefined;
  const categorySlug = categorySlugFromName(category.gbp_category.display_name);

  const categoryName = category.gbp_category.display_name;

  const navCategories: NavCategory[] = allCategories.map(c => ({
    name: c.gbp_category.display_name,
    slug: categorySlugFromName(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

  // Construct a SitePage-like object from the category's pageContent for section components
  const categoryH1 = `${categoryName} in ${location.city}, ${location.state} - ${site.name}`;
  const sitePageContent = {
    h1: pageContent?.h1 || categoryH1,
    h2: pageContent?.h2 || null,
    hero_description: pageContent?.hero_description || null,
    body_copy: pageContent?.body_copy || null,
    body_copy_2: pageContent?.body_copy_2 || null,
  } as SitePage;

  // Schema.org
  const phone = site.settings?.phone || location.phone;
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: categoryName,
    description: `Professional ${categoryName.toLowerCase()} services in ${location.city}, ${location.state}`,
    provider: {
      '@type': 'LocalBusiness',
      name: site.name,
      telephone: phone,
    },
    areaServed: {
      '@type': 'City',
      name: `${location.city}, ${location.state}`,
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
          pageContent={sitePageContent}
          services={services}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />
        <TrustBar
          brandColor={brandColor}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />
        {services.length > 0 && (
          <ServicesPreview
            site={site}
            services={services}
            primaryLocation={location}
            siteSlug={siteSlug}
            categorySlug={categorySlug}
            locationSlug={locationSlug}
          />
        )}
        <LocalizedContentSection
          pageContent={sitePageContent}
          businessName={site.name}
          city={location.city}
        />
        <LeadCaptureSection
          siteId={site.id}
          brandColor={brandColor}
          services={services}
        />
        <TestimonialsSection
          city={location.city}
          reviews={googleReviews}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />
        {(serviceAreas && serviceAreas.length > 0 || neighborhoods && neighborhoods.length > 0) && (
          <ServiceAreasSection
            site={site}
            serviceAreas={serviceAreas || []}
            neighborhoods={neighborhoods}
            siteSlug={siteSlug}
            locationSlug={locationSlug}
          />
        )}
        <EmbeddedMapSection primaryLocation={location} />
      </main>

      <SiteFooter
        site={site}
        primaryLocation={location}
        serviceAreas={serviceAreas}
        siteSlug={siteSlug}
        locationSlug={locationSlug}
      />
    </div>
  );
}
