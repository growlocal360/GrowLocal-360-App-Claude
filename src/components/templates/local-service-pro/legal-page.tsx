'use client';

import type { PublicRenderSite, PublicRenderLocation, PublicRenderAreaListing } from '@/lib/sites/public-render-model';
import { SiteHeader, type NavCategory } from './site-header';
import { SiteFooter } from './site-footer';
import { PageHero } from './page-hero';

export interface LegalPageProps {
  site: PublicRenderSite;
  primaryLocation: PublicRenderLocation | null;
  serviceAreas: PublicRenderAreaListing[];
  categories: NavCategory[];
  siteSlug: string;
  locationSlug?: string;
  kind: 'privacy' | 'terms';
  h1: string;
  body: string;
  updatedAt: string | null;
}

/** Privacy Policy / Terms of Service: heading + plain paragraphs. */
export function LegalPage({ site, primaryLocation, serviceAreas, categories, siteSlug, locationSlug, h1, body, updatedAt }: LegalPageProps) {
  const brandColor = site.settings?.brand_color || '#00ef99';
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader site={site} primaryLocation={primaryLocation} categories={categories} siteSlug={siteSlug} locationSlug={locationSlug} />
      <main>
        <PageHero brandColor={brandColor} title={h1} subtitle={updatedAt ? `Last updated ${new Date(updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}` : undefined} />
        <section className="py-12">
          <div className="mx-auto max-w-3xl px-4 space-y-5 text-gray-700 leading-relaxed">
            {body.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </section>
      </main>
      <SiteFooter site={site} primaryLocation={primaryLocation} serviceAreas={serviceAreas} siteSlug={siteSlug} locationSlug={locationSlug} />
    </div>
  );
}
