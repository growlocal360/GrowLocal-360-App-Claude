'use client';

import * as paths from '@/lib/routing/paths';
import { JsonLd, buildWebPageSchema, buildBreadcrumbSchema, toBusinessInput, getSiteUrl } from '@/lib/schema';
import { UnifiedLeadForm } from '@/components/templates/local-service-pro/unified-lead-form';
import { AvailabilityBadge } from '@/components/templates/local-service-pro/availability-badge';
import type { BookPageProps } from '@/components/templates/local-service-pro/book-page';
import { bookPageCopy, titleCaseService } from '@/lib/sites/book-page-copy';
import { PremiumShell, PremiumPageHero } from './shell';
import { PmIconPhone, PmIconCheck } from './icons';

export function PremiumBookPage(props: BookPageProps) {
  const { site, primaryLocation, serviceAreas, formCategories, siteSlug, locationSlug, schedulingActive, ctaStyle, showAvailabilityBadge, serviceName } = props;
  const ctaColor = site.settings?.cta_color || site.settings?.brand_color || '#00ef99';
  const phone = site.settings?.phone || primaryLocation?.phone;
  const phoneHref = phone ? `tel:${phone.replace(/\D/g, '')}` : undefined;
  const { h1, lede } = bookPageCopy(props);
  const booking = ctaStyle === 'booking';
  const brandColor = site.settings?.brand_color || '#00ef99';
  const accent = titleCaseService(serviceName);

  const businessInput = toBusinessInput(site, primaryLocation);
  const siteUrl = getSiteUrl(businessInput);
  const pageSchema = buildWebPageSchema(h1, lede, siteUrl + paths.bookPage(locationSlug), 'WebPage', businessInput);
  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: booking ? 'Book' : 'Free Estimate', url: paths.bookPage(locationSlug) },
  ]);

  const steps = booking
    ? ['Choose the service and describe the problem', 'Pick a day and arrival window', 'We confirm by text or phone']
    : ['Tell us the service and the address', 'We review and price it', 'You get a clear estimate, no obligation'];

  return (
    <PremiumShell site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[pageSchema, breadcrumb]} />
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: booking ? 'Book' : 'Free Estimate' }]}
        eyebrow={booking ? 'Online booking' : 'Free estimate'}
        title={h1}
        accent={accent}
        lede={lede}
      >
        {schedulingActive && showAvailabilityBadge && <AvailabilityBadge siteId={site.id} brandColor={brandColor} tone="brand" size="lg" />}
      </PremiumPageHero>

      <section className="pm-block">
        <div className="pm-wrap pm-layout">
          <div className="pm-contactcard" id="pm-form">
            <UnifiedLeadForm siteId={site.id} accentColor={ctaColor} categories={formCategories} schedulingActive={schedulingActive} ctaStyle={ctaStyle} variant="section" />
          </div>
          <aside>
            <div className="pm-asidestack">
              <div className="pm-aside">
                <h3 style={{ fontSize: 20, marginBottom: 14 }}>How it works</h3>
                <ul className="pm-checklist" style={{ gridTemplateColumns: '1fr' }}>
                  {steps.map((s) => <li key={s}><span className="pm-chk"><PmIconCheck /></span>{s}</li>)}
                </ul>
                {phoneHref && (
                  <a className="pm-btn pm-btn-ghost pm-btn-lg" href={phoneHref} style={{ marginTop: 18, width: '100%', justifyContent: 'center' }}>
                    <PmIconPhone style={{ width: 18, height: 18 }} /> Call {phone}
                  </a>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </PremiumShell>
  );
}
