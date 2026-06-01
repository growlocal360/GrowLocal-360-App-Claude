'use client';

import Link from 'next/link';
import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderServiceDetail,
  PublicRenderCategory, PublicRenderServiceListing, PublicRenderReview,
  PublicRenderAreaListing, PublicRenderWorkItem,
} from '@/lib/sites/public-render-model';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import * as paths from '@/lib/routing/paths';
import {
  JsonLd, buildServiceSchema, buildFAQPageSchema, buildBreadcrumbSchema, toBusinessInput, toLocationInput,
} from '@/lib/schema';
import { UnifiedLeadForm } from '@/components/templates/local-service-pro/unified-lead-form';
import { PremiumShell, PremiumPageHero, PremiumFinalCta, ctaLabelFor } from './shell';
import { PmIconCheck, PmIconStar, PmIconShield, PmIconClock, PmIconWrench, PmIconArrow } from './icons';

interface PremiumServicePageProps {
  data: {
    site: PublicRenderSite;
    location: PublicRenderLocation;
    service: PublicRenderServiceDetail;
    category: PublicRenderCategory;
    siblingServices: PublicRenderServiceListing[];
  };
  siteSlug: string;
  isPrimaryCategory: boolean;
  googleReviews?: PublicRenderReview[];
  categories?: NavCategory[];
  serviceAreas?: PublicRenderAreaListing[];
  locationSlug?: string;
  recentWorkItems?: PublicRenderWorkItem[];
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function PremiumServicePage({
  data, siteSlug, isPrimaryCategory, serviceAreas = [], locationSlug,
  formCategories, schedulingActive = false, ctaStyle = 'booking',
}: PremiumServicePageProps) {
  const { site, location, service, category, siblingServices } = data;
  const brandColor = site.settings?.brand_color || '#00ef99';
  const ctaColor = site.settings?.cta_color || brandColor;
  const phone = site.settings?.phone || location?.phone;
  const cityState = location?.city ? `${location.city}${location.state ? `, ${location.state}` : ''}` : '';
  const categoryName = category?.gbp_category?.display_name || '';
  const categorySlug = categoryName ? categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : undefined;

  const h1 = service.h1 || `${service.name}${cityState ? ` in ${cityState}` : ''}`;
  const intro = service.intro_copy || service.body_copy || service.description || '';
  const problems = service.problems || [];
  const sections = service.detailed_sections || [];
  const faqs = service.faqs || [];

  // Schema (same builders + arg order as the baseline service page)
  const businessInput = toBusinessInput(site, location);
  const locationInput = toLocationInput(location);
  const serviceSchema = buildServiceSchema(
    { name: service.name, slug: service.slug, description: service.description, categoryName },
    businessInput,
    locationInput,
  );
  const faqSchema = faqs.length > 0 ? buildFAQPageSchema(faqs) : null;
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    ...(categoryName ? [{ name: categoryName, url: paths.categoryPage(categorySlug!, isPrimaryCategory, locationSlug) }] : []),
    { name: service.name, url: paths.servicePage(service.slug, categorySlug, isPrimaryCategory, locationSlug) },
  ]);

  return (
    <PremiumShell site={site} primaryLocation={location} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[serviceSchema, faqSchema, breadcrumbSchema]} />

      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: 'Services', href: paths.servicesIndex(locationSlug) }, { label: service.name }]}
        title={h1}
        accent={service.name}
        lede={service.description || undefined}
      />

      <section className="pm-block">
        <div className="pm-wrap pm-layout">
          <div className="pm-prose">
            {intro && <p>{intro}</p>}

            {problems.length > 0 && (
              <>
                <h2>Common problems we fix</h2>
                <ul>
                  {problems.map((p, i) => (
                    <li key={i}><span className="pm-chk"><PmIconCheck /></span><div><b>{p.heading}</b>{p.description ? ` — ${p.description}` : ''}</div></li>
                  ))}
                </ul>
              </>
            )}

            {sections.map((s, i) => (
              <div key={i}>
                <h2>{s.h2}</h2>
                {s.body && <p>{s.body}</p>}
                {s.bullets?.length > 0 && (
                  <ul>{s.bullets.map((b, j) => <li key={j}><span className="pm-chk"><PmIconCheck /></span><div>{b}</div></li>)}</ul>
                )}
              </div>
            ))}

            {faqs.length > 0 && (
              <div className="pm-faq" style={{ marginTop: 40 }}>
                {faqs.map((f, i) => (
                  <details key={i} open={i === 0}>
                    <summary>{f.question}<span className="pm-plus"><PlusIcon /></span></summary>
                    <div className="pm-ans">{f.answer}</div>
                  </details>
                ))}
              </div>
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

      {siblingServices.length > 0 && (
        <section className="pm-block pm-soft">
          <div className="pm-wrap">
            <div className="pm-sechead"><span className="pm-eyebrow">More Services</span><h2>Related services</h2></div>
            <div className="pm-grid3">
              {siblingServices.slice(0, 3).map(s => (
                <Link key={s.id} className="pm-card" href={paths.servicePage(s.slug, categorySlug, isPrimaryCategory, locationSlug)}>
                  <span className="pm-icon"><PmIconWrench /></span>
                  <h3>{s.name}</h3>
                  {s.description && <p>{s.description}</p>}
                  <span className="pm-more">Learn more <PmIconArrow /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <PremiumFinalCta heading={ctaStyle === 'booking' ? `Book your ${service.name.toLowerCase()} today` : `Get a free ${service.name.toLowerCase()} estimate`} sub="Fast response, upfront pricing, satisfaction guaranteed." ctaStyle={ctaStyle} phone={phone} />
    </PremiumShell>
  );
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
