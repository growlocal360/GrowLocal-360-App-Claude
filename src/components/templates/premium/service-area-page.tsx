'use client';

import Link from 'next/link';
import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderAreaDetail,
  PublicRenderAreaListing, PublicRenderServiceListing, PublicRenderCategory,
  PublicRenderReview, PublicRenderWorkItem,
} from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildBreadcrumbSchema } from '@/lib/schema';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { UnifiedLeadForm } from '@/components/templates/local-service-pro/unified-lead-form';
import { PremiumShell, PremiumPageHero, PremiumFinalCta, PremiumRecentWork } from './shell';
import { PmIconWrench, PmIconArrow, PmIconStar, PmIconShield, PmIconClock, PmIconPin } from './icons';

interface PremiumServiceAreaPageProps {
  data: {
    site: PublicRenderSite;
    location: PublicRenderLocation;
    serviceArea: PublicRenderAreaDetail;
    allServiceAreas: PublicRenderAreaListing[];
    services: PublicRenderServiceListing[];
    categories: PublicRenderCategory[];
  };
  siteSlug: string;
  googleReviews?: PublicRenderReview[];
  recentWorkItems?: PublicRenderWorkItem[];
  locationSlug?: string;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function PremiumServiceAreaPage({
  data, siteSlug, locationSlug, recentWorkItems, formCategories, schedulingActive = false, ctaStyle = 'booking',
}: PremiumServiceAreaPageProps) {
  const { site, location, serviceArea, allServiceAreas, services, categories } = data;
  const ctaColor = site.settings?.cta_color || site.settings?.brand_color || '#00ef99';
  const phone = site.settings?.phone || location?.phone;
  const areaName = serviceArea.state ? `${serviceArea.name}, ${serviceArea.state}` : serviceArea.name;
  const primaryCategory = categories.find(c => c.is_primary) || categories[0];
  const primaryCatSlug = primaryCategory ? normalizeCategorySlug(primaryCategory.gbp_category?.display_name || '') : undefined;

  const h1 = serviceArea.h1 || `Service in ${areaName}`;
  const intro = serviceArea.body_copy || `${site.name} proudly serves ${areaName} and the surrounding area.`;

  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: 'Service Areas', url: paths.areasIndex(locationSlug) },
    { name: serviceArea.name, url: paths.areaPage(serviceArea.slug, locationSlug) },
  ]);

  return (
    <PremiumShell site={site} primaryLocation={location} serviceAreas={allServiceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[breadcrumb]} />
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: 'Service Areas', href: paths.areasIndex(locationSlug) }, { label: serviceArea.name }]}
        eyebrow="Service Area"
        title={h1}
        accent={areaName}
        lede={undefined}
      />
      <section className="pm-block">
        <div className="pm-wrap pm-layout">
          <div className="pm-prose">
            {intro.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
            {services.length > 0 && (
              <>
                <h2>Services we offer in {serviceArea.name}</h2>
                <div className="pm-grid3" style={{ marginTop: 20 }}>
                  {services.slice(0, 6).map(s => (
                    <Link key={s.id} className="pm-card" href={paths.servicePage(s.slug, primaryCatSlug, true, locationSlug)}>
                      <span className="pm-icon"><PmIconWrench /></span>
                      <h3>{s.name}</h3>
                      {s.description && <p>{s.description}</p>}
                      <span className="pm-more">Learn more <PmIconArrow /></span>
                    </Link>
                  ))}
                </div>
              </>
            )}
            {allServiceAreas.length > 1 && (
              <>
                <h3>Other areas we serve</h3>
                <div className="pm-areas" style={{ marginTop: 12 }}>
                  {allServiceAreas.filter(a => a.id !== serviceArea.id).map(a => (
                    <Link key={a.id} className="pm-chip" href={paths.areaPage(a.slug, locationSlug)}><span className="pm-pin"><PmIconPin /></span>{a.state ? `${a.name}, ${a.state}` : a.name}</Link>
                  ))}
                </div>
              </>
            )}
          </div>
          <aside>
            <div className="pm-aside" id="pm-form">
              <UnifiedLeadForm siteId={site.id} accentColor={ctaColor} categories={formCategories} schedulingActive={schedulingActive} ctaStyle={ctaStyle} variant="hero" />
              <div className="pm-asidetrust">
                <div className="pm-t"><span className="pm-ic"><PmIconStar /></span>Trusted in {serviceArea.name}</div>
                <div className="pm-t"><span className="pm-ic"><PmIconShield /></span>Satisfaction guaranteed</div>
                <div className="pm-t"><span className="pm-ic"><PmIconClock /></span>Fast response times</div>
              </div>
            </div>
          </aside>
        </div>
      </section>
      <PremiumRecentWork items={recentWorkItems} locationSlug={locationSlug} title={`Recent work in ${serviceArea.name}`} />

      <PremiumFinalCta heading={`Serving ${areaName}`} sub={`Book your appointment with ${site.name} today.`} ctaStyle={ctaStyle} phone={phone} />
    </PremiumShell>
  );
}
