'use client';

import { PublicSiteData } from '@/lib/sites/get-site';
import { SiteHeader } from './site-header';
import { HeroSection } from './hero-section';
import { ServicesPreview } from './services-preview';
import { ServiceAreasSection } from './service-areas-section';
import { NeighborhoodsSection } from './neighborhoods-section';
import { LocationsSection } from './locations-section';
import { CTASection } from './cta-section';
import { SiteFooter } from './site-footer';

interface LocalServiceProTemplateProps {
  data: PublicSiteData;
  siteSlug?: string;
}

export function LocalServiceProTemplate({ data, siteSlug }: LocalServiceProTemplateProps) {
  const { site, locations, serviceAreas, neighborhoods, primaryLocation } = data;
  const slug = siteSlug || site.slug;

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader site={site} primaryLocation={primaryLocation} />
      <main>
        <HeroSection site={site} primaryLocation={primaryLocation} />
        <ServicesPreview site={site} />
        {neighborhoods.length > 0 && (
          <NeighborhoodsSection
            site={site}
            neighborhoods={neighborhoods}
            locations={locations}
          />
        )}
        {serviceAreas.length > 0 && (
          <ServiceAreasSection site={site} serviceAreas={serviceAreas} siteSlug={slug} />
        )}
        {locations.length > 1 && (
          <LocationsSection site={site} locations={locations} />
        )}
        <CTASection site={site} primaryLocation={primaryLocation} />
      </main>
      <SiteFooter site={site} primaryLocation={primaryLocation} />
    </div>
  );
}
