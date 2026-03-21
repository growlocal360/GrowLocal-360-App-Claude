'use client';

import type { PublicRenderSite, PublicRenderLocation, PublicRenderServiceListing, PublicRenderCategory, PublicRenderReview, PublicRenderAreaListing, PublicRenderNeighborhoodListing, PublicRenderPageContent, PublicRenderWorkItem } from '@/lib/sites/public-render-model';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import * as paths from '@/lib/routing/paths';
import {
  JsonLd,
  buildServiceSchema,
  buildBreadcrumbSchema,
  getSiteUrl,
  toBusinessInput,
  toLocationInput,
} from '@/lib/schema';
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
import { RecentWorkSection } from './about/recent-work-section';

interface CategoryPageProps {
  data: {
    site: PublicRenderSite;
    location: PublicRenderLocation;
    category: PublicRenderCategory;
    services: PublicRenderServiceListing[];
    allCategories: PublicRenderCategory[];
    pageContent?: PublicRenderPageContent | null;
  };
  siteSlug: string;
  googleReviews?: PublicRenderReview[];
  serviceAreas?: PublicRenderAreaListing[];
  neighborhoods?: PublicRenderNeighborhoodListing[];
  recentWorkItems?: PublicRenderWorkItem[];
  locationSlug?: string;
}

export function CategoryPage({ data, siteSlug, googleReviews, serviceAreas, neighborhoods, recentWorkItems, locationSlug }: CategoryPageProps) {
  const { site, location, category, services, allCategories, pageContent } = data;
  const brandColor = site.settings?.brand_color || '#00ef99';
  const averageRating = site.settings?.google_average_rating as number | undefined;
  const totalReviewCount = site.settings?.google_total_reviews as number | undefined;
  const categorySlug = normalizeCategorySlug(category.gbp_category.display_name);

  const categoryName = category.gbp_category.display_name;

  const navCategories: NavCategory[] = allCategories.map(c => ({
    id: c.id,
    name: c.gbp_category.display_name,
    slug: normalizeCategorySlug(c.gbp_category.display_name),
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
  } as PublicRenderPageContent;

  // Schema.org structured data
  const businessInput = toBusinessInput(site, location);
  const locationInput = toLocationInput(location);
  const siteUrl = getSiteUrl(businessInput);

  const serviceSchema = buildServiceSchema(
    { name: categoryName, slug: categorySlug, description: `Professional ${categoryName.toLowerCase()} services in ${location.city}, ${location.state}`, categoryName },
    businessInput,
    locationInput,
    { serviceUrl: siteUrl + paths.categoryPage(categorySlug, category.is_primary, locationSlug) }
  );

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: siteUrl + paths.locationHome(locationSlug) },
    { name: categoryName, url: siteUrl + paths.categoryPage(categorySlug, category.is_primary, locationSlug) },
  ]);

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[serviceSchema, breadcrumbSchema]} />

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
        <RecentWorkSection workItems={recentWorkItems ?? []} brandColor={brandColor} siteSlug={siteSlug} locationSlug={locationSlug} />
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
