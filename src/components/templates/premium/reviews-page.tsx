'use client';

import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderReview,
  PublicRenderAreaListing, PublicRenderCategory,
} from '@/lib/sites/public-render-model';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildBreadcrumbSchema } from '@/lib/schema';
import { UnifiedLeadForm } from '@/components/templates/local-service-pro/unified-lead-form';
import { PremiumShell, PremiumPageHero } from './shell';
import { PmIconStar } from './icons';

interface PremiumReviewsPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  reviews: PublicRenderReview[];
  averageRating: number | null;
  totalReviewCount: number | null;
  serviceAreas: PublicRenderAreaListing[];
  categories: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

function stars(n: number) { return '★★★★★'.slice(0, Math.max(0, Math.min(5, Math.round(n)))); }
function initials(name: string) { return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase(); }

export function PremiumReviewsPage({
  site, primaryLocation, reviews, averageRating, totalReviewCount, serviceAreas,
  siteSlug, locationSlug, formCategories, schedulingActive = false, ctaStyle = 'booking',
}: PremiumReviewsPageProps) {
  const ctaColor = site.settings?.cta_color || site.settings?.brand_color || '#00ef99';
  const cityState = primaryLocation?.city ? `${primaryLocation.city}${primaryLocation.state ? `, ${primaryLocation.state}` : ''}` : '';
  const withText = reviews.filter(r => r.comment);

  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: 'Reviews', url: paths.reviewsIndex(locationSlug) },
  ]);

  // rating distribution
  const dist = [5, 4, 3, 2, 1].map(stars_ => ({ stars: stars_, count: reviews.filter(r => Math.round(r.rating) === stars_).length }));
  const maxCount = Math.max(1, ...dist.map(d => d.count));

  return (
    <PremiumShell site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[breadcrumb]} />
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: 'Reviews' }]}
        eyebrow="Reviews"
        title={`What ${primaryLocation?.city || 'our'} customers say`}
        accent={primaryLocation?.city || undefined}
        lede={averageRating ? `${averageRating.toFixed(1)} average across ${totalReviewCount || withText.length} Google reviews.` : undefined}
      />
      <section className="pm-block">
        <div className="pm-wrap pm-layout">
          <div>
            {/* summary */}
            {averageRating ? (
              <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap', marginBottom: 36, paddingBottom: 32, borderBottom: '1px solid var(--line)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 56, letterSpacing: '-.04em', lineHeight: 1 }}>{averageRating.toFixed(1)}</div>
                  <div style={{ color: '#f5a623', fontSize: 18, marginTop: 4 }}>{stars(averageRating)}</div>
                  <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 4 }}>{totalReviewCount || withText.length} reviews</div>
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  {dist.map(d => (
                    <div key={d.stars} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--muted)', width: 12 }}>{d.stars}</span>
                      <span style={{ color: '#f5a623', fontSize: 12 }}>★</span>
                      <span style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--paper-2)', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${(d.count / maxCount) * 100}%`, background: 'var(--brand)' }} />
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--muted)', width: 24, textAlign: 'right' }}>{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* review list */}
            <div style={{ display: 'grid', gap: 18 }}>
              {withText.map((r, i) => (
                <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: 26 }}>
                  <div style={{ color: '#f5a623', marginBottom: 12 }}>{stars(r.rating)}</div>
                  <p style={{ fontSize: 16.5, lineHeight: 1.6, color: 'var(--ink-2)', marginBottom: 18 }}>&ldquo;{r.comment}&rdquo;</p>
                  <div className="pm-who">
                    {r.author_photo_url ? <img className="pm-av" src={r.author_photo_url} alt={r.author_name || 'Customer'} /> : <span className="pm-av">{initials(r.author_name || 'Customer')}</span>}
                    <div><div className="pm-nm" style={{ color: 'var(--ink)' }}>{r.author_name || 'Customer'}</div>{cityState && <div className="pm-mt" style={{ color: 'var(--muted)' }}>{primaryLocation?.city}</div>}</div>
                  </div>
                  {r.review_reply && (
                    <div style={{ marginTop: 16, marginLeft: 16, paddingLeft: 16, borderLeft: '2px solid var(--line)' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Response from {site.name}</div>
                      <p style={{ fontSize: 14.5, color: 'var(--ink-2)' }}>{r.review_reply}</p>
                    </div>
                  )}
                </div>
              ))}
              {withText.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 17 }}>Reviews from our customers will appear here soon.</p>}
            </div>
          </div>
          <aside>
            <div className="pm-aside" id="pm-form">
              <UnifiedLeadForm siteId={site.id} accentColor={ctaColor} categories={formCategories} schedulingActive={schedulingActive} ctaStyle={ctaStyle} variant="hero" />
              <div className="pm-asidetrust">
                <div className="pm-t"><span className="pm-ic"><PmIconStar /></span>{averageRating ? `${averageRating.toFixed(1)}-star rated` : '5-star rated'}</div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </PremiumShell>
  );
}
