'use client';

import type { PublicRenderData, PublicRenderServiceListing, PublicRenderWorkItem, PublicRenderCategory } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';
import {
  JsonLd,
  buildLocalBusinessSchema,
  buildWebSiteSchema,
  toBusinessInput,
  toLocationInput,
} from '@/lib/schema';
import { SiteHeader, NavCategory } from './site-header';
import { HeroSection } from './hero-section';
import { TrustBar } from './trust-bar';
import { ServicesPreview } from './services-preview';
import { LocalizedContentSection } from './localized-content-section';
import { UnifiedLeadForm } from './unified-lead-form';
import { TestimonialsSection } from './testimonials-section';
import { BrandsSection } from './brands-section';
import { ServiceAreasSection } from './service-areas-section';
import { EmbeddedMapSection } from './embedded-map-section';
import { SiteFooter } from './site-footer';
import { RecentWorkSection } from './about/recent-work-section';

interface LocalServiceProTemplateProps {
  data: PublicRenderData;
  siteSlug?: string;
  services?: PublicRenderServiceListing[];
  primaryCategorySlug?: string;
  primaryCategoryName?: string;
  categories?: NavCategory[];
  secondaryCategories?: NavCategory[];
  locationSlug?: string;
  recentWorkItems?: PublicRenderWorkItem[];
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  showAvailabilityBadge?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function LocalServiceProTemplate({ data, siteSlug, services, primaryCategorySlug, primaryCategoryName, categories, secondaryCategories, locationSlug, recentWorkItems, formCategories, schedulingActive = false, showAvailabilityBadge = true, ctaStyle = 'booking' }: LocalServiceProTemplateProps) {
  const { site, locations, serviceAreas, neighborhoods, sitePages, reviews, brands, primaryLocation } = data;
  const slug = siteSlug || site.slug;
  const brandColor = site.settings?.brand_color || '#00ef99';
  const secondaryColor = site.settings?.secondary_color || brandColor;
  const ctaColor = site.settings?.cta_color || brandColor;
  const averageRating = site.settings?.google_average_rating as number | undefined;
  const totalReviewCount = site.settings?.google_total_reviews as number | undefined;

  // Find home page content from sitePages (already filtered to page content objects)
  const homePageContent = sitePages?.[0] || null;

  // Schema.org structured data
  const businessInput = primaryLocation ? toBusinessInput(site, primaryLocation) : null;
  const locationInput = primaryLocation ? toLocationInput(primaryLocation) : null;
  const schemaReviews = (reviews || [])
    .filter(r => r.comment)
    .map(r => ({ authorName: r.author_name, text: r.comment, rating: r.rating }));
  const localBusinessSchema = businessInput && locationInput
    ? buildLocalBusinessSchema(businessInput, locationInput, {
        reviews: schemaReviews.length > 0 ? schemaReviews : undefined,
      })
    : null;
  const webSiteSchema = businessInput ? buildWebSiteSchema(businessInput) : null;

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[localBusinessSchema, webSiteSchema]} />
      <SiteHeader site={site} primaryLocation={primaryLocation} categories={categories} siteSlug={slug} locationSlug={locationSlug} />
      <main>
        <HeroSection
          site={site}
          primaryLocation={primaryLocation}
          pageContent={homePageContent}
          services={services}
          formCategories={formCategories}
          schedulingActive={schedulingActive}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
          primaryCategoryName={primaryCategoryName}
          showAvailabilityBadge={showAvailabilityBadge}
          ctaStyle={ctaStyle}
          ctaColor={ctaColor}
          secondaryColor={secondaryColor}
        />
        <TrustBar
          siteId={site.id}
          brandColor={secondaryColor}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
          schedulingActive={schedulingActive}
        />
        {((services && services.length > 0) || (secondaryCategories && secondaryCategories.length > 0)) && (
          <ServicesPreview
            site={site}
            services={services || []}
            primaryLocation={primaryLocation}
            siteSlug={slug}
            categorySlug={primaryCategorySlug}
            isPrimaryCategory={true}
            secondaryCategories={secondaryCategories}
            locationSlug={locationSlug}
          />
        )}
        <LocalizedContentSection
          pageContent={homePageContent}
          businessName={site.name}
          city={primaryLocation?.city || ''}
        />
        <BrandsSection
          site={site}
          primaryLocation={primaryLocation}
          brands={brands}
          siteSlug={slug}
          locationSlug={locationSlug}
        />
        <RecentWorkSection workItems={recentWorkItems ?? []} brandColor={secondaryColor} siteSlug={slug} locationSlug={locationSlug} />
        <UnifiedLeadForm
          siteId={site.id}
          brandColor={ctaColor}
          categories={formCategories}
          schedulingActive={schedulingActive}
          ctaStyle={ctaStyle}
          variant="section"
        />
        <TestimonialsSection
          city={primaryLocation?.city || 'Our'}
          reviews={reviews}
          averageRating={averageRating}
          totalReviewCount={totalReviewCount}
          reviewsHref={paths.reviewsIndex(locationSlug)}
          brandColor={secondaryColor}
        />
        {(serviceAreas.length > 0 || neighborhoods.length > 0) && (
          <ServiceAreasSection
            site={site}
            serviceAreas={serviceAreas}
            neighborhoods={neighborhoods}
            siteSlug={slug}
            locationSlug={locationSlug}
          />
        )}
        <EmbeddedMapSection primaryLocation={primaryLocation} />
      </main>
      <SiteFooter
        site={site}
        primaryLocation={primaryLocation}
        serviceAreas={serviceAreas}
        siteSlug={slug}
        locationSlug={locationSlug}
      />
    </div>
  );
}
