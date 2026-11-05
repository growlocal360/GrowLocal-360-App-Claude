'use client';

import Link from 'next/link';
import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderAreaDetail,
  PublicRenderAreaListing, PublicRenderServiceListing, PublicRenderCategory,
  PublicRenderReview, PublicRenderWorkItem,
} from '@/lib/sites/public-render-model';
import type { MainServiceEntry } from '@/lib/sites/main-service-list';
import { townServiceHref } from '@/lib/sites/main-service-list';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildBreadcrumbSchema, buildLocalBusinessSchema, toBusinessInput, toLocationInput } from '@/lib/schema';
import { UnifiedLeadForm } from '@/components/templates/local-service-pro/unified-lead-form';
import { useCtaLabel } from '@/components/templates/site-form-config';
import { PremiumShell, PremiumPageHero, PremiumFinalCta, PremiumRecentWork } from './shell';
import { PmIconWrench, PmIconLayers, PmIconArrow, PmIconStar, PmIconShield, PmIconClock, PmIconPin, PmIconPhone, PmIconCheck } from './icons';
import { PremiumCityMap } from './city-map';

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

export function PremiumServiceAreaPage({
  data, siteSlug, locationSlug, googleReviews = [], recentWorkItems, recentWorkTitle, intro, workItemsCount = 0,
  formCategories, schedulingActive = false, ctaStyle = 'booking',
}: ServiceAreaPageProps) {
  const { site, location, serviceArea, allServiceAreas, mainServices, promoted, primaryCategoryName } = data;
  const ctaColor = site.settings?.cta_color || site.settings?.brand_color || '#00ef99';
  const phone = site.settings?.phone || location?.phone;
  const phoneHref = phone ? `tel:${phone.replace(/\D/g, '')}` : undefined;
  const ctaLabel = useCtaLabel(ctaStyle);
  const city = serviceArea.name;
  const state = serviceArea.state || location?.state || '';
  const areaName = state ? `${city}, ${state}` : city;
  const averageRating = site.settings?.google_average_rating ?? null;
  const totalReviews = site.settings?.google_total_reviews ?? null;

  const h1 = serviceArea.h1 || `${primaryCategoryName} in ${areaName}`;
  const bodyParagraphs = (serviceArea.body_copy || '').split('\n\n').map((p) => p.trim()).filter(Boolean);
  const lede = intro || undefined;
  const reviews = googleReviews.filter((r) => r.comment).slice(0, 3);
  const otherTowns = allServiceAreas.filter((a) => a.id !== serviceArea.id);

  const businessInput = toBusinessInput(site, location);
  const localBusiness = buildLocalBusinessSchema(businessInput, toLocationInput(location), {
    areaServed: { '@type': 'City', name: city, ...(state ? { containedInPlace: { '@type': 'State', name: state } } : {}) },
  });
  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: 'Service Areas', url: paths.serviceAreasIndex(locationSlug) },
    { name: city, url: paths.townPage(serviceArea.slug, locationSlug) },
  ]);

  const proof = (
    <div className="pm-proof">
      {averageRating ? (
        <span className="pm-pill"><span className="pm-ic"><PmIconStar /></span>{averageRating.toFixed(1)}-star rated{totalReviews ? ` · ${totalReviews} Google review${totalReviews === 1 ? '' : 's'}` : ''}</span>
      ) : null}
      {workItemsCount > 0 && (
        <span className="pm-pill"><span className="pm-ic"><PmIconLayers /></span>{workItemsCount} job{workItemsCount === 1 ? '' : 's'} documented</span>
      )}
      <span className="pm-pill"><span className="pm-ic"><PmIconPin /></span>{promoted ? `Our ${city} location` : `Serving ${city}`}</span>
    </div>
  );

  return (
    <PremiumShell site={site} primaryLocation={location} serviceAreas={allServiceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[localBusiness, breadcrumb]} />
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: 'Service Areas', href: paths.serviceAreasIndex(locationSlug) }, { label: city }]}
        title={h1}
        accent={city}
        lede={lede}
      >
        {proof}
        <div className="pm-callrow">
          {phoneHref && <a className="pm-btn pm-btn-brand pm-btn-xl" href={phoneHref}><PmIconPhone style={{ width: 20, height: 20 }} /> Call Now · {phone}</a>}
          <a className={`pm-btn ${phoneHref ? 'pm-btn-ghost' : 'pm-btn-brand'} pm-btn-lg`} href="#pm-form">{ctaLabel} <PmIconArrow /></a>
        </div>
      </PremiumPageHero>

      <section className="pm-block">
        <div className="pm-wrap pm-layout">
          <div>
            {/* The full main service list — identical on every town page */}
            {mainServices.length > 0 && (
              <>
                <div className="pm-sechead" style={{ marginBottom: 20 }}>
                  <span className="pm-eyebrow">What we do</span>
                  <h2>{primaryCategoryName} services in {city}</h2>
                </div>
                <div className="pm-grid3">
                  {mainServices.map((m) => (
                    <Link key={m.id} className="pm-card" href={townServiceHref(m, serviceArea.slug, promoted)}>
                      <span className="pm-icon">{m.kind === 'category' ? <PmIconLayers /> : <PmIconWrench />}</span>
                      <h3>{m.name}</h3>
                      {m.description && <p>{m.description}</p>}
                      <span className="pm-more">{m.kind === 'category' ? 'View services' : 'Learn more'} <PmIconArrow /></span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {/* This town's own copy */}
            {bodyParagraphs.length > 0 && (
              <div className="pm-prose" style={{ marginTop: 44 }}>
                {bodyParagraphs.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            )}

            {otherTowns.length > 0 && (
              <div style={{ marginTop: 40 }}>
                <h3>Other areas we serve</h3>
                <div className="pm-areas" style={{ marginTop: 12 }}>
                  {otherTowns.map((a) => {
                    const label = <><span className="pm-pin"><PmIconPin /></span>{a.state ? `${a.name}, ${a.state}` : a.name}</>;
                    return a.pageUrl
                      ? <Link key={a.id} className="pm-chip" href={a.pageUrl}>{label}</Link>
                      : <span key={a.id} className="pm-chip pm-chip-static">{label}</span>;
                  })}
                </div>
              </div>
            )}
          </div>

          <aside>
            <div className="pm-asidestack">
              <div className="pm-aside" id="pm-form">
                <UnifiedLeadForm siteId={site.id} accentColor={ctaColor} categories={formCategories} schedulingActive={schedulingActive} ctaStyle={ctaStyle} variant="hero" />
                <div className="pm-asidetrust">
                  <div className="pm-t"><span className="pm-ic"><PmIconCheck /></span>{promoted ? `Based in ${city}` : `Serving ${city} and nearby`}</div>
                  <div className="pm-t"><span className="pm-ic"><PmIconShield /></span>Satisfaction guaranteed</div>
                  <div className="pm-t"><span className="pm-ic"><PmIconClock /></span>Fast response times</div>
                </div>
              </div>
              <PremiumCityMap city={city} state={state} />
            </div>
          </aside>
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="pm-block pm-dark">
          <div className="pm-wrap">
            <div className="pm-sechead">
              <span className="pm-eyebrow">Reviews</span>
              <h2>What {city} customers say</h2>
            </div>
            <div className="pm-grid3">
              {reviews.map((r, i) => (
                <div key={i} className="pm-tstcard">
                  <div className="pm-stars">{'★★★★★'.slice(0, Math.max(0, Math.min(5, r.rating || 5)))}</div>
                  <div className="pm-quote">&ldquo;{r.comment}&rdquo;</div>
                  <div className="pm-who"><div className="pm-av">{(r.author_name || 'G')[0]}</div><div><div className="pm-nm">{r.author_name || 'Google customer'}</div><div className="pm-mt">Google review</div></div></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <PremiumRecentWork items={recentWorkItems} locationSlug={locationSlug} title={recentWorkTitle || `Recent work in ${city}`} />

      <PremiumFinalCta heading={`Need ${primaryCategoryName.toLowerCase()} in ${city}?`} sub={`Call ${phone || 'us'} or send the form. We reply during business hours.`} ctaStyle={ctaStyle} phone={phone} />
    </PremiumShell>
  );
}
