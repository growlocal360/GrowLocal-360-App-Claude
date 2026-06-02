'use client';

import Link from 'next/link';
import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderBrandListing,
  PublicRenderAreaListing, PublicRenderCategory,
} from '@/lib/sites/public-render-model';
import type { NavCategory } from '@/components/templates/local-service-pro/site-header';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildBreadcrumbSchema } from '@/lib/schema';
import { PremiumShell, PremiumPageHero, PremiumFinalCta } from './shell';
import { PmIconArrow, PmIconLayers } from './icons';

interface PremiumBrandsListingPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  brands: PublicRenderBrandListing[];
  serviceAreas: PublicRenderAreaListing[];
  categories: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function PremiumBrandsListingPage({
  site, primaryLocation, brands, serviceAreas, siteSlug, locationSlug, ctaStyle = 'booking',
}: PremiumBrandsListingPageProps) {
  const phone = site.settings?.phone || primaryLocation?.phone;
  const cityState = primaryLocation?.city ? `${primaryLocation.city}${primaryLocation.state ? `, ${primaryLocation.state}` : ''}` : '';

  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: 'Brands', url: paths.brandsIndex(locationSlug) },
  ]);

  return (
    <PremiumShell site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[breadcrumb]} />
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: 'Brands' }]}
        eyebrow="Brands We Service"
        title="Brands we service & repair"
        lede={`Factory-trained expertise across every major brand${cityState ? ` in ${primaryLocation?.city}` : ''}.`}
      />
      <section className="pm-block">
        <div className="pm-wrap">
          {brands.length > 0 ? (
            <div className="pm-grid3">
              {brands.map(b => (
                <Link key={b.id} className="pm-card" href={paths.brandPage(b.slug, locationSlug)}>
                  <span className="pm-icon"><PmIconLayers /></span>
                  <h3>{b.name}</h3>
                  {b.hero_description && <p>{b.hero_description}</p>}
                  <span className="pm-more">View {b.name} service <PmIconArrow /></span>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: 17 }}>We service all major brands — contact us about yours.</p>
          )}
        </div>
      </section>
      <PremiumFinalCta heading="Don't see your brand?" sub="We service all major makes and models — just ask." ctaStyle={ctaStyle} phone={phone} />
    </PremiumShell>
  );
}
