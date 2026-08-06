'use client';

import Link from 'next/link';
import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderNeighborhoodDetail,
  PublicRenderNeighborhoodListing, PublicRenderWorkItem, PublicRenderCategory,
} from '@/lib/sites/public-render-model';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildBreadcrumbSchema } from '@/lib/schema';
import { UnifiedLeadForm } from '@/components/templates/local-service-pro/unified-lead-form';
import { PremiumShell, PremiumPageHero, PremiumFinalCta, PremiumRecentWork } from './shell';
import { PmIconCheck, PmIconPin, PmIconStar, PmIconShield, PmIconClock, PmIconLayers, PmIconUsers } from './icons';

interface PremiumNeighborhoodPageSingleProps {
  data: {
    site: PublicRenderSite;
    location: PublicRenderLocation;
    neighborhood: PublicRenderNeighborhoodDetail;
    allNeighborhoods: PublicRenderNeighborhoodListing[];
  };
  siteSlug: string;
  categories?: NavCategory[];
  recentWorkItems?: PublicRenderWorkItem[];
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function PremiumNeighborhoodPageSingleLocation({
  data, siteSlug, recentWorkItems, formCategories, schedulingActive = false, ctaStyle = 'booking',
}: PremiumNeighborhoodPageSingleProps) {
  const { site, location, neighborhood, allNeighborhoods } = data;
  const ctaColor = site.settings?.cta_color || site.settings?.brand_color || '#00ef99';
  const phone = site.settings?.phone || location?.phone;
  const industry = site.settings?.core_industry || 'Professional Services';
  const features = neighborhood.local_features;
  const faqs = neighborhood.faqs || [];
  const otherNeighborhoods = allNeighborhoods.filter(n => n.id !== neighborhood.id);

  const h1 = neighborhood.h1 || `${industry} in ${neighborhood.name}`;

  // Content: user HTML description > AI body_copy > generic fallback (kept in
  // parity with the default template so an ungenerated neighborhood still reads
  // fully rather than as a single sentence).
  const bodyParagraphs: string[] = neighborhood.body_copy
    ? neighborhood.body_copy.split('\n\n')
    : [
        `${site.name} is your trusted ${industry.toLowerCase()} provider in ${neighborhood.name}. As a locally-owned business serving the ${location.city} area, we understand the unique needs of ${neighborhood.name} residents and businesses.`,
        `Whether you need routine maintenance, emergency repairs, or complete installations, our experienced team is ready to help. We take pride in delivering quality workmanship and exceptional customer service to every client in ${neighborhood.name}.`,
        `Contact us today to schedule a free consultation or get a quote for your project. We look forward to serving you!`,
      ];

  // Why Choose Us — AI-generated if present, else the same 6-item fallback the
  // default template uses.
  const whyChooseUs = features?.why_choose_us?.length
    ? features.why_choose_us
    : [
        'Local experts who know the area',
        'Fast response times',
        'Upfront, honest pricing',
        'Licensed and insured',
        'Satisfaction guaranteed',
        'Emergency services available',
      ];

  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome() },
    { name: 'Neighborhoods', url: paths.neighborhoodsIndex() },
    { name: neighborhood.name, url: paths.neighborhoodPage(neighborhood.slug) },
  ]);

  return (
    <PremiumShell site={site} primaryLocation={location} siteSlug={siteSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[breadcrumb]} />
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome() }, { label: neighborhood.name }]}
        eyebrow="Neighborhood"
        title={h1}
        accent={neighborhood.name}
        lede={`${site.name} proudly serves ${neighborhood.name} and the surrounding ${location.city}, ${location.state} area.`}
      />

      <section className="pm-block">
        <div className="pm-wrap pm-layout">
          <div className="pm-prose">
            <h2>About our services in {neighborhood.name}</h2>
            {bodyParagraphs.map((p, i) => <p key={i}>{p}</p>)}

            {/* Why choose us */}
            <h2>Why {neighborhood.name} chooses {site.name}</h2>
            <ul>
              {whyChooseUs.map((w, i) => (
                <li key={i}><span className="pm-chk"><PmIconCheck /></span><div>{w}</div></li>
              ))}
            </ul>

            {/* Landmarks */}
            {features?.landmarks && features.landmarks.length > 0 && (
              <>
                <h3>Notable landmarks &amp; parks</h3>
                <ul>
                  {features.landmarks.map((l, i) => (
                    <li key={i}><span className="pm-chk"><PmIconPin /></span><div><b>{l.name}</b>{l.description ? ` — ${l.description}` : ''}</div></li>
                  ))}
                </ul>
              </>
            )}

            {/* Schools */}
            {features?.schools && features.schools.length > 0 && (
              <>
                <h3>Nearby schools</h3>
                <ul>
                  {features.schools.map((s, i) => (
                    <li key={i}><span className="pm-chk"><PmIconLayers /></span><div><b>{s.name}</b>{s.description ? ` — ${s.description}` : ''}</div></li>
                  ))}
                </ul>
              </>
            )}

            {/* Housing */}
            {features?.housing && (
              <>
                <h3>Housing &amp; architecture</h3>
                <p>{features.housing}</p>
              </>
            )}

            {/* Community */}
            {features?.community && (
              <>
                <h3>Community &amp; local character</h3>
                <p>{features.community}</p>
              </>
            )}

            {/* FAQs */}
            {faqs.length > 0 && (
              <>
                <h2>Frequently asked questions — {neighborhood.name}</h2>
                <div className="pm-faq" style={{ marginTop: 24 }}>
                  {faqs.map((f, i) => (
                    <details key={i} open={i === 0}>
                      <summary>{f.question}<span className="pm-plus"><PlusIcon /></span></summary>
                      <div className="pm-ans">{f.answer}</div>
                    </details>
                  ))}
                </div>
              </>
            )}

            {/* Other neighborhoods */}
            {otherNeighborhoods.length > 0 && (
              <>
                <h3>Other neighborhoods we serve</h3>
                <div className="pm-areas" style={{ marginTop: 12 }}>
                  {otherNeighborhoods.map(n => (
                    <Link key={n.id} className="pm-chip" href={paths.neighborhoodPage(n.slug)}>
                      <span className="pm-pin"><PmIconPin /></span>{n.name}
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
                <div className="pm-t"><span className="pm-ic"><PmIconStar /></span>Trusted in {neighborhood.name}</div>
                <div className="pm-t"><span className="pm-ic"><PmIconShield /></span>Licensed &amp; insured</div>
                <div className="pm-t"><span className="pm-ic"><PmIconClock /></span>Fast response times</div>
                {(location.address_line1 || location.city) && (
                  <div className="pm-t"><span className="pm-ic"><PmIconUsers /></span>Serving {location.city}, {location.state}</div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <PremiumRecentWork items={recentWorkItems} title={`Recent work near ${neighborhood.name}`} />

      <PremiumFinalCta heading={`Serving ${neighborhood.name}`} sub={`Book your appointment with ${site.name} today.`} ctaStyle={ctaStyle} phone={phone} />
    </PremiumShell>
  );
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
