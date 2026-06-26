'use client';

import Link from 'next/link';
import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderAreaListing,
  PublicRenderNeighborhoodListing, PublicRenderCategory,
} from '@/lib/sites/public-render-model';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildBreadcrumbSchema } from '@/lib/schema';
import { PremiumShell, PremiumPageHero, PremiumFinalCta } from './shell';
import { PmIconPin } from './icons';

interface PremiumServiceAreasListingPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  serviceAreas: PublicRenderAreaListing[];
  neighborhoods: PublicRenderNeighborhoodListing[];
  categories: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function PremiumServiceAreasListingPage({
  site, primaryLocation, serviceAreas, neighborhoods, siteSlug, locationSlug, ctaStyle = 'booking',
}: PremiumServiceAreasListingPageProps) {
  const phone = site.settings?.phone || primaryLocation?.phone;

  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: 'Service Areas', url: paths.areasIndex(locationSlug) },
  ]);

  return (
    <PremiumShell site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[breadcrumb]} />
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: 'Service Areas' }]}
        eyebrow="Service Areas"
        title={`Proudly serving ${primaryLocation?.city || 'your area'} & beyond`}
        accent={primaryLocation?.city || undefined}
        lede="Find your community below — we provide expert service across the region."
      />
      <section className="pm-block">
        <div className="pm-wrap">
          {serviceAreas.length > 0 && (
            <>
              <div className="pm-sechead"><span className="pm-eyebrow">Cities</span><h2>Cities we serve</h2></div>
              <div className="pm-areas" style={{ marginBottom: 48 }}>
                {serviceAreas.map(a => {
                  const label = <>{<span className="pm-pin"><PmIconPin /></span>}{a.state ? `${a.name}, ${a.state}` : a.name}</>;
                  // v5: link only when the city has a dedicated page (Pattern 1 /
                  // city hub); otherwise it's a plain text mention.
                  return a.pageUrl
                    ? <Link key={a.id} className="pm-chip" href={a.pageUrl}>{label}</Link>
                    : <span key={a.id} className="pm-chip pm-chip-static">{label}</span>;
                })}
              </div>
            </>
          )}
          {neighborhoods.length > 0 && (
            <>
              <div className="pm-sechead"><span className="pm-eyebrow">Neighborhoods</span><h2>Neighborhoods we serve</h2></div>
              <div className="pm-areas">
                {neighborhoods.map(n => (
                  <Link key={n.id} className="pm-chip" href={paths.neighborhoodPage(n.slug, locationSlug)}><span className="pm-pin"><PmIconPin /></span>{n.name}</Link>
                ))}
              </div>
            </>
          )}
          {serviceAreas.length === 0 && neighborhoods.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: 17 }}>Contact us to confirm service in your area.</p>
          )}
        </div>
      </section>
      <PremiumFinalCta heading="Don't see your area?" sub="Reach out — we likely serve your neighborhood too." ctaStyle={ctaStyle} phone={phone} />
    </PremiumShell>
  );
}
