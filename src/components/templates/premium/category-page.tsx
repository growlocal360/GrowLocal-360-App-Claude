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
import { useCtaLabel } from '@/components/templates/site-form-config';
import { PremiumShell, PremiumPageHero, PremiumFinalCta, PremiumRecentWork } from './shell';
import { PremiumCityMap } from './city-map';
import { PmIconWrench, PmIconArrow, PmIconStar, PmIconPhone, PmIconCheck, PmIconPin, PmIconLayers } from './icons';

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
  /** Total published job snaps for the site (proof strip). */
  workItemsCount?: number;
  locationSlug?: string;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

/**
 * Category hub + city pages, laid out for local lead-gen: who/where + proof +
 * Call Now first, then the problems we fix, then the page's own copy, then
 * reviews. Everything shown as proof comes from real data (GBP rating, job
 * snap count, service areas); nothing is asserted that the site can't back.
 */
export function PremiumCategoryPage({
  data, siteSlug, googleReviews = [], serviceAreas = [], recentWorkItems, workItemsCount = 0, locationSlug, formCategories,
  schedulingActive = false, ctaStyle = 'booking',
}: PremiumCategoryPageProps) {
  const { site, location, category, services, pageContent } = data;
  const ctaColor = site.settings?.cta_color || site.settings?.brand_color || '#00ef99';
  const phone = site.settings?.phone || location?.phone;
  const phoneHref = phone ? `tel:${phone.replace(/\D/g, '')}` : undefined;
  const ctaLabel = useCtaLabel(ctaStyle);
  const city = location?.city || '';
  const cityState = city ? `${city}${location.state ? `, ${location.state}` : ''}` : '';
  const categoryName = category.gbp_category?.display_name || 'Services';
  const categorySlug = normalizeCategorySlug(categoryName);
  const averageRating = site.settings?.google_average_rating ?? null;
  const totalReviews = site.settings?.google_total_reviews ?? null;

  const h1 = pageContent?.h1 || `${categoryName}${cityState ? ` in ${cityState}` : ''}`;
  // hero_description is shown once, in the hero. The body renders body_copy
  // (+ body_copy_2) as paragraphs so the lede is never printed twice.
  const lede = pageContent?.hero_description || undefined;
  const bodyParagraphs = [pageContent?.body_copy, pageContent?.body_copy_2]
    .filter((t): t is string => !!t?.trim())
    .flatMap(t => t.split('\n\n'))
    .map(p => p.trim())
    .filter(Boolean);
  const intro = lede || bodyParagraphs[0] || `${categoryName}${cityState ? ` in ${cityState}` : ''}.`;

  // "Quick solutions": the first three services, each with its generated
  // common-problem headings as bullets (description when none generated yet).
  const quick = services.slice(0, 3);
  const reviews = googleReviews.filter(r => r.comment).slice(0, 3);
  const serviceHref = (s: PublicRenderServiceListing) => paths.servicePage(s.slug, categorySlug, category.is_primary, locationSlug);

  const businessInput = toBusinessInput(site, location);
  const serviceSchema = buildServiceSchema({ name: categoryName, slug: categorySlug, description: intro, categoryName }, businessInput, toLocationInput(location));
  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: categoryName, url: paths.categoryPage(categorySlug, category.is_primary, locationSlug) },
  ]);

  const proof = (
    <div className="pm-proof">
      {averageRating ? (
        <span className="pm-pill"><span className="pm-ic"><PmIconStar /></span>{averageRating.toFixed(1)}-star rated{totalReviews ? ` · ${totalReviews} Google review${totalReviews === 1 ? '' : 's'}` : ''}</span>
      ) : null}
      {workItemsCount > 0 && (
        <span className="pm-pill"><span className="pm-ic"><PmIconLayers /></span>{workItemsCount} job{workItemsCount === 1 ? '' : 's'} documented</span>
      )}
      {city && <span className="pm-pill"><span className="pm-ic"><PmIconPin /></span>Serving {city}</span>}
    </div>
  );

  return (
    <PremiumShell site={site} primaryLocation={location} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[serviceSchema, breadcrumb]} />

      {/* 1. Who + where, proof, Call Now */}
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: categoryName }]}
        title={h1}
        accent={categoryName}
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
            {/* 2. Quick solutions */}
            {quick.length > 0 && (
              <>
                <div className="pm-sechead" style={{ marginBottom: 20 }}>
                  <span className="pm-eyebrow">Quick solutions</span>
                  <h2>What we fix{city ? ` in ${city}` : ''}</h2>
                </div>
                <div className="pm-grid3">
                  {quick.map(s => (
                    <Link key={s.id} className="pm-card" href={serviceHref(s)}>
                      <span className="pm-icon"><PmIconWrench /></span>
                      <h3>{s.name}</h3>
                      {s.problems?.length ? (
                        <ul className="pm-quicklist">
                          {s.problems.slice(0, 3).map((p, i) => <li key={i}><span className="pm-chk"><PmIconCheck /></span><span>{p.heading}</span></li>)}
                        </ul>
                      ) : s.description ? <p>{s.description}</p> : null}
                      <span className="pm-more">Learn more <PmIconArrow /></span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {/* 3. This page's own copy (city-specific, anti-doorway) */}
            {(bodyParagraphs.length > 0 || !lede) && (
              <div className="pm-prose" style={{ marginTop: 44 }}>
                {bodyParagraphs.length > 0 ? bodyParagraphs.map((p, i) => <p key={i}>{p}</p>) : <p>{intro}</p>}
              </div>
            )}

            {/* 4. Everything else in this category */}
            {services.length > quick.length && (
              <div style={{ marginTop: 40 }}>
                <h2 style={{ fontSize: 24 }}>All {categoryName.toLowerCase()} services</h2>
                <ul className="pm-checklist">
                  {services.map(s => (
                    <li key={s.id}><Link href={serviceHref(s)}><span className="pm-chk"><PmIconCheck /></span>{s.name}</Link></li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <aside>
            <div className="pm-asidestack">
              <div className="pm-aside" id="pm-form">
                <UnifiedLeadForm siteId={site.id} accentColor={ctaColor} categories={formCategories} schedulingActive={schedulingActive} ctaStyle={ctaStyle} variant="hero" />
                {(averageRating || workItemsCount > 0 || phone) && (
                  <div className="pm-asidetrust">
                    {averageRating ? <div className="pm-t"><span className="pm-ic"><PmIconStar /></span>{averageRating.toFixed(1)}-star rated on Google</div> : null}
                    {workItemsCount > 0 && <div className="pm-t"><span className="pm-ic"><PmIconLayers /></span>{workItemsCount} documented job{workItemsCount === 1 ? '' : 's'}</div>}
                    {phone && <div className="pm-t"><span className="pm-ic"><PmIconPhone /></span><a href={phoneHref}>{phone}</a></div>}
                  </div>
                )}
              </div>
              {city && <PremiumCityMap city={city} state={location.state} />}
            </div>
          </aside>
        </div>
      </section>

      {/* 5. Reviews */}
      {reviews.length > 0 && (
        <section className="pm-block pm-dark">
          <div className="pm-wrap">
            <div className="pm-sechead">
              <span className="pm-eyebrow">Reviews</span>
              <h2>What {city || 'our'} customers say</h2>
              {averageRating ? <p>{averageRating.toFixed(1)} average across {totalReviews || reviews.length} Google reviews.</p> : null}
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

      <PremiumRecentWork items={recentWorkItems} locationSlug={locationSlug} title={`Recent ${categoryName.toLowerCase()} work`} />

      <PremiumFinalCta heading={`Need ${categoryName.toLowerCase()}${city ? ` in ${city}` : ''}?`} sub={phone ? `Call ${phone} or send the form. We reply during business hours.` : 'Send the form and we reply during business hours.'} ctaStyle={ctaStyle} phone={phone} />
    </PremiumShell>
  );
}
