'use client';

import Link from 'next/link';
import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderWorkItem,
  PublicRenderAreaListing, PublicRenderCategory,
} from '@/lib/sites/public-render-model';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildBreadcrumbSchema } from '@/lib/schema';
import { PremiumShell, PremiumPageHero, PremiumFinalCta } from './shell';

interface PremiumWorkHubPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  workItems: PublicRenderWorkItem[];
  serviceAreas?: PublicRenderAreaListing[];
  categories?: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
  siteId: string;
  hasMore?: boolean;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function PremiumWorkHubPage({
  site, primaryLocation, workItems, serviceAreas = [], siteSlug, locationSlug, ctaStyle = 'booking',
}: PremiumWorkHubPageProps) {
  const phone = site.settings?.phone || primaryLocation?.phone;
  const cityState = primaryLocation?.city ? `${primaryLocation.city}${primaryLocation.state ? `, ${primaryLocation.state}` : ''}` : '';

  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: 'Recent Work', url: paths.workHub(locationSlug) },
  ]);

  return (
    <PremiumShell site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[breadcrumb]} />

      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: 'Recent Work' }]}
        eyebrow="Recent Work"
        title={cityState ? `Real work in ${cityState}` : 'Our recent work'}
        accent={cityState || undefined}
        lede="Every job documented by our team — browse recent projects in your area."
      />

      <section className="pm-block">
        <div className="pm-wrap">
          {workItems.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 17 }}>New projects are added regularly — check back soon.</p>
          ) : (
            <div className="pm-work">
              {workItems.map(w => {
                const img = w.images?.[0]?.url;
                const meta = [w.location?.city || w.address_city, relTime(w.performed_at)].filter(Boolean).join(' · ');
                return (
                  <Link key={w.id} className="pm-workcard" href={paths.workDetail(w.slug, locationSlug)}>
                    {img ? <img src={img} alt={w.images?.[0]?.alt || w.title} /> : <span className="pm-imgph" />}
                    {w.service?.name && <span className="pm-tag">{w.service.name}</span>}
                    <span className="pm-ov"><span className="pm-ovt">{w.title}</span>{meta && <span className="pm-mt" style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, marginTop: 4 }}>{meta}</span>}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <PremiumFinalCta heading="Your project could be next" sub={cityState ? `Serving ${primaryLocation?.city} & surrounding areas.` : 'Available across your area.'} ctaStyle={ctaStyle} phone={phone} />
    </PremiumShell>
  );
}

function relTime(iso: string | null): string {
  if (!iso) return '';
  // Avoid Date.now() drift concerns — just show the calendar month/year.
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
