'use client';

import Link from 'next/link';
import type { PublicRenderData, PublicRenderServiceListing, PublicRenderWorkItem, PublicRenderCategory } from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';
import {
  JsonLd,
  buildLocalBusinessSchema,
  buildWebSiteSchema,
  toBusinessInput,
  toLocationInput,
} from '@/lib/schema';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import { UnifiedLeadForm } from '@/components/templates/local-service-pro/unified-lead-form';
import { AvailabilityBadge } from '@/components/templates/local-service-pro/availability-badge';
import { PremiumHeader } from './header';
import { PremiumFooter } from './footer';
import {
  PmIconPhone, PmIconCheck, PmIconStar, PmIconShield, PmIconClock,
  PmIconWrench, PmIconLayers, PmIconArrow, PmIconPin,
} from './icons';

const LOWERCASE_WORDS = new Set(['a','an','the','and','but','or','nor','for','yet','so','in','on','at','to','of','by','with','from','as','into']);
function toTitleCase(str: string): string {
  return str.split(' ').map((word, i) => {
    if (i === 0) return word.charAt(0).toUpperCase() + word.slice(1);
    if (LOWERCASE_WORDS.has(word.toLowerCase())) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

// Mirror of LocalServiceProTemplate's props so this is a drop-in registry entry.
interface PremiumTemplateProps {
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

export function PremiumTemplate({
  data, siteSlug, services, primaryCategorySlug, primaryCategoryName,
  categories, secondaryCategories, locationSlug, recentWorkItems, formCategories,
  schedulingActive = false, showAvailabilityBadge = true, ctaStyle = 'booking',
}: PremiumTemplateProps) {
  const { site, locations, serviceAreas, neighborhoods, sitePages, reviews, brands, primaryLocation } = data;
  const slug = siteSlug || site.slug;
  const brandColor = site.settings?.brand_color || '#00ef99';
  const secondaryColor = site.settings?.secondary_color || brandColor;
  const ctaColor = site.settings?.cta_color || brandColor;
  const averageRating = site.settings?.google_average_rating as number | undefined;
  const totalReviewCount = site.settings?.google_total_reviews as number | undefined;
  const phone = site.settings?.phone || primaryLocation?.phone;
  const phoneHref = phone ? `tel:${phone.replace(/\D/g, '')}` : undefined;

  const homePageContent = sitePages?.[0] || null;

  // brand-ink: readable text color on top of the brand fill
  const brandInk = readableInk(brandColor);

  // Hero copy
  const category = primaryCategoryName || (site.settings?.core_industry as string) || 'Professional Services';
  const categoryNoun = category.replace(/\s*services?$/i, '').trim() || category;
  const hasCity = !!primaryLocation?.city;
  const hasState = !!primaryLocation?.state;
  const cityState = hasCity && hasState ? `${primaryLocation!.city}, ${primaryLocation!.state}` : hasCity ? primaryLocation!.city : hasState ? primaryLocation!.state : '';
  const locationStr = cityState ? ` in ${cityState}` : '';
  const rawH1 = homePageContent?.h1 || `${category}${locationStr} - ${site.name}`;
  const h1 = toTitleCase(rawH1);
  const heroDescription = homePageContent?.hero_description ||
    `${site.name} provides expert ${categoryNoun.toLowerCase()} services${cityState ? ` in ${cityState} and surrounding areas` : ''}.`;

  // Split H1 so the category phrase renders in brand color (accent)
  const accentPart = primaryCategoryName || categoryNoun;
  const heroParts = splitAccent(h1, accentPart);

  // Schema (identical to baseline template)
  const businessInput = primaryLocation ? toBusinessInput(site, primaryLocation) : null;
  const locationInput = primaryLocation ? toLocationInput(primaryLocation) : null;
  const schemaReviews = (reviews || []).filter(r => r.comment).map(r => ({ authorName: r.author_name, text: r.comment, rating: r.rating }));
  const localBusinessSchema = businessInput && locationInput
    ? buildLocalBusinessSchema(businessInput, locationInput, { reviews: schemaReviews.length > 0 ? schemaReviews : undefined })
    : null;
  const webSiteSchema = businessInput ? buildWebSiteSchema(businessInput) : null;

  const ctaLabel = ctaStyle === 'booking' ? 'Book Online' : 'Get Free Estimate';
  const svcList = services || [];
  const work = recentWorkItems || [];

  // areas (neighborhoods + service areas) — same combination as baseline
  const allAreas = [
    ...(neighborhoods || []).map(n => ({ id: n.id, name: n.name, href: paths.neighborhoodPage(n.slug, locationSlug) })),
    ...serviceAreas.map(a => ({ id: a.id, name: a.state ? `${a.name}, ${a.state}` : a.name, href: paths.areaPage(a.slug, locationSlug) })),
  ];

  const testimonials = (reviews && reviews.length > 0)
    ? reviews.slice(0, 3).map(r => ({ text: r.comment || 'Great service!', name: r.author_name || 'Customer', rating: r.rating, photo: r.author_photo_url }))
    : [
        { text: 'Excellent service from start to finish. Professional, on time, and fair pricing. Highly recommend!', name: 'Sarah M.', rating: 5, photo: null },
        { text: 'They went above and beyond to solve our issue. Will definitely use again for future work.', name: 'James R.', rating: 5, photo: null },
        { text: 'Fast response and quality workmanship. Courteous team that cleaned up after the job.', name: 'Michelle K.', rating: 5, photo: null },
      ];

  return (
    <div className="tpl-premium" style={{ ['--brand' as string]: brandColor, ['--brand-ink' as string]: brandInk }}>
      <JsonLd data={[localBusinessSchema, webSiteSchema]} />
      <PremiumHeader site={site} primaryLocation={primaryLocation} siteSlug={slug} locationSlug={locationSlug} ctaLabel={ctaLabel} />

      <main>
        {/* HERO */}
        <section className="pm-hero">
          <div className="pm-hero-bg" />
          <div className="pm-hero-grid" />
          <div className="pm-wrap pm-hero-inner">
            <div>
              <div className="pm-ratingpill">
                <span className="pm-stars">{stars(Math.round(averageRating || 5))}</span>
                <b>{averageRating ? `${averageRating.toFixed(1)}-Star Rated` : '5-Star Rated Service'}</b>
                {totalReviewCount ? <span className="pm-rev">· {totalReviewCount} Google Reviews</span> : null}
              </div>
              <h1>{heroParts.before}<span className="pm-accent">{heroParts.accent}</span>{heroParts.after}</h1>
              <p className="pm-lede">{heroDescription}</p>
              {showAvailabilityBadge && (
                <div style={{ marginBottom: 22 }}>
                  <AvailabilityBadge siteId={site.id} brandColor={secondaryColor} />
                </div>
              )}
              <div className="pm-actions">
                {phoneHref && (
                  <a className="pm-callblock" href={phoneHref}>
                    <span className="pm-callring"><PmIconPhone /></span>
                    <span>
                      <span className="pm-lbl">Call for immediate service</span><br />
                      <span className="pm-num">{phone}</span>
                    </span>
                  </a>
                )}
                <a className="pm-btn pm-btn-brand pm-btn-lg" href="#pm-form">{caLabel(ctaStyle)} <PmIconArrow /></a>
              </div>
            </div>

            <div id="pm-form" className="pm-formcard">
              <UnifiedLeadForm
                siteId={site.id}
                accentColor={ctaColor}
                categories={formCategories}
                schedulingActive={schedulingActive}
                ctaStyle={ctaStyle}
                variant="hero"
              />
            </div>
          </div>
        </section>

        {/* TRUST BAR */}
        <div className="pm-trust">
          <div className="pm-wrap pm-trust-inner">
            <TrustItem n="100%" u="" l="Satisfaction" />
            <TrustItem n={averageRating ? averageRating.toFixed(1) : '5.0'} u="★" l="Average Rating" />
            <TrustItem n={totalReviewCount ? `${totalReviewCount}` : '100'} u="+" l="Happy Customers" />
            <TrustItem n="1" u="yr" l="Service Warranty" />
          </div>
        </div>

        {/* SERVICES */}
        {(svcList.length > 0 || (secondaryCategories && secondaryCategories.length > 0)) && (
          <section className="pm-block">
            <div className="pm-wrap">
              <div className="pm-sechead">
                <span className="pm-eyebrow">What We Do</span>
                <h2>Expert {categoryNoun.toLowerCase()}{cityState ? ` in ${primaryLocation?.city}` : ''}</h2>
                <p>Comprehensive service for every need — done right the first time.</p>
              </div>
              <div className="pm-grid3">
                {svcList.map(s => (
                  <Link key={s.id} className="pm-card" href={paths.servicePage(s.slug, primaryCategorySlug, true, locationSlug)}>
                    <span className="pm-icon"><PmIconWrench /></span>
                    <h3>{s.name}</h3>
                    {s.description && <p>{s.description}</p>}
                    <span className="pm-more">Learn more <PmIconArrow /></span>
                  </Link>
                ))}
                {secondaryCategories?.map(c => (
                  <Link key={c.slug} className="pm-card" href={paths.categoryPage(c.slug, false, locationSlug)}>
                    <span className="pm-icon"><PmIconLayers /></span>
                    <h3>{c.name}</h3>
                    <span className="pm-more">View services <PmIconArrow /></span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* HOW IT WORKS */}
        <section className="pm-block pm-soft">
          <div className="pm-wrap">
            <div className="pm-sechead pm-center">
              <span className="pm-eyebrow">Simple Process</span>
              <h2>{ctaStyle === 'booking' ? 'Booking takes 60 seconds' : 'Getting a quote is easy'}</h2>
            </div>
            <div className="pm-steps">
              <Step n="01" h="Tell us what you need" p="Book online or call. Describe the job and we'll match you with the right expert." />
              <Step n="02" h="We show up on time" p="Get a guaranteed arrival window. Our team arrives prepared to get the work done." />
              <Step n="03" h="Done & guaranteed" p="Upfront pricing before any work begins, backed by our satisfaction guarantee." />
            </div>
          </div>
        </section>

        {/* WHY / SPLIT */}
        <section className="pm-block">
          <div className="pm-wrap pm-split">
            <div>
              <span className="pm-eyebrow">Why Choose {site.name}</span>
              <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', margin: '16px 0 8px' }}>The team your neighbors recommend</h2>
              <p style={{ color: 'var(--ink-2)', fontSize: 17 }}>We've built our reputation one honest job at a time — no upsells, no surprises, just work that lasts.</p>
              <ul className="pm-whylist">
                <WhyItem h="Experienced professionals" p="Trained, vetted, and equipped to handle the job right." />
                <WhyItem h="Upfront, honest pricing" p="You approve the price before we start. No hidden fees." />
                <WhyItem h="Satisfaction guaranteed" p="We stand behind our work with a full service warranty." />
              </ul>
            </div>
            <div className="pm-whyvisual">
              <div className="pm-badge">
                <div className="pm-q">&ldquo;{testimonials[0].text}&rdquo;</div>
                <div className="pm-a">— {testimonials[0].name}{cityState ? `, ${primaryLocation?.city}` : ''}</div>
              </div>
            </div>
          </div>
        </section>

        {/* RECENT WORK */}
        {work.length > 0 && (
          <section className="pm-block pm-soft">
            <div className="pm-wrap">
              <div className="pm-sechead">
                <span className="pm-eyebrow">Recent Work</span>
                <h2>See our work{cityState ? ` across ${primaryLocation?.city}` : ''}</h2>
              </div>
              <div className="pm-work">
                {work.slice(0, 3).map(w => {
                  const img = w.images?.[0]?.url;
                  return (
                    <Link key={w.id} className="pm-workcard" href={paths.workDetail(w.slug, locationSlug)}>
                      {img ? <img src={img} alt={w.images?.[0]?.alt || w.title} /> : <span className="pm-imgph" />}
                      {w.service?.name && <span className="pm-tag">{w.service.name}</span>}
                      <span className="pm-ov"><span className="pm-ovt">{w.title}</span></span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* TESTIMONIALS (dark) */}
        <section className="pm-block pm-dark">
          <div className="pm-wrap">
            <div className="pm-sechead pm-center">
              <span className="pm-eyebrow">Reviews</span>
              <h2>What {primaryLocation?.city || 'our'} customers say</h2>
              {averageRating ? <p>{averageRating.toFixed(1)} average across {totalReviewCount} Google reviews.</p> : <p>Don&apos;t just take our word for it.</p>}
            </div>
            <div className="pm-grid3">
              {testimonials.map((t, i) => (
                <div key={i} className="pm-tstcard">
                  <div className="pm-stars">{stars(t.rating)}</div>
                  <div className="pm-quote">&ldquo;{t.text}&rdquo;</div>
                  <div className="pm-who">
                    {t.photo ? <img className="pm-av" src={t.photo} alt={t.name} /> : <span className="pm-av">{initials(t.name)}</span>}
                    <div><div className="pm-nm">{t.name}</div>{cityState && <div className="pm-mt">{primaryLocation?.city}</div>}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AREAS */}
        {allAreas.length > 0 && (
          <section className="pm-block">
            <div className="pm-wrap">
              <div className="pm-sechead">
                <span className="pm-eyebrow">Service Areas</span>
                <h2>Proudly serving {primaryLocation?.city || 'your area'} &amp; beyond</h2>
              </div>
              <div className="pm-areas">
                {allAreas.map(a => (
                  <Link key={a.id} className="pm-chip" href={a.href}><span className="pm-pin"><PmIconPin /></span>{a.name}</Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FINAL CTA */}
        <div className="pm-wrap pm-finalwrap">
          <div className="pm-final">
            <h2>{ctaStyle === 'booking' ? 'Ready to book? Let’s get started.' : 'Ready for your free estimate?'}</h2>
            <p>Fast response, upfront pricing, and work backed by our guarantee.</p>
            <div className="pm-row">
              <a className="pm-btn pm-btn-brand pm-btn-lg" href="#pm-form">{caLabel(ctaStyle)} <PmIconArrow /></a>
              {phoneHref && <a className="pm-btn pm-btn-ghost pm-btn-lg" href={phoneHref}><PmIconPhone style={{ width: 18, height: 18 }} /> {phone}</a>}
            </div>
          </div>
        </div>
      </main>

      <PremiumFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={slug} locationSlug={locationSlug} />
    </div>
  );
}

/* ---------- small presentational helpers ---------- */
function TrustItem({ n, u, l }: { n: string; u?: string; l: string }) {
  return <div className="pm-trust-item"><div className="pm-n">{n}{u && <span className="pm-u">{u}</span>}</div><div className="pm-l">{l}</div></div>;
}
function Step({ n, h, p }: { n: string; h: string; p: string }) {
  return <div className="pm-step"><div className="pm-stepnum">{n}</div><h3>{h}</h3><p>{p}</p></div>;
}
function WhyItem({ h, p }: { h: string; p: string }) {
  return <li><span className="pm-chk"><PmIconCheck /></span><div><h4>{h}</h4><p>{p}</p></div></li>;
}
function stars(n: number) { return '★★★★★'.slice(0, Math.max(0, Math.min(5, n))); }
function initials(name: string) { return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase(); }
function caLabel(ctaStyle: 'booking' | 'estimate') { return ctaStyle === 'booking' ? 'Book Online' : 'Get Free Estimate'; }

/** Readable ink color (#0a0a0b or #fff) for text/icons on a brand fill. */
function readableInk(hex: string): string {
  const c = hex.replace('#', '');
  if (c.length < 6) return '#0a0a0b';
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#0a0a0b' : '#ffffff';
}

/** Split a title so the accent phrase can be wrapped in brand color. */
function splitAccent(title: string, accent: string): { before: string; accent: string; after: string } {
  if (!accent) return { before: title, accent: '', after: '' };
  const idx = title.toLowerCase().indexOf(accent.toLowerCase());
  if (idx === -1) return { before: title, accent: '', after: '' };
  return { before: title.slice(0, idx), accent: title.slice(idx, idx + accent.length), after: title.slice(idx + accent.length) };
}
