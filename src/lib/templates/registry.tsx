import type { TemplateId } from '@/types/database';

// ---- local-service-pro (the baseline / fallback template) ----
import { LocalServiceProTemplate } from '@/components/templates/local-service-pro';
import { ServicePage } from '@/components/templates/local-service-pro/service-page';
import { CategoryPage } from '@/components/templates/local-service-pro/category-page';
import { ServicesPage } from '@/components/templates/local-service-pro/services-page';
import { AboutPage } from '@/components/templates/local-service-pro/about-page';
import { ContactPage } from '@/components/templates/local-service-pro/contact-page';
import { WorkHubPage } from '@/components/templates/local-service-pro/work-hub-page';
import { WorkDetailPage } from '@/components/templates/local-service-pro/work-detail-page';
import { ServiceAreasListingPage } from '@/components/templates/local-service-pro/service-areas-listing-page';
import { ServiceAreaPage } from '@/components/templates/local-service-pro/service-area-page';
import { NeighborhoodPage } from '@/components/templates/local-service-pro/neighborhood-page';
import { NeighborhoodPageSingleLocation } from '@/components/templates/local-service-pro/neighborhood-page-single';
import { BrandsListingPage } from '@/components/templates/local-service-pro/brands-listing-page';
import { BrandDetailPage } from '@/components/templates/local-service-pro/brand-detail-page';
import { FAQHubPage } from '@/components/templates/local-service-pro/faq-hub-page';
import { ReviewsPage } from '@/components/templates/local-service-pro/reviews-page';
import { LocationPage } from '@/components/templates/local-service-pro/location-page';

// ---- premium (overrides only what it has built; rest falls back) ----
import { PremiumTemplate } from '@/components/templates/premium';
import { PremiumServicePage } from '@/components/templates/premium/service-page';
import { PremiumAboutPage } from '@/components/templates/premium/about-page';
import { PremiumContactPage } from '@/components/templates/premium/contact-page';
import { PremiumWorkHubPage } from '@/components/templates/premium/work-hub-page';
import { PremiumCategoryPage } from '@/components/templates/premium/category-page';
import { PremiumServicesPage } from '@/components/templates/premium/services-page';
import { PremiumServiceAreasListingPage } from '@/components/templates/premium/service-areas-listing-page';
import { PremiumServiceAreaPage } from '@/components/templates/premium/service-area-page';
import { PremiumBrandsListingPage } from '@/components/templates/premium/brands-listing-page';
import { PremiumBrandDetailPage } from '@/components/templates/premium/brand-detail-page';
import { PremiumFAQHubPage } from '@/components/templates/premium/faq-hub-page';
import { PremiumReviewsPage } from '@/components/templates/premium/reviews-page';
import { PremiumNeighborhoodPage } from '@/components/templates/premium/neighborhood-page';
import { PremiumNeighborhoodPageSingleLocation } from '@/components/templates/premium/neighborhood-page-single';
import { PremiumLocationPage } from '@/components/templates/premium/location-page';
import { PremiumWorkDetailPage } from '@/components/templates/premium/work-detail-page';

/**
 * A TemplateComponents set maps each page "role" to the component that renders
 * it. The baseline `local-service-pro` set is fully populated; other templates
 * provide a PARTIAL set and the resolver fills the gaps from the baseline.
 *
 * Every slot is typed against the baseline component, so any template entry is
 * guaranteed to share the exact same props — routes never need per-template code.
 */
export interface TemplateComponents {
  Home: typeof LocalServiceProTemplate;
  Service: typeof ServicePage;
  Category: typeof CategoryPage;
  Services: typeof ServicesPage;
  About: typeof AboutPage;
  Contact: typeof ContactPage;
  WorkHub: typeof WorkHubPage;
  WorkDetail: typeof WorkDetailPage;
  AreasListing: typeof ServiceAreasListingPage;
  Area: typeof ServiceAreaPage;
  Neighborhood: typeof NeighborhoodPage;
  NeighborhoodSingle: typeof NeighborhoodPageSingleLocation;
  BrandsListing: typeof BrandsListingPage;
  BrandDetail: typeof BrandDetailPage;
  FAQ: typeof FAQHubPage;
  Reviews: typeof ReviewsPage;
  Location: typeof LocationPage;
}

const BASELINE: TemplateComponents = {
  Home: LocalServiceProTemplate,
  Service: ServicePage,
  Category: CategoryPage,
  Services: ServicesPage,
  About: AboutPage,
  Contact: ContactPage,
  WorkHub: WorkHubPage,
  WorkDetail: WorkDetailPage,
  AreasListing: ServiceAreasListingPage,
  Area: ServiceAreaPage,
  Neighborhood: NeighborhoodPage,
  NeighborhoodSingle: NeighborhoodPageSingleLocation,
  BrandsListing: BrandsListingPage,
  BrandDetail: BrandDetailPage,
  FAQ: FAQHubPage,
  Reviews: ReviewsPage,
  Location: LocationPage,
};

/**
 * Per-template overrides. A template lists ONLY the page roles it has built.
 * Anything omitted is served by the baseline `local-service-pro` component, so
 * a half-built template still renders every page (no broken routes).
 */
const OVERRIDES: Record<TemplateId, Partial<TemplateComponents>> = {
  'local-service-pro': {},
  premium: {
    Home: PremiumTemplate,
    Service: PremiumServicePage,
    About: PremiumAboutPage,
    Contact: PremiumContactPage,
    WorkHub: PremiumWorkHubPage,
    Category: PremiumCategoryPage,
    Services: PremiumServicesPage,
    AreasListing: PremiumServiceAreasListingPage,
    Area: PremiumServiceAreaPage,
    BrandsListing: PremiumBrandsListingPage,
    BrandDetail: PremiumBrandDetailPage,
    FAQ: PremiumFAQHubPage,
    Reviews: PremiumReviewsPage,
    Neighborhood: PremiumNeighborhoodPage,
    NeighborhoodSingle: PremiumNeighborhoodPageSingleLocation,
    Location: PremiumLocationPage,
    WorkDetail: PremiumWorkDetailPage,
    // Full coverage — every page type now has a premium component.
  },
};

/**
 * Resolve the component set for a site's template_id, with baseline fallback.
 * Use in route files: `const T = getTemplate(site.template_id); <T.Home .../>`
 */
export function getTemplate(templateId: TemplateId | null | undefined): TemplateComponents {
  const overrides = OVERRIDES[(templateId ?? 'local-service-pro') as TemplateId] ?? {};
  return { ...BASELINE, ...overrides };
}
