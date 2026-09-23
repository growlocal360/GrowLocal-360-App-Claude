'use client';

import Link from 'next/link';
import type {
  PublicRenderSite, PublicRenderLocation, PublicRenderCategory,
  PublicRenderServiceListing, PublicRenderAreaListing,
} from '@/lib/sites/public-render-model';
import * as paths from '@/lib/routing/paths';
import { JsonLd, buildBreadcrumbSchema } from '@/lib/schema';
import { normalizeCategorySlug } from '@/lib/utils/slugify';
import { PremiumShell, PremiumPageHero, PremiumFinalCta } from './shell';
import { PmIconWrench, PmIconArrow } from './icons';
import { hubCityFor, servedCommunitiesLabel } from '@/lib/sites/hub-heading';

interface PremiumServicesPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  categories: PublicRenderCategory[];
  servicesByCategory: Record<string, PublicRenderServiceListing[]>;
  serviceAreas?: PublicRenderAreaListing[];
  siteSlug: string;
  locationSlug?: string;
  formCategories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
}

export function PremiumServicesPage({
  site, primaryLocation, categories, servicesByCategory, serviceAreas = [],
  siteSlug, locationSlug, ctaStyle = 'booking',
}: PremiumServicesPageProps) {
  const phone = site.settings?.phone || primaryLocation?.phone;
  // Brand-level hub: names the city only when the home page is the Primary Market page (v5 rule 11).
  const hubCity = hubCityFor(site, primaryLocation?.city);
  const served = servedCommunitiesLabel(serviceAreas);
  const lede = hubCity
    ? `Every service we offer in ${hubCity} and the surrounding area.`
    : served
      ? `Serving ${served}.`
      : `Every service ${site.name} offers, in one place.`;

  const breadcrumb = buildBreadcrumbSchema([
    { name: 'Home', url: paths.locationHome(locationSlug) },
    { name: 'Services', url: paths.servicesIndex(locationSlug) },
  ]);

  return (
    <PremiumShell formOnPage={false} site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} ctaStyle={ctaStyle}>
      <JsonLd data={[breadcrumb]} />
      <PremiumPageHero
        crumbs={[{ label: 'Home', href: paths.locationHome(locationSlug) }, { label: 'Services' }]}
        eyebrow="What We Do"
        title={hubCity ? `Our services in ${hubCity}` : 'Our services'}
        accent={hubCity || 'services'}
        lede={lede}
      />
      <section className="pm-block">
        <div className="pm-wrap">
          {categories.map(cat => {
            const catName = cat.gbp_category?.display_name || 'Services';
            const catSlug = normalizeCategorySlug(catName);
            const svcs = servicesByCategory[cat.id] || [];
            if (svcs.length === 0) return null;
            return (
              <div key={cat.id} style={{ marginBottom: 56 }}>
                {categories.length > 1 && <h2 style={{ fontSize: 28, marginBottom: 24 }}>{catName}</h2>}
                <div className="pm-grid3">
                  {svcs.map(s => (
                    <Link key={s.id} className="pm-card" href={paths.servicePage(s.slug, catSlug, cat.is_primary, locationSlug)}>
                      <span className="pm-icon"><PmIconWrench /></span>
                      <h3>{s.name}</h3>
                      {s.description && <p>{s.description}</p>}
                      <span className="pm-more">Learn more <PmIconArrow /></span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <PremiumFinalCta heading="Ready to get started?" sub="Fast response, upfront pricing, satisfaction guaranteed." ctaStyle={ctaStyle} phone={phone} />
    </PremiumShell>
  );
}
