'use client';

import Link from 'next/link';
import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderPageContent,
  PublicRenderAreaListing, PublicRenderCategory,
} from '@/lib/sites/public-render-model';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import type { FAQHubItem } from '@/lib/sites/get-faq-hub';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildBreadcrumbSchema } from '@/lib/schema';
import { PremiumShell, PremiumPageHero, PremiumFinalCta } from './shell';
import { PmIconArrow } from './icons';

interface PremiumFAQHubPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  pageContent: PublicRenderPageContent | null;
  faqItems: FAQHubItem[];
  topicGroups: string[];
  serviceAreas?: PublicRenderAreaListing[];
  categories?: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function PremiumFAQHubPage({
  site, primaryLocation, pageContent, faqItems, topicGroups, serviceAreas = [],
  siteSlug, locationSlug, ctaStyle = 'booking',
}: PremiumFAQHubPageProps) {
  const phone = site.settings?.phone || primaryLocation?.phone;
  const h1 = pageContent?.h1 || 'Frequently Asked Questions';

  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: 'FAQ', url: paths.faqPage(locationSlug) },
  ]);

  const groups = topicGroups.length > 0 ? topicGroups : [...new Set(faqItems.map(f => f.topicGroup))];

  return (
    <PremiumShell site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[breadcrumb]} />
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: 'FAQ' }]}
        eyebrow="Answers"
        title={h1}
        lede={pageContent?.hero_description || 'Common questions, answered. Still stuck? Reach out anytime.'}
      />
      <section className="pm-block">
        <div className="pm-wrap" style={{ maxWidth: 900 }}>
          {groups.map(group => {
            const items = faqItems.filter(f => f.topicGroup === group);
            if (items.length === 0) return null;
            return (
              <div key={group} style={{ marginBottom: 44 }}>
                {groups.length > 1 && <h2 style={{ fontSize: 26, marginBottom: 8 }}>{group}</h2>}
                <div className="pm-faq">
                  {items.map((f, i) => (
                    <details key={i} open={i === 0}>
                      <summary>{f.question}<span className="pm-plus"><PlusIcon /></span></summary>
                      <div className="pm-ans">
                        {f.teaserAnswer}
                        {f.canonicalUrl && (
                          <div style={{ marginTop: 12 }}>
                            <Link href={f.canonicalUrl} className="pm-more" style={{ display: 'inline-flex', gap: 7, alignItems: 'center', fontWeight: 700, color: 'var(--brand)' }}>
                              Read more on {f.canonicalPageTitle} <PmIconArrow />
                            </Link>
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            );
          })}
          {faqItems.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 17 }}>FAQs are being added — contact us with any questions in the meantime.</p>}
        </div>
      </section>
      <PremiumFinalCta heading="Still have questions?" sub="We're happy to help — reach out and we'll get right back to you." ctaStyle={ctaStyle} phone={phone} />
    </PremiumShell>
  );
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
