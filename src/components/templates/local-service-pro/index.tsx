'use client';

import { PublicSiteData } from '@/lib/sites/get-site';
import type { Service } from '@/types/database';
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

interface LocalServiceProTemplateProps {
  data: PublicSiteData;
  siteSlug?: string;
  services?: Service[];
  primaryCategorySlug?: string;
  categories?: NavCategory[];
}

export function LocalServiceProTemplate({ data, siteSlug, services, primaryCategorySlug, categories }: LocalServiceProTemplateProps) {
  const { site, locations, serviceAreas, neighborhoods, sitePages, googleReviews, primaryLocation } = data;
  const slug = siteSlug || site.slug;
  const brandColor = site.settings?.brand_color || '#00d9c0';
  const averageRating = site.settings?.google_average_rating as number | undefined;
  const totalReviewCount = site.settings?.google_total_reviews as number | undefined;

  // Find home page content from sitePages
  const homePageContent = sitePages?.find(p => p.page_type === 'home') || null;

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader site={site} primaryLocation={primaryLocation} categories={categories} siteSlug={slug} />
      <main>
        <HeroSection
          site={site}
          primaryLocation={primaryLocation}
          pageContent={homePageContent}
          services={services}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />
        <TrustBar
          brandColor={brandColor}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />
        {services && services.length > 0 && (
          <ServicesPreview
            site={site}
            services={services}
            primaryLocation={primaryLocation}
            siteSlug={slug}
            categorySlug={primaryCategorySlug}
          />
        )}
        <LocalizedContentSection
          pageContent={homePageContent}
          businessName={site.name}
          city={primaryLocation?.city || ''}
        />
        <LeadCaptureSection
          siteId={site.id}
          brandColor={brandColor}
          services={services}
        />
        <TestimonialsSection
          city={primaryLocation?.city || 'Our'}
          reviews={googleReviews}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
        />
        {(serviceAreas.length > 0 || neighborhoods.length > 0) && (
          <ServiceAreasSection
            site={site}
            serviceAreas={serviceAreas}
            neighborhoods={neighborhoods}
            siteSlug={slug}
          />
        )}
        <EmbeddedMapSection primaryLocation={primaryLocation} />
      </main>
      <SiteFooter
        site={site}
        primaryLocation={primaryLocation}
        serviceAreas={serviceAreas}
        siteSlug={slug}
      />
    </div>
  );
}
