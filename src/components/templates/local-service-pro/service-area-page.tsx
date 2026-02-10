'use client';

import type { GoogleReview, Neighborhood, SitePage } from '@/types/database';
import type { ServiceAreaPageData } from '@/lib/sites/get-service-areas';
import { categorySlugFromName } from '@/lib/sites/get-services';
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

interface ServiceAreaPageProps {
  data: ServiceAreaPageData;
  siteSlug: string;
  googleReviews?: GoogleReview[];
  neighborhoods?: Neighborhood[];
}

export function ServiceAreaPage({ data, siteSlug, googleReviews, neighborhoods }: ServiceAreaPageProps) {
  const { site, location, serviceArea, allServiceAreas, services, categories } = data;
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const averageRating = site.settings?.google_average_rating as number | undefined;
  const totalReviewCount = site.settings?.google_total_reviews as number | undefined;
  const industry = site.settings?.core_industry || 'Professional Services';

  // Get primary category slug for service links
  const primaryCategory = categories.find(c => c.is_primary) || categories[0];
  const primaryCategorySlug = primaryCategory ? categorySlugFromName(primaryCategory.gbp_category.display_name) : undefined;
  const primaryCategoryName = primaryCategory?.gbp_category.display_name || industry;

  const navCategories: NavCategory[] = categories.map(c => ({
    name: c.gbp_category.display_name,
    slug: categorySlugFromName(c.gbp_category.display_name),
    isPrimary: c.is_primary,
  }));

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

      <SiteHeader site={site} primaryLocation={location} categories={navCategories} siteSlug={siteSlug} />

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
        {services.length > 0 && (
          <ServicesPreview
            site={site}
            services={services}
            primaryLocation={location}
            siteSlug={siteSlug}
            categorySlug={primaryCategorySlug}
          />
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
        {(allServiceAreas.length > 0 || (neighborhoods && neighborhoods.length > 0)) && (
          <ServiceAreasSection
            site={site}
            serviceAreas={allServiceAreas}
            neighborhoods={neighborhoods}
            siteSlug={siteSlug}
          />
        )}
        <EmbeddedMapSection primaryLocation={location} />
      </main>

      <SiteFooter
        site={site}
        primaryLocation={location}
        serviceAreas={allServiceAreas}
        siteSlug={siteSlug}
      />
    </div>
  );
}
