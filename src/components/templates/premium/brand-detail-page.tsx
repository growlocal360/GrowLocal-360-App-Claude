'use client';

import Link from 'next/link';
import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderBrandDetail,
  PublicRenderBrandListing, PublicRenderAreaListing, PublicRenderReview,
  PublicRenderCategory, PublicRenderWorkItem,
} from '@/lib/sites/public-render-model';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildFAQPageSchema, buildBreadcrumbSchema } from '@/lib/schema';
import { UnifiedLeadForm } from '@/components/templates/local-service-pro/unified-lead-form';
import { PremiumShell, PremiumPageHero, PremiumFinalCta } from './shell';
import { PmIconCheck, PmIconWrench, PmIconArrow, PmIconStar, PmIconShield, PmIconClock } from './icons';

interface BrandService { id: string; name: string; slug: string; categoryName: string; categorySlug: string; isPrimaryCategory: boolean; }

interface PremiumBrandDetailPageProps {
  site: PublicRenderSite;
  brand: PublicRenderBrandDetail;
  primaryLocation: PublicRenderLocation | null;
  services: BrandService[];
  serviceAreas: PublicRenderAreaListing[];
  brands: PublicRenderBrandListing[];
  categories: NavCategory[];
  googleReviews: PublicRenderReview[];
  siteSlug: string;
  locationSlug?: string;
  recentWorkItems?: PublicRenderWorkItem[];
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function PremiumBrandDetailPage({
  site, brand, primaryLocation, services, serviceAreas, siteSlug, locationSlug,
  formCategories, schedulingActive = false, ctaStyle = 'booking',
}: PremiumBrandDetailPageProps) {
  const ctaColor = site.settings?.cta_color || site.settings?.brand_color || '#00ef99';
  const phone = site.settings?.phone || primaryLocation?.phone;
  const cityState = primaryLocation?.city ? `${primaryLocation.city}${primaryLocation.state ? `, ${primaryLocation.state}` : ''}` : '';
  const valueProps = brand.value_props || [];
  const faqs = brand.faqs || [];

  const h1 = brand.h1 || `${brand.name} Repair${cityState ? ` in ${cityState}` : ''}`;
  const intro = brand.body_copy || brand.hero_description || `Expert ${brand.name} service and repair.`;

  const faqSchema = faqs.length > 0 ? buildFAQPageSchema(faqs) : null;
  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: 'Brands', url: paths.brandsIndex(locationSlug) },
    { name: brand.name, url: paths.brandPage(brand.slug, locationSlug) },
  ]);

  return (
    <PremiumShell site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[faqSchema, breadcrumb]} />
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: 'Brands', href: paths.brandsIndex(locationSlug) }, { label: brand.name }]}
        eyebrow="Brand Service"
        title={h1}
        accent={brand.name}
        lede={brand.hero_description || undefined}
      />
      <section className="pm-block">
        <div className="pm-wrap pm-layout">
          <div className="pm-prose">
            {intro.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
            {valueProps.length > 0 && (
              <>
                <h2>Why choose us for {brand.name}</h2>
                <ul>
                  {valueProps.map((v, i) => <li key={i}><span className="pm-chk"><PmIconCheck /></span><div><b>{v.title}</b>{v.description ? ` — ${v.description}` : ''}</div></li>)}
                </ul>
              </>
            )}
            {services.length > 0 && (
              <>
                <h2>{brand.name} services we offer</h2>
                <div className="pm-grid3" style={{ marginTop: 20 }}>
                  {services.slice(0, 6).map(s => (
                    <Link key={s.id} className="pm-card" href={paths.servicePage(s.slug, s.categorySlug, s.isPrimaryCategory, locationSlug)}>
                      <span className="pm-icon"><PmIconWrench /></span>
                      <h3>{s.name}</h3>
                      <span className="pm-more">Learn more <PmIconArrow /></span>
                    </Link>
                  ))}
                </div>
              </>
            )}
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
                <div className="pm-t"><span className="pm-ic"><PmIconStar /></span>{brand.name} specialists</div>
                <div className="pm-t"><span className="pm-ic"><PmIconShield /></span>Satisfaction guaranteed</div>
                <div className="pm-t"><span className="pm-ic"><PmIconClock /></span>Fast response times</div>
              </div>
            </div>
          </aside>
        </div>
      </section>
      <PremiumFinalCta heading={brand.cta_heading || `Need ${brand.name} service?`} sub={brand.cta_description || 'Book your appointment today.'} ctaStyle={ctaStyle} phone={phone} />
    </PremiumShell>
  );
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
