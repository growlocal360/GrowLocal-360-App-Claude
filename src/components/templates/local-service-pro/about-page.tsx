'use client';

import type { Site, Location, SitePage, ServiceAreaDB } from '@/types/database';
import { SiteHeader, NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { LeadCaptureSection } from './lead-capture-section';

interface AboutPageProps {
  site: Site;
  primaryLocation: Location | null;
  pageContent: SitePage | null;
  serviceAreas?: ServiceAreaDB[];
  categories?: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
}

export function AboutPage({ site, primaryLocation, pageContent, serviceAreas, categories, siteSlug, locationSlug }: AboutPageProps) {
  const brandColor = site.settings?.brand_color || '#00d9c0';

  const h1 = pageContent?.h1 || `About ${site.name}`;
  const heroDescription = pageContent?.hero_description || '';
  const bodyCopy = pageContent?.body_copy || '';
  const bodyCopy2 = pageContent?.body_copy_2 || '';

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader site={site} primaryLocation={primaryLocation} categories={categories} siteSlug={siteSlug} locationSlug={locationSlug} />
      <main>
        {/* Hero */}
        <section className="py-16 text-white" style={{ backgroundColor: brandColor }}>
          <div className="mx-auto max-w-7xl px-4">
            <h1 className="text-3xl font-bold md:text-4xl lg:text-5xl">{h1}</h1>
            {heroDescription && (
              <p className="mt-4 text-lg text-white/90">{heroDescription}</p>
            )}
          </div>
        </section>

        {/* Body Content */}
        {bodyCopy && (
          <section className="py-16">
            <div className="mx-auto max-w-3xl px-4">
              <div className="prose prose-lg max-w-none text-gray-700">
                {bodyCopy.split('\n\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Secondary Content */}
        {bodyCopy2 && (
          <section className="bg-gray-50 py-16">
            <div className="mx-auto max-w-3xl px-4">
              <div className="prose prose-lg max-w-none text-gray-700">
                {bodyCopy2.split('\n\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        <LeadCaptureSection siteId={site.id} brandColor={brandColor} />
      </main>
      <SiteFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} />
    </div>
  );
}
