'use client';

import Link from 'next/link';
import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderCategory,
  PublicRenderServiceListing, PublicRenderPageContent, PublicRenderReview,
  PublicRenderAreaListing, PublicRenderNeighborhoodListing, PublicRenderWorkItem,
} from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildServiceSchema, buildBreadcrumbSchema, toBusinessInput, toLocationInput } from '@/lib/schema';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { UnifiedLeadForm } from '@/components/templates/local-service-pro/unified-lead-form';
import { PremiumShell, PremiumPageHero, PremiumFinalCta, PremiumRecentWork } from './shell';
import { PmIconWrench, PmIconArrow, PmIconStar, PmIconShield, PmIconClock } from './icons';

interface PremiumCategoryPageProps {
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
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function PremiumCategoryPage({
  data, siteSlug, serviceAreas = [], recentWorkItems, locationSlug, formCategories,
  schedulingActive = false, ctaStyle = 'booking',
}: PremiumCategoryPageProps) {
  const { site, location, category, services, pageContent } = data;
  const ctaColor = site.settings?.cta_color || site.settings?.brand_color || '#00ef99';
  const phone = site.settings?.phone || location?.phone;
  const cityState = location?.city ? `${location.city}${location.state ? `, ${location.state}` : ''}` : '';
  const categoryName = category.gbp_category?.display_name || 'Services';
  const categorySlug = normalizeCategorySlug(categoryName);

  const h1 = pageContent?.h1 || `${categoryName}${cityState ? ` in ${cityState}` : ''}`;
  const intro = pageContent?.hero_description || pageContent?.body_copy || `Professional ${categoryName.toLowerCase()}${cityState ? ` for ${location?.city} homeowners` : ''}.`;

  const businessInput = toBusinessInput(site, location);
  const serviceSchema = buildServiceSchema({ name: categoryName, slug: categorySlug, description: intro, categoryName }, businessInput, toLocationInput(location));
  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: categoryName, url: paths.categoryPage(categorySlug, category.is_primary, locationSlug) },
  ]);

  return (
    <PremiumShell site={site} primaryLocation={location} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[serviceSchema, breadcrumb]} />
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: categoryName }]}
        title={h1}
        accent={categoryName}
        lede={pageContent?.hero_description || undefined}
      />
      <section className="pm-block">
        <div className="pm-wrap pm-layout">
          <div className="pm-prose">
            {intro && <p>{intro}</p>}
            {pageContent?.body_copy && pageContent.body_copy !== intro && <p>{pageContent.body_copy}</p>}
            {services.length > 0 && (
              <>
                <h2>Our {categoryName.toLowerCase()} services</h2>
                <div className="pm-grid3" style={{ marginTop: 20 }}>
                  {services.map(s => (
                    <Link key={s.id} className="pm-card" href={paths.servicePage(s.slug, categorySlug, category.is_primary, locationSlug)}>
                      <span className="pm-icon"><PmIconWrench /></span>
                      <h3>{s.name}</h3>
                      {s.description && <p>{s.description}</p>}
                      <span className="pm-more">Learn more <PmIconArrow /></span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
          <aside>
            <div className="pm-aside" id="pm-form">
              <UnifiedLeadForm siteId={site.id} accentColor={ctaColor} categories={formCategories} schedulingActive={schedulingActive} ctaStyle={ctaStyle} variant="hero" />
              <div className="pm-asidetrust">
                <div className="pm-t"><span className="pm-ic"><PmIconStar /></span>5-star rated local service</div>
                <div className="pm-t"><span className="pm-ic"><PmIconShield /></span>Satisfaction guaranteed</div>
                <div className="pm-t"><span className="pm-ic"><PmIconClock /></span>Fast response times</div>
              </div>
            </div>
          </aside>
        </div>
      </section>
      <PremiumRecentWork items={recentWorkItems} locationSlug={locationSlug} title={`Recent ${categoryName.toLowerCase()} work`} />

      <PremiumFinalCta heading={`Need ${categoryName.toLowerCase()}${cityState ? ` in ${location?.city}` : ''}?`} sub="Fast response, upfront pricing, satisfaction guaranteed." ctaStyle={ctaStyle} phone={phone} />
    </PremiumShell>
  );
}
